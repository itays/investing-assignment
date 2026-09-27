import { createServerFn } from "@tanstack/react-start"

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
