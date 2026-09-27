import { describe, expect, it } from "vitest"

import { filterInstruments, getInstrumentBySymbol } from "./instruments"

describe("instrument data", () => {
  it("loads the fixture and looks up symbols", () => {
    expect(filterInstruments("")).toHaveLength(88)
    expect(getInstrumentBySymbol("EUR/USD")).toMatchObject({
      name: "Euro US Dollar",
      decimals: 4,
    })
    expect(getInstrumentBySymbol("UNKNOWN")).toBeNull()
  })
})
