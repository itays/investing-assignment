import rawHoldings from "../data/holdings.json"

export interface Holding {
  person_id: string
  symbol: string
  quantity: number
  price_paid: number
}

const holdings: readonly Holding[] = rawHoldings

export function findHolding(personId: string, symbol: string): Holding | null {
  return (
    holdings.find(
      (holding) => holding.person_id === personId && holding.symbol === symbol
    ) ?? null
  )
}

export function holdingsOf(personId: string): Holding[] {
  return holdings.filter((holding) => holding.person_id === personId)
}
