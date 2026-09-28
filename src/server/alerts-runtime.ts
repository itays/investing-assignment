import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { env } from "node:process"
import { DatabaseSync } from "node:sqlite"

import { type Alerts, createAlerts } from "./alerts"
import { findHolding } from "./holdings"
import { requireCurrentPerson } from "./session"

// One alerts module per server process, over the database file.

const DEFAULT_DATABASE_PATH = "data/alerts.db"

let alerts: Alerts | undefined

function getAlerts(): Alerts {
  if (!alerts) {
    const path = env.DATABASE_PATH || DEFAULT_DATABASE_PATH
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true })
    }
    const db = new DatabaseSync(path)
    db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;")
    alerts = createAlerts({
      db,
      holdings: (personId, symbol) => {
        const holding = findHolding(personId, symbol)
        return holding ? { pricePaid: holding.price_paid } : null
      },
      now: () => new Date(),
    })
  }
  return alerts
}

/**
 * The only way a server function reaches Alerts: the Owner comes from the
 * session, never from the request, and a signed-out request is redirected.
 */
export function ownerScope(): { ownerId: string; alerts: Alerts } {
  return { ownerId: requireCurrentPerson().id, alerts: getAlerts() }
}
