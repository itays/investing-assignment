import rawInstruments from "../data/instruments.json"

type AssetClass = "bond" | "commodity" | "currency" | "etf" | "index" | "share"

export interface Instrument {
  symbol: string
  name: string
  asset_class: AssetClass
  exchange: string
  currency: string | null
  decimals: number
  last_price: number
}

const instruments: readonly Instrument[] = rawInstruments.map((instrument) => ({
  symbol: instrument.symbol,
  name: instrument.name,
  asset_class: instrument.asset_class as AssetClass,
  exchange: instrument.exchange,
  currency: instrument.currency,
  decimals: instrument.decimals,
  last_price: instrument.last_price,
}))

export function filterInstruments(query: string): Instrument[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return [...instruments]
  }

  return instruments.filter(
    (instrument) =>
      instrument.symbol.toLowerCase().includes(normalizedQuery) ||
      instrument.name.toLowerCase().includes(normalizedQuery)
  )
}

export function getInstrumentBySymbol(symbol: string): Instrument | null {
  return instruments.find((instrument) => instrument.symbol === symbol) ?? null
}
