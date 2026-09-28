import { DatabaseSync } from "node:sqlite"
import { describe, expect, it } from "vitest"

import type { AlertInput } from "@/lib/alert-rules"
import { createAlerts } from "./alerts"

const AVA = "person-ava"
const LIAM = "person-liam"

function setup() {
  const db = new DatabaseSync(":memory:")
  const pricesPaid = new Map<string, number>([
    [`${AVA}|AAPL`, 291.4],
    [`${AVA}|SHIB/USD`, 6.12e-6],
  ])
  let now = new Date("2026-09-28T09:00:00.000Z")
  const alerts = createAlerts({
    db,
    holdings: (personId, symbol) => {
      const pricePaid = pricesPaid.get(`${personId}|${symbol}`)
      return pricePaid === undefined ? null : { pricePaid }
    },
    now: () => now,
  })
  return {
    alerts,
    db,
    pricesPaid,
    advance(seconds: number) {
      now = new Date(now.getTime() + seconds * 1000)
    },
  }
}

let nextId = 0
function alertId(): string {
  nextId += 1
  return `a-test${String(nextId).padStart(18, "0")}`
}

function priceBelow(price: string, symbol = "AAPL"): AlertInput {
  return {
    symbol,
    title: "",
    rule: {
      kind: "price",
      direction: "below",
      threshold: { source: "typed", price },
    },
  }
}

describe("creating an Alert", () => {
  it("creates an Active Alert with a Price Rule at Rule Revision 1 and sends its rule", () => {
    const { alerts } = setup()
    const id = alertId()

    const result = alerts.create(AVA, id, priceBelow("300.00"))

    expect(result).toMatchObject({
      ok: true,
      alert: {
        id,
        symbol: "AAPL",
        instrumentName: "Apple Inc",
        state: "active",
        title: null,
        description: "AAPL goes below 300.00",
        rule: {
          kind: "price",
          direction: "below",
          source: "typed",
          threshold: "300",
        },
        ruleRevision: 1,
        version: 1,
        latestMatch: null,
      },
    })
    expect(alerts.outboxMessages()).toEqual([
      {
        alert_id: id,
        version: 1,
        rule_revision: 1,
        person_id: AVA,
        symbol: "AAPL",
        state: "active",
        rule: { kind: "price", direction: "below", threshold: "300" },
      },
    ])
  })
})

describe("creating an Alert twice with the same id", () => {
  it("returns the existing Alert and sends its rule once", () => {
    const { alerts } = setup()
    const id = alertId()
    const first = alerts.create(AVA, id, priceBelow("300"))

    const retry = alerts.create(AVA, id, priceBelow("250"))

    expect(retry).toEqual(first)
    expect(alerts.list(AVA)).toHaveLength(1)
    expect(alerts.outboxMessages()).toHaveLength(1)
  })

  it("refuses an id another Owner already uses, revealing nothing", () => {
    const { alerts } = setup()
    const id = alertId()
    alerts.create(AVA, id, priceBelow("300"))

    const result = alerts.create(LIAM, id, priceBelow("250"))

    expect(result).toEqual({ ok: false, error: { code: "id_unavailable" } })
    expect(alerts.list(LIAM)).toEqual([])
    expect(alerts.outboxMessages()).toHaveLength(1)
  })

  it("refuses an id that is not a generated Alert id", () => {
    const { alerts } = setup()

    const result = alerts.create(AVA, "1", priceBelow("300"))

    expect(result).toEqual({ ok: false, error: { code: "id_unavailable" } })
    expect(alerts.outboxMessages()).toEqual([])
  })
})

function percentage(
  direction: "rises" | "falls",
  percent: string,
  symbol = "BTC/USD"
): AlertInput {
  return { symbol, title: "", rule: { kind: "percentage", direction, percent } }
}

function fieldErrorsOf(
  result: ReturnType<ReturnType<typeof setup>["alerts"]["create"]>
) {
  if (result.ok || result.error.code !== "invalid") {
    throw new Error(`expected invalid, got ${JSON.stringify(result)}`)
  }
  return result.error.fieldErrors
}

describe("validating a Rule", () => {
  it.each([
    ["0", "AAPL"],
    ["0.00", "AAPL"],
    ["-5", "AAPL"],
    ["abc", "AAPL"],
    ["", "AAPL"],
    ["1e3", "AAPL"],
    ["300.123", "AAPL"],
    ["0.000000001", "SHIB/USD"],
  ])("refuses price %j on %s", (price, symbol) => {
    const { alerts } = setup()

    const result = alerts.create(AVA, alertId(), priceBelow(price, symbol))

    expect(Object.keys(fieldErrorsOf(result))).toEqual(["rule.threshold.price"])
    expect(alerts.outboxMessages()).toEqual([])
  })

  it.each([
    ["300.12", "AAPL"],
    ["300.120", "AAPL"],
    ["0.00000612", "SHIB/USD"],
  ])("accepts price %j on %s", (price, symbol) => {
    const { alerts } = setup()

    expect(alerts.create(AVA, alertId(), priceBelow(price, symbol)).ok).toBe(
      true
    )
  })

  it.each([
    ["falls", "0"],
    ["falls", "100"],
    ["rises", "0"],
    ["rises", "1000.01"],
    ["rises", "abc"],
  ] as const)("refuses %s by %j%%", (direction, percent) => {
    const { alerts } = setup()

    const result = alerts.create(AVA, alertId(), percentage(direction, percent))

    expect(Object.keys(fieldErrorsOf(result))).toEqual(["rule.percent"])
  })

  it.each([
    ["falls", "99.99"],
    ["falls", "0.5"],
    ["rises", "1000"],
  ] as const)("accepts %s by %j%%", (direction, percent) => {
    const { alerts } = setup()

    expect(
      alerts.create(AVA, alertId(), percentage(direction, percent)).ok
    ).toBe(true)
  })

  it("accepts an Alert Title of 80 characters, trimmed, and refuses 81", () => {
    const { alerts } = setup()
    const eighty = "x".repeat(80)

    const accepted = alerts.create(AVA, alertId(), {
      ...priceBelow("300"),
      title: `  ${eighty}  `,
    })
    const refused = alerts.create(AVA, alertId(), {
      ...priceBelow("300"),
      title: "x".repeat(81),
    })

    expect(accepted).toMatchObject({ ok: true, alert: { title: eighty } })
    expect(Object.keys(fieldErrorsOf(refused))).toEqual(["title"])
  })

  it("treats a blank Alert Title as no title", () => {
    const { alerts } = setup()

    const result = alerts.create(AVA, alertId(), {
      ...priceBelow("300"),
      title: "   ",
    })

    expect(result).toMatchObject({ ok: true, alert: { title: null } })
  })

  it("refuses an unknown Symbol", () => {
    const { alerts } = setup()

    const result = alerts.create(AVA, alertId(), priceBelow("300", "NOPE"))

    expect(Object.keys(fieldErrorsOf(result))).toEqual(["symbol"])
  })
})

function belowWhatIPaid(symbol = "AAPL"): AlertInput {
  return {
    symbol,
    title: "",
    rule: {
      kind: "price",
      direction: "below",
      threshold: { source: "price_paid" },
    },
  }
}

describe("a Private Rule", () => {
  it("resolves Price Paid into a plain threshold when created", () => {
    const { alerts } = setup()
    const id = alertId()

    const result = alerts.create(AVA, id, belowWhatIPaid())

    expect(result).toMatchObject({
      ok: true,
      alert: {
        rule: { kind: "price", source: "price_paid", threshold: "291.4" },
        description: "AAPL goes below what you paid (291.40)",
      },
    })
    // Nothing in the message marks the threshold as private (ADR-0001).
    expect(alerts.outboxMessages()).toEqual([
      {
        alert_id: id,
        version: 1,
        rule_revision: 1,
        person_id: AVA,
        symbol: "AAPL",
        state: "active",
        rule: { kind: "price", direction: "below", threshold: "291.4" },
      },
    ])
  })

  it("resolves a tiny float Price Paid without float noise", () => {
    const { alerts } = setup()

    const result = alerts.create(AVA, alertId(), belowWhatIPaid("SHIB/USD"))

    expect(result).toMatchObject({
      ok: true,
      alert: {
        rule: { threshold: "0.00000612" },
        description: "SHIB/USD goes below what you paid (0.00000612)",
      },
    })
    expect(alerts.outboxMessages()[0].rule).toEqual({
      kind: "price",
      direction: "below",
      threshold: "0.00000612",
    })
  })

  it("is refused on an Instrument the Owner does not hold", () => {
    const { alerts } = setup()

    const result = alerts.create(LIAM, alertId(), belowWhatIPaid())

    expect(result).toEqual({
      ok: false,
      error: { code: "holding_missing", symbol: "AAPL" },
    })
    expect(alerts.outboxMessages()).toEqual([])
  })
})

// Stands in for the future Event Ingest: the only place a test writes to storage.
function seedMatch(
  db: DatabaseSync,
  alertIdValue: string,
  ruleRevision: number,
  matchedAt = "2026-09-28T08:59:00.000Z"
) {
  db.prepare(
    "INSERT INTO matches (event_id, alert_id, rule_revision, matched_at, price) VALUES (?, ?, ?, ?, ?)"
  ).run(
    `evt-${alertIdValue}-${matchedAt}`,
    alertIdValue,
    ruleRevision,
    matchedAt,
    "299.5"
  )
}

function created(
  result: ReturnType<ReturnType<typeof setup>["alerts"]["create"]>
) {
  if (!result.ok) {
    throw new Error(`expected ok, got ${JSON.stringify(result)}`)
  }
  return result.alert
}

describe("editing an Alert", () => {
  it("makes a new Rule Revision when the Rule changes, clearing its Matches", () => {
    const { alerts, db, advance } = setup()
    const alert = created(alerts.create(AVA, alertId(), priceBelow("300")))
    seedMatch(db, alert.id, 1)
    advance(60)

    const result = alerts.update(AVA, alert.id, 1, {
      title: "",
      rule: {
        kind: "price",
        direction: "above",
        threshold: { source: "typed", price: "320" },
      },
    })

    expect(result).toMatchObject({
      ok: true,
      alert: {
        ruleRevision: 2,
        version: 2,
        description: "AAPL goes above 320.00",
        latestMatch: null,
        updatedAt: "2026-09-28T09:01:00.000Z",
      },
    })
    expect(alerts.outboxMessages().at(-1)).toEqual({
      alert_id: alert.id,
      version: 2,
      rule_revision: 2,
      person_id: AVA,
      symbol: "AAPL",
      state: "active",
      rule: { kind: "price", direction: "above", threshold: "320" },
    })
  })

  it("changes only the version for a title-only edit, keeping Matches and sending nothing", () => {
    const { alerts, db } = setup()
    const alert = created(alerts.create(AVA, alertId(), priceBelow("300")))
    seedMatch(db, alert.id, 1)

    const result = alerts.update(AVA, alert.id, 1, {
      title: "retirement stop",
      rule: priceBelow("300").rule,
    })

    expect(result).toMatchObject({
      ok: true,
      alert: {
        title: "retirement stop",
        ruleRevision: 1,
        version: 2,
        latestMatch: { matchedAt: "2026-09-28T08:59:00.000Z", price: "299.5" },
      },
    })
    expect(alerts.outboxMessages()).toHaveLength(1)
  })

  it("changes nothing when saved unchanged, even with the number written differently", () => {
    const { alerts, advance } = setup()
    const alert = created(
      alerts.create(AVA, alertId(), { ...priceBelow("300"), title: "stop" })
    )
    advance(60)

    const result = alerts.update(AVA, alert.id, 1, {
      title: " stop ",
      rule: priceBelow("300.00").rule,
    })

    expect(result).toEqual({ ok: true, alert })
    expect(alerts.outboxMessages()).toHaveLength(1)
  })

  it("treats switching between Price Paid and a typed price as a new Rule, even at the same number", () => {
    const { alerts } = setup()
    const alert = created(alerts.create(AVA, alertId(), belowWhatIPaid()))

    const result = alerts.update(AVA, alert.id, 1, {
      title: "",
      rule: priceBelow("291.40").rule,
    })

    expect(result).toMatchObject({
      ok: true,
      alert: {
        ruleRevision: 2,
        version: 2,
        rule: { source: "typed", threshold: "291.4" },
        description: "AAPL goes below 291.40",
      },
    })
    expect(alerts.outboxMessages()).toHaveLength(2)
  })

  it("rejects an edit made from a stale version, returning the latest and writing nothing", () => {
    const { alerts } = setup()
    const alert = created(alerts.create(AVA, alertId(), priceBelow("300")))
    const latest = alerts.update(AVA, alert.id, 1, {
      title: "first tab",
      rule: priceBelow("300").rule,
    })

    const result = alerts.update(AVA, alert.id, 1, {
      title: "",
      rule: priceBelow("250").rule,
    })

    expect(latest.ok).toBe(true)
    expect(result).toEqual({
      ok: false,
      error: { code: "stale_version", latest: latest.ok && latest.alert },
    })
    expect(alerts.get(AVA, alert.id)).toMatchObject({
      version: 2,
      title: "first tab",
    })
    expect(alerts.outboxMessages()).toHaveLength(1)
  })

  it("refuses an invalid edit and writes nothing", () => {
    const { alerts } = setup()
    const alert = created(alerts.create(AVA, alertId(), priceBelow("300")))

    const result = alerts.update(AVA, alert.id, 1, {
      title: "",
      rule: priceBelow("300.123").rule,
    })

    expect(Object.keys(fieldErrorsOf(result))).toEqual(["rule.threshold.price"])
    expect(alerts.get(AVA, alert.id)).toEqual(alert)
  })

  it("refuses an edit to a Private Rule on an Instrument the Owner no longer holds", () => {
    const { alerts, pricesPaid } = setup()
    const alert = created(alerts.create(AVA, alertId(), priceBelow("300")))
    pricesPaid.delete(`${AVA}|AAPL`)

    const result = alerts.update(AVA, alert.id, 1, {
      title: "",
      rule: belowWhatIPaid().rule,
    })

    expect(result).toEqual({
      ok: false,
      error: { code: "holding_missing", symbol: "AAPL" },
    })
  })
})

describe("pausing and resuming", () => {
  it("pauses without a new Rule Revision, keeping Matches, and tells the Checking System", () => {
    const { alerts, db } = setup()
    const alert = created(alerts.create(AVA, alertId(), priceBelow("300")))
    seedMatch(db, alert.id, 1)

    const result = alerts.pause(AVA, alert.id)

    expect(result).toMatchObject({
      ok: true,
      alert: {
        state: "paused",
        ruleRevision: 1,
        version: 2,
        latestMatch: { price: "299.5" },
      },
    })
    expect(alerts.outboxMessages().at(-1)).toMatchObject({
      version: 2,
      rule_revision: 1,
      state: "paused",
      rule: { kind: "price", direction: "below", threshold: "300" },
    })
  })

  it("resumes without a new Rule Revision, keeping Matches", () => {
    const { alerts, db } = setup()
    const alert = created(alerts.create(AVA, alertId(), priceBelow("300")))
    seedMatch(db, alert.id, 1)
    alerts.pause(AVA, alert.id)

    const result = alerts.resume(AVA, alert.id)

    expect(result).toMatchObject({
      ok: true,
      alert: {
        state: "active",
        ruleRevision: 1,
        version: 3,
        latestMatch: { price: "299.5" },
      },
    })
    expect(alerts.outboxMessages().map((message) => message.state)).toEqual([
      "active",
      "paused",
      "active",
    ])
  })

  it("treats pausing a Paused Alert, or resuming an Active one, as a no-op", () => {
    const { alerts } = setup()
    const alert = created(alerts.create(AVA, alertId(), priceBelow("300")))

    const resumed = alerts.resume(AVA, alert.id)
    const paused = created(alerts.pause(AVA, alert.id))
    const pausedAgain = alerts.pause(AVA, alert.id)

    expect(resumed).toEqual({ ok: true, alert })
    expect(pausedAgain).toEqual({ ok: true, alert: paused })
    expect(alerts.outboxMessages()).toHaveLength(2)
  })

  it("resolves Price Paid again when resuming a Private Rule, making a new Rule Revision if it changed", () => {
    const { alerts, db, pricesPaid } = setup()
    const alert = created(alerts.create(AVA, alertId(), belowWhatIPaid()))
    alerts.pause(AVA, alert.id)
    seedMatch(db, alert.id, 1)
    pricesPaid.set(`${AVA}|AAPL`, 287.15)

    const result = alerts.resume(AVA, alert.id)

    expect(result).toMatchObject({
      ok: true,
      alert: {
        state: "active",
        ruleRevision: 2,
        version: 3,
        rule: { source: "price_paid", threshold: "287.15" },
        latestMatch: null,
      },
    })
    // One message for the combined change: resumed, with the new threshold.
    expect(alerts.outboxMessages()).toHaveLength(3)
    expect(alerts.outboxMessages().at(-1)).toMatchObject({
      version: 3,
      rule_revision: 2,
      state: "active",
      rule: { threshold: "287.15" },
    })
  })

  it("keeps the Rule Revision when a resumed Private Rule's Price Paid is unchanged", () => {
    const { alerts } = setup()
    const alert = created(alerts.create(AVA, alertId(), belowWhatIPaid()))
    alerts.pause(AVA, alert.id)

    expect(alerts.resume(AVA, alert.id)).toMatchObject({
      ok: true,
      alert: { state: "active", ruleRevision: 1, version: 3 },
    })
  })

  it("refuses to resume a Private Rule whose Holding is gone, leaving it Paused", () => {
    const { alerts, pricesPaid } = setup()
    const alert = created(alerts.create(AVA, alertId(), belowWhatIPaid()))
    const paused = created(alerts.pause(AVA, alert.id))
    pricesPaid.delete(`${AVA}|AAPL`)

    const result = alerts.resume(AVA, alert.id)

    expect(result).toEqual({
      ok: false,
      error: { code: "holding_missing", symbol: "AAPL" },
    })
    expect(alerts.get(AVA, alert.id)).toEqual(paused)
    expect(alerts.outboxMessages()).toHaveLength(2)
  })
})

describe("deleting an Alert", () => {
  it("tells the Checking System to forget it, and it is gone everywhere", () => {
    const { alerts, db } = setup()
    const alert = created(alerts.create(AVA, alertId(), priceBelow("300")))
    seedMatch(db, alert.id, 1)

    const result = alerts.delete(AVA, alert.id)

    expect(result).toEqual({ ok: true })
    expect(alerts.outboxMessages().at(-1)).toEqual({
      alert_id: alert.id,
      version: 2,
      rule_revision: 1,
      person_id: AVA,
      symbol: "AAPL",
      state: "deleted",
      rule: null,
    })
    expect(alerts.get(AVA, alert.id)).toBeNull()
    expect(alerts.list(AVA)).toEqual([])
    expect(alerts.pause(AVA, alert.id)).toEqual({
      ok: false,
      error: { code: "not_found" },
    })
    expect(alerts.delete(AVA, alert.id)).toEqual({
      ok: false,
      error: { code: "not_found" },
    })
    expect(alerts.outboxMessages()).toHaveLength(2)
  })

  it("cannot be brought back by a late retry of the original create", () => {
    const { alerts } = setup()
    const id = alertId()
    alerts.create(AVA, id, priceBelow("300"))
    alerts.delete(AVA, id)

    const retry = alerts.create(AVA, id, priceBelow("300"))

    expect(retry).toEqual({ ok: false, error: { code: "id_unavailable" } })
    expect(alerts.list(AVA)).toEqual([])
  })
})

describe("the public projection", () => {
  it("shows only public fields, described by the generated Rule Description", () => {
    const { alerts } = setup()
    const alert = created(
      alerts.create(AVA, alertId(), {
        ...priceBelow("300"),
        title: "bought 25 @ 280.00",
      })
    )

    const view = alerts.publicView(alert.id)

    expect(view).toEqual({
      symbol: "AAPL",
      instrumentName: "Apple Inc",
      description: "AAPL goes below 300.00",
      state: "active",
      latestMatch: null,
      checkedThrough: null,
    })
    const serialized = JSON.stringify(view)
    expect(serialized).not.toContain("bought")
    expect(serialized).not.toContain("280")
    expect(serialized).not.toContain("25")
    expect(serialized).not.toContain(AVA)
  })

  it("shows the state and the latest Match of the current Rule Revision", () => {
    const { alerts, db } = setup()
    const alert = created(
      alerts.create(AVA, alertId(), percentage("falls", "5"))
    )
    seedMatch(db, alert.id, 1, "2026-09-28T08:58:00.000Z")
    seedMatch(db, alert.id, 1, "2026-09-28T08:59:00.000Z")
    alerts.pause(AVA, alert.id)

    expect(alerts.publicView(alert.id)).toMatchObject({
      description: "BTC/USD falls 5% from today's open",
      state: "paused",
      latestMatch: { matchedAt: "2026-09-28T08:59:00.000Z", price: "299.5" },
    })
  })

  it("does not exist for a Private Rule (ADR-0002)", () => {
    const { alerts } = setup()
    const alert = created(
      alerts.create(AVA, alertId(), {
        ...belowWhatIPaid(),
        title: "bought 25 @ 280.00",
      })
    )

    expect(alerts.publicView(alert.id)).toBeNull()
  })

  it("does not exist for a deleted or unknown Alert", () => {
    const { alerts } = setup()
    const alert = created(alerts.create(AVA, alertId(), priceBelow("300")))
    alerts.delete(AVA, alert.id)

    expect(alerts.publicView(alert.id)).toBeNull()
    expect(alerts.publicView(alertId())).toBeNull()
  })
})

describe("Owner scoping", () => {
  const NOT_FOUND = { ok: false, error: { code: "not_found" } }

  function avasAlert() {
    const context = setup()
    const alert = created(
      context.alerts.create(AVA, alertId(), {
        ...priceBelow("300"),
        title: "ava's stop",
      })
    )
    return { ...context, alert }
  }

  it("answers another Owner exactly as it answers an id that does not exist", () => {
    const { alerts, alert } = avasAlert()
    const missing = alertId()
    const edit = { title: "", rule: priceBelow("250").rule }

    for (const id of [alert.id, missing]) {
      expect(alerts.get(LIAM, id)).toBeNull()
      expect(alerts.update(LIAM, id, 1, edit)).toEqual(NOT_FOUND)
      expect(alerts.pause(LIAM, id)).toEqual(NOT_FOUND)
      expect(alerts.resume(LIAM, id)).toEqual(NOT_FOUND)
      expect(alerts.delete(LIAM, id)).toEqual(NOT_FOUND)
    }
  })

  it("changes nothing when another Owner tries to change an Alert", () => {
    const { alerts, alert } = avasAlert()

    alerts.update(LIAM, alert.id, 1, {
      title: "",
      rule: priceBelow("250").rule,
    })
    alerts.pause(LIAM, alert.id)
    alerts.delete(LIAM, alert.id)
    const paused = created(alerts.pause(AVA, alert.id))
    alerts.resume(LIAM, alert.id)

    expect(alerts.get(AVA, alert.id)).toEqual(paused)
    expect(paused).toMatchObject({ version: 2, title: "ava's stop" })
    expect(alerts.outboxMessages()).toHaveLength(2)
  })

  it("lists only the caller's Alerts", () => {
    const { alerts, alert } = avasAlert()
    const liams = created(
      alerts.create(LIAM, alertId(), percentage("rises", "10"))
    )

    expect(alerts.list(AVA).map((each) => each.id)).toEqual([alert.id])
    expect(alerts.list(LIAM).map((each) => each.id)).toEqual([liams.id])
  })
})

describe("rule messages", () => {
  it("never carry the Alert Title, and each Alert's version only increases", () => {
    const { alerts } = setup()
    const title = "bought 25 @ 280.00"
    const first = created(
      alerts.create(AVA, alertId(), { ...priceBelow("300"), title })
    )
    const second = created(
      alerts.create(AVA, alertId(), { ...belowWhatIPaid(), title })
    )
    alerts.update(AVA, first.id, 1, {
      title: "renamed",
      rule: priceBelow("310").rule,
    })
    alerts.pause(AVA, first.id)
    alerts.resume(AVA, first.id)
    alerts.pause(AVA, second.id)
    alerts.delete(AVA, first.id)

    const messages = alerts.outboxMessages()

    expect(JSON.stringify(messages)).not.toMatch(/bought|renamed|price_paid/)
    for (const id of [first.id, second.id]) {
      const versions = messages
        .filter((m) => m.alert_id === id)
        .map((m) => m.version)
      expect(versions).toEqual([...versions].sort((a, b) => a - b))
      expect(new Set(versions).size).toBe(versions.length)
    }
  })

  it("describe a Percentage Rule against Today's Open", () => {
    const { alerts } = setup()

    alerts.create(LIAM, alertId(), percentage("rises", "2.50"))

    expect(alerts.outboxMessages()[0].rule).toEqual({
      kind: "percentage",
      direction: "rises",
      percent: "2.5",
      baseline: "todays_open",
    })
  })
})
