import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { alertInputSchema, decimalFromNumber } from "@/lib/alert-rules"
import type { Alert, AlertResult } from "./alerts"
import type { Instrument } from "./instruments"
import type { Person } from "./people"

export const loadInstruments = createServerFn({ method: "GET" })
  .validator((query: string) => query)
  .handler(async ({ data }): Promise<Instrument[]> => {
    const { filterInstruments } = await import("./instruments")
    return filterInstruments(data)
  })

export const loadInstrument = createServerFn({ method: "GET" })
  .validator((symbol: string) => symbol)
  .handler(async ({ data }): Promise<Instrument | null> => {
    const { getInstrumentBySymbol } = await import("./instruments")
    return getInstrumentBySymbol(data)
  })

export const loadCurrentPerson = createServerFn({ method: "POST" }).handler(
  async (): Promise<Person | null> => {
    const { getCurrentPerson } = await import("./session")
    return getCurrentPerson()
  }
)

export const loadPeople = createServerFn({ method: "GET" }).handler(
  async (): Promise<Person[]> => {
    const { PEOPLE } = await import("./people")
    return [...PEOPLE]
  }
)

export const selectPerson = createServerFn({ method: "POST" })
  .validator((personId: string) => personId)
  .handler(async ({ data }): Promise<Person> => {
    const { signIn } = await import("./session")
    return signIn(data)
  })

export const clearPerson = createServerFn({ method: "POST" }).handler(
  async (): Promise<boolean> => {
    const { signOut } = await import("./session")
    signOut()
    return true
  }
)

const alertIdSchema = z.string().min(1).max(64)

export interface AlertFormContext {
  instruments: Pick<
    Instrument,
    "symbol" | "name" | "decimals" | "last_price" | "currency"
  >[]
  /** The Owner's own Price Paid per Symbol they hold, as decimal strings. */
  pricesPaid: Record<string, string>
}

export const loadAlerts = createServerFn({ method: "GET" }).handler(
  async (): Promise<Alert[]> => {
    const { ownerScope } = await import("./alerts-runtime")
    const { ownerId, alerts } = ownerScope()
    return alerts.list(ownerId)
  }
)

export const loadAlert = createServerFn({ method: "GET" })
  .validator(alertIdSchema)
  .handler(async ({ data }): Promise<Alert | null> => {
    const { ownerScope } = await import("./alerts-runtime")
    const { ownerId, alerts } = ownerScope()
    return alerts.get(ownerId, data)
  })

export const loadAlertFormContext = createServerFn({ method: "GET" }).handler(
  async (): Promise<AlertFormContext> => {
    const { ownerScope } = await import("./alerts-runtime")
    const { holdingsOf } = await import("./holdings")
    const { filterInstruments } = await import("./instruments")
    const { ownerId } = ownerScope()
    return {
      instruments: filterInstruments("").map(
        ({ symbol, name, decimals, last_price, currency }) => ({
          symbol,
          name,
          decimals,
          last_price,
          currency,
        })
      ),
      pricesPaid: Object.fromEntries(
        holdingsOf(ownerId).map((holding) => [
          holding.symbol,
          decimalFromNumber(holding.price_paid),
        ])
      ),
    }
  }
)

export const createAlert = createServerFn({ method: "POST" })
  .validator(z.object({ id: alertIdSchema, input: alertInputSchema }))
  .handler(async ({ data }): Promise<AlertResult> => {
    const { ownerScope } = await import("./alerts-runtime")
    const { ownerId, alerts } = ownerScope()
    return alerts.create(ownerId, data.id, data.input)
  })

export const updateAlert = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: alertIdSchema,
      version: z.number().int(),
      edit: alertInputSchema.pick({ title: true, rule: true }),
    })
  )
  .handler(async ({ data }): Promise<AlertResult> => {
    const { ownerScope } = await import("./alerts-runtime")
    const { ownerId, alerts } = ownerScope()
    return alerts.update(ownerId, data.id, data.version, data.edit)
  })

export const pauseAlert = createServerFn({ method: "POST" })
  .validator(alertIdSchema)
  .handler(async ({ data }): Promise<AlertResult> => {
    const { ownerScope } = await import("./alerts-runtime")
    const { ownerId, alerts } = ownerScope()
    return alerts.pause(ownerId, data)
  })

export const resumeAlert = createServerFn({ method: "POST" })
  .validator(alertIdSchema)
  .handler(async ({ data }): Promise<AlertResult> => {
    const { ownerScope } = await import("./alerts-runtime")
    const { ownerId, alerts } = ownerScope()
    return alerts.resume(ownerId, data)
  })

export const deleteAlert = createServerFn({ method: "POST" })
  .validator(alertIdSchema)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { ownerScope } = await import("./alerts-runtime")
    const { ownerId, alerts } = ownerScope()
    return alerts.delete(ownerId, data)
  })
