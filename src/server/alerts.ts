import type { DatabaseSync } from "node:sqlite"

import {
  type AlertFieldErrors,
  type AlertInput,
  alertSchemaFor,
  decimalFromNumber,
  describePublicRule,
  describeRule,
  isAlertId,
  normaliseDecimal,
  type PercentDirection,
  type PriceDirection,
  type Rule,
  type RuleInput,
  toFieldErrors,
} from "@/lib/alert-rules"
import { getInstrumentBySymbol } from "./instruments"

// The alerts domain module: every rule about creating, changing, pausing,
// resuming and deleting an Alert, its outbox, and its public projection.
// Callers pass the Owner explicitly; the server functions take it from the session.

export type HoldingsLookup = (
  personId: string,
  symbol: string
) => { pricePaid: number } | null

export interface AlertsDeps {
  db: DatabaseSync
  holdings: HoldingsLookup
  now: () => Date
}

export type AlertState = "active" | "paused"

export interface MatchView {
  matchedAt: string
  price: string
}

export interface Alert {
  id: string
  symbol: string
  instrumentName: string
  decimals: number
  title: string | null
  state: AlertState
  rule: Rule
  /** The Owner's Rule Description. */
  description: string
  ruleRevision: number
  version: number
  createdAt: string
  updatedAt: string
  /** The latest Match of the current Rule Revision. Always null until Ingest exists. */
  latestMatch: MatchView | null
}

export type AlertError =
  | { code: "not_found" }
  | { code: "id_unavailable" }
  | { code: "stale_version"; latest: Alert }
  | { code: "invalid"; fieldErrors: AlertFieldErrors }
  | { code: "holding_missing"; symbol: string }

export type AlertResult =
  | { ok: true; alert: Alert }
  | { ok: false; error: AlertError }

export interface AlertEdit {
  title: string
  rule: AlertInput["rule"]
}

/** What a Shared Link may show. Built from public columns only (design §8). */
export interface PublicAlert {
  symbol: string
  instrumentName: string
  description: string
  state: AlertState
  latestMatch: MatchView | null
  /** The Instrument's Checked-through; null until Ingest exists. */
  checkedThrough: string | null
}

/** The rule message of design §5, as written to the outbox. */
export interface RuleMessage {
  alert_id: string
  version: number
  rule_revision: number
  person_id: string
  symbol: string
  state: AlertState | "deleted"
  rule:
    | { kind: "price"; direction: PriceDirection; threshold: string }
    | {
        kind: "percentage"
        direction: PercentDirection
        percent: string
        baseline: "todays_open"
      }
    | null
}

export interface Alerts {
  create(ownerId: string, id: string, input: AlertInput): AlertResult
  update(
    ownerId: string,
    id: string,
    expectedVersion: number,
    edit: AlertEdit
  ): AlertResult
  pause(ownerId: string, id: string): AlertResult
  resume(ownerId: string, id: string): AlertResult
  delete(
    ownerId: string,
    id: string
  ): { ok: true } | { ok: false; error: { code: "not_found" } }
  list(ownerId: string): Alert[]
  get(ownerId: string, id: string): Alert | null
  publicView(id: string): PublicAlert | null
  /** The outbox, oldest first: what the future Rule Relay will publish. */
  outboxMessages(): RuleMessage[]
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    title TEXT,
    state TEXT NOT NULL CHECK (state IN ('active', 'paused', 'deleted')),
    rule_kind TEXT,
    direction TEXT,
    threshold_source TEXT,
    threshold TEXT,
    percent TEXT,
    rule_revision INTEGER NOT NULL,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS alerts_by_owner ON alerts (owner_id, created_at);

  CREATE TABLE IF NOT EXISTS matches (
    event_id TEXT PRIMARY KEY,
    alert_id TEXT NOT NULL,
    rule_revision INTEGER NOT NULL,
    matched_at TEXT NOT NULL,
    price TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS matches_by_alert
    ON matches (alert_id, rule_revision, matched_at DESC, event_id DESC);

  CREATE TABLE IF NOT EXISTS alert_pauses (
    id INTEGER PRIMARY KEY,
    alert_id TEXT NOT NULL,
    rule_revision INTEGER NOT NULL,
    paused_at TEXT NOT NULL,
    resumed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS alert_pauses_by_alert ON alert_pauses (alert_id);

  CREATE TABLE IF NOT EXISTS rule_outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`

interface AlertRow {
  id: string
  owner_id: string
  symbol: string
  title: string | null
  state: AlertState | "deleted"
  rule_kind: "price" | "percentage" | null
  direction: string | null
  threshold_source: "typed" | "price_paid" | null
  threshold: string | null
  percent: string | null
  rule_revision: number
  version: number
  created_at: string
  updated_at: string
  latest_matched_at: string | null
  latest_price: string | null
}

// The latest Match is always of the current Rule Revision, so a Match of an
// old Rule is never shown — for the Owner or on the public projection.
const JOIN_LATEST_MATCH = `
  LEFT JOIN matches m ON m.event_id = (
    SELECT event_id FROM matches
    WHERE alert_id = a.id AND rule_revision = a.rule_revision
    ORDER BY matched_at DESC, event_id DESC
    LIMIT 1
  )
`

// Every read of an Alert for its Owner goes through this.
const SELECT_ALERT = `
  SELECT a.*, m.matched_at AS latest_matched_at, m.price AS latest_price
  FROM alerts a
  ${JOIN_LATEST_MATCH}
`

// The public projection (design §8): an explicit list of public columns — never
// the Alert Title, the Owner, or anything from a Holding — and Private Rules
// refused in the query itself, behind the form that never offers sharing them.
const SELECT_PUBLIC_ALERT = `
  SELECT a.symbol, a.state, a.rule_kind, a.direction, a.threshold_source,
    a.threshold, a.percent,
    m.matched_at AS latest_matched_at, m.price AS latest_price
  FROM alerts a
  ${JOIN_LATEST_MATCH}
  WHERE a.id = ?
    AND a.state IN ('active', 'paused')
    AND a.threshold_source IS NOT 'price_paid'
`

type PublicAlertRow = Pick<
  AlertRow,
  | "symbol"
  | "state"
  | "rule_kind"
  | "direction"
  | "threshold_source"
  | "threshold"
  | "percent"
  | "latest_matched_at"
  | "latest_price"
>

function latestMatchOf(
  row: Pick<AlertRow, "latest_matched_at" | "latest_price">
): MatchView | null {
  return row.latest_matched_at && row.latest_price
    ? { matchedAt: row.latest_matched_at, price: row.latest_price }
    : null
}

function toPublicAlert(row: PublicAlertRow): PublicAlert | null {
  const instrument = getInstrumentBySymbol(row.symbol)
  const description = describePublicRule(
    row.symbol,
    ruleOf(row),
    instrument?.decimals ?? 2
  )
  if (!instrument || !description) {
    return null
  }
  return {
    symbol: row.symbol,
    instrumentName: instrument.name,
    description,
    state: row.state as AlertState,
    latestMatch: latestMatchOf(row),
    checkedThrough: null,
  }
}

function ruleOf(
  row: Pick<
    AlertRow,
    "rule_kind" | "direction" | "threshold_source" | "threshold" | "percent"
  >
): Rule {
  if (row.rule_kind === "price") {
    return {
      kind: "price",
      direction: row.direction as PriceDirection,
      source: row.threshold_source as "typed" | "price_paid",
      threshold: row.threshold as string,
    }
  }
  return {
    kind: "percentage",
    direction: row.direction as PercentDirection,
    percent: row.percent as string,
  }
}

function toAlert(row: AlertRow): Alert {
  const instrument = getInstrumentBySymbol(row.symbol)
  const decimals = instrument?.decimals ?? 2
  const rule = ruleOf(row)
  return {
    id: row.id,
    symbol: row.symbol,
    instrumentName: instrument?.name ?? row.symbol,
    decimals,
    title: row.title,
    state: row.state as AlertState,
    rule,
    description: describeRule(row.symbol, rule, decimals),
    ruleRevision: row.rule_revision,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latestMatch: latestMatchOf(row),
  }
}

function ruleMessageOf(row: AlertRow): RuleMessage {
  const base = {
    alert_id: row.id,
    version: row.version,
    rule_revision: row.rule_revision,
    person_id: row.owner_id,
    symbol: row.symbol,
  }
  if (row.state === "deleted") {
    return { ...base, state: "deleted", rule: null }
  }
  const rule = ruleOf(row)
  return {
    ...base,
    state: row.state,
    rule:
      rule.kind === "price"
        ? {
            kind: "price",
            direction: rule.direction,
            threshold: rule.threshold,
          }
        : {
            kind: "percentage",
            direction: rule.direction,
            percent: rule.percent,
            baseline: "todays_open",
          },
  }
}

function ruleColumns(rule: Rule) {
  return {
    rule_kind: rule.kind,
    direction: rule.direction,
    threshold_source: rule.kind === "price" ? rule.source : null,
    threshold: rule.kind === "price" ? rule.threshold : null,
    percent: rule.kind === "percentage" ? rule.percent : null,
  }
}

/** Both Rules are already normalised, so "5" and "5.00" compare equal. */
function sameRule(a: Rule, b: Rule): boolean {
  const left = ruleColumns(a)
  const right = ruleColumns(b)
  return (Object.keys(left) as (keyof typeof left)[]).every(
    (column) => left[column] === right[column]
  )
}

const NOT_FOUND = { ok: false, error: { code: "not_found" } } as const

function holdingMissing(symbol: string): AlertResult {
  return { ok: false, error: { code: "holding_missing", symbol } }
}

function invalid(fieldErrors: AlertFieldErrors): AlertResult {
  return { ok: false, error: { code: "invalid", fieldErrors } }
}

/** Checks the input against its Instrument; the Instrument's limits come from the catalogue. */
function validate(input: AlertInput): AlertFieldErrors | null {
  const instrument = getInstrumentBySymbol(input.symbol)
  if (!instrument) {
    return { symbol: "Choose an instrument" }
  }
  const parsed = alertSchemaFor(instrument.decimals).safeParse(input)
  return parsed.success ? null : toFieldErrors(parsed.error)
}

export function createAlerts({ db, holdings, now }: AlertsDeps): Alerts {
  db.exec(SCHEMA)

  /** The Rule with its threshold resolved; null when a Private Rule has no Holding behind it. */
  function resolveRule(
    ownerId: string,
    symbol: string,
    input: RuleInput
  ): Rule | null {
    if (input.kind === "percentage") {
      return {
        kind: "percentage",
        direction: input.direction,
        percent: normaliseDecimal(input.percent),
      }
    }
    if (input.threshold.source === "typed") {
      return {
        kind: "price",
        direction: input.direction,
        source: "typed",
        threshold: normaliseDecimal(input.threshold.price),
      }
    }
    const holding = holdings(ownerId, symbol)
    return holding
      ? {
          kind: "price",
          direction: input.direction,
          source: "price_paid",
          threshold: normaliseDecimal(decimalFromNumber(holding.pricePaid)),
        }
      : null
  }

  const selectById = db.prepare(`${SELECT_ALERT} WHERE a.id = ?`)
  const selectOwned = db.prepare(
    `${SELECT_ALERT} WHERE a.id = ? AND a.owner_id = ? AND a.state != 'deleted'`
  )
  const selectPublic = db.prepare(SELECT_PUBLIC_ALERT)
  const selectOwnerAlerts = db.prepare(
    `${SELECT_ALERT} WHERE a.owner_id = ? AND a.state != 'deleted' ORDER BY a.created_at DESC, a.id`
  )
  const insertAlert = db.prepare(`
    INSERT INTO alerts (id, owner_id, symbol, title, state, rule_kind, direction,
      threshold_source, threshold, percent, rule_revision, version, created_at, updated_at)
    VALUES (:id, :owner_id, :symbol, :title, :state, :rule_kind, :direction,
      :threshold_source, :threshold, :percent, :rule_revision, :version, :created_at, :updated_at)
  `)
  const updateAlert = db.prepare(`
    UPDATE alerts SET title = :title, state = :state, rule_kind = :rule_kind,
      direction = :direction, threshold_source = :threshold_source,
      threshold = :threshold, percent = :percent, rule_revision = :rule_revision,
      version = :version, updated_at = :updated_at
    WHERE id = :id
  `)
  const deleteMatches = db.prepare("DELETE FROM matches WHERE alert_id = ?")
  const deletePauses = db.prepare("DELETE FROM alert_pauses WHERE alert_id = ?")
  const openPause = db.prepare(
    "INSERT INTO alert_pauses (alert_id, rule_revision, paused_at) VALUES (?, ?, ?)"
  )
  const closePause = db.prepare(
    "UPDATE alert_pauses SET resumed_at = ? WHERE alert_id = ? AND resumed_at IS NULL"
  )
  const insertOutbox = db.prepare(
    "INSERT INTO rule_outbox (alert_id, version, message, created_at) VALUES (?, ?, ?, ?)"
  )
  const selectOutbox = db.prepare(
    "SELECT message FROM rule_outbox ORDER BY seq"
  )

  function transaction<T>(work: () => T): T {
    db.exec("BEGIN IMMEDIATE")
    try {
      const result = work()
      db.exec("COMMIT")
      return result
    } catch (error) {
      db.exec("ROLLBACK")
      throw error
    }
  }

  function rowById(id: string): AlertRow | undefined {
    return selectById.get(id) as AlertRow | undefined
  }

  function ownedRow(ownerId: string, id: string): AlertRow | undefined {
    return selectOwned.get(id, ownerId) as AlertRow | undefined
  }

  /**
   * Writes the Alert's new state. A new Rule Revision starts its Match history
   * over; pause intervals are kept per Rule Revision so a Match After Pause can
   * be worked out when reading (design §6).
   */
  function save(row: AlertRow, changes: Partial<AlertRow>): AlertRow {
    const next = {
      ...row,
      ...changes,
      version: row.version + 1,
      updated_at: now().toISOString(),
    }
    const newRevision = next.rule_revision !== row.rule_revision
    if (newRevision) {
      deleteMatches.run(row.id)
      deletePauses.run(row.id)
    }
    if (next.state === "paused" && (row.state !== "paused" || newRevision)) {
      openPause.run(row.id, next.rule_revision, next.updated_at)
    }
    if (next.state === "active" && row.state === "paused") {
      closePause.run(next.updated_at, row.id)
    }
    updateAlert.run({
      id: next.id,
      title: next.title,
      state: next.state,
      rule_kind: next.rule_kind,
      direction: next.direction,
      threshold_source: next.threshold_source,
      threshold: next.threshold,
      percent: next.percent,
      rule_revision: next.rule_revision,
      version: next.version,
      updated_at: next.updated_at,
    })
    return rowById(row.id) as AlertRow
  }

  /** Writes the Alert's rule message to the outbox; the future Rule Relay publishes it. */
  function enqueueRuleMessage(row: AlertRow): void {
    insertOutbox.run(
      row.id,
      row.version,
      JSON.stringify(ruleMessageOf(row)),
      now().toISOString()
    )
  }

  return {
    create(ownerId, id, input) {
      if (!isAlertId(id)) {
        return { ok: false, error: { code: "id_unavailable" } }
      }
      return transaction(() => {
        // A retry of a create returns what the first attempt made; an id that is
        // someone else's, or a deleted Alert's, is refused without saying which.
        const existing = rowById(id)
        if (existing) {
          return existing.owner_id === ownerId && existing.state !== "deleted"
            ? { ok: true, alert: toAlert(existing) }
            : { ok: false, error: { code: "id_unavailable" } }
        }
        const fieldErrors = validate(input)
        if (fieldErrors) {
          return invalid(fieldErrors)
        }
        const rule = resolveRule(ownerId, input.symbol, input.rule)
        if (!rule) {
          return holdingMissing(input.symbol)
        }
        const timestamp = now().toISOString()
        insertAlert.run({
          id,
          owner_id: ownerId,
          symbol: input.symbol,
          title: input.title.trim() || null,
          state: "active",
          ...ruleColumns(rule),
          rule_revision: 1,
          version: 1,
          created_at: timestamp,
          updated_at: timestamp,
        })
        const row = rowById(id) as AlertRow
        enqueueRuleMessage(row)
        return { ok: true, alert: toAlert(row) }
      })
    },
    update(ownerId, id, expectedVersion, edit) {
      return transaction((): AlertResult => {
        const row = ownedRow(ownerId, id)
        if (!row) {
          return NOT_FOUND
        }
        if (row.version !== expectedVersion) {
          return {
            ok: false,
            error: { code: "stale_version", latest: toAlert(row) },
          }
        }
        const fieldErrors = validate({ symbol: row.symbol, ...edit })
        if (fieldErrors) {
          return invalid(fieldErrors)
        }
        const rule = resolveRule(ownerId, row.symbol, edit.rule)
        if (!rule) {
          return holdingMissing(row.symbol)
        }
        const title = edit.title.trim() || null
        const ruleChanged = !sameRule(ruleOf(row), rule)
        if (!ruleChanged && title === row.title) {
          return { ok: true, alert: toAlert(row) }
        }
        const saved = save(
          row,
          ruleChanged
            ? {
                title,
                ...ruleColumns(rule),
                rule_revision: row.rule_revision + 1,
              }
            : { title }
        )
        if (ruleChanged) {
          enqueueRuleMessage(saved)
        }
        return { ok: true, alert: toAlert(saved) }
      })
    },
    pause(ownerId, id) {
      return transaction((): AlertResult => {
        const row = ownedRow(ownerId, id)
        if (!row) {
          return NOT_FOUND
        }
        if (row.state === "paused") {
          return { ok: true, alert: toAlert(row) }
        }
        const saved = save(row, { state: "paused" })
        enqueueRuleMessage(saved)
        return { ok: true, alert: toAlert(saved) }
      })
    },
    resume(ownerId, id) {
      return transaction((): AlertResult => {
        const row = ownedRow(ownerId, id)
        if (!row) {
          return NOT_FOUND
        }
        if (row.state === "active") {
          return { ok: true, alert: toAlert(row) }
        }
        // A Private Rule follows its Holding: check it still exists and use
        // today's Price Paid, as a new Rule Revision if it changed.
        const current = ruleOf(row)
        let changes: Partial<AlertRow> = { state: "active" }
        if (current.kind === "price" && current.source === "price_paid") {
          const rule = resolveRule(ownerId, row.symbol, {
            kind: "price",
            direction: current.direction,
            threshold: { source: "price_paid" },
          })
          if (!rule) {
            return holdingMissing(row.symbol)
          }
          if (!sameRule(current, rule)) {
            changes = {
              ...changes,
              ...ruleColumns(rule),
              rule_revision: row.rule_revision + 1,
            }
          }
        }
        const saved = save(row, changes)
        enqueueRuleMessage(saved)
        return { ok: true, alert: toAlert(saved) }
      })
    },
    delete(ownerId, id) {
      return transaction(() => {
        const row = ownedRow(ownerId, id)
        if (!row) {
          return NOT_FOUND
        }
        // A tombstone: the id stays taken, so a late retry of its create
        // cannot bring it back; everything the Owner wrote is cleared.
        deleteMatches.run(id)
        deletePauses.run(id)
        const tombstone = save(row, {
          state: "deleted",
          title: null,
          rule_kind: null,
          direction: null,
          threshold_source: null,
          threshold: null,
          percent: null,
        })
        enqueueRuleMessage(tombstone)
        return { ok: true } as const
      })
    },
    list(ownerId) {
      return (selectOwnerAlerts.all(ownerId) as unknown as AlertRow[]).map(
        toAlert
      )
    },
    get(ownerId, id) {
      const row = ownedRow(ownerId, id)
      return row ? toAlert(row) : null
    },
    publicView(id) {
      const row = selectPublic.get(id) as PublicAlertRow | undefined
      return row ? toPublicAlert(row) : null
    },
    outboxMessages() {
      return (selectOutbox.all() as { message: string }[]).map(
        (row) => JSON.parse(row.message) as RuleMessage
      )
    },
  }
}
