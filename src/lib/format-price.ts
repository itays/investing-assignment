export function formatPrice(value: number, decimals: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
    useGrouping: false,
  }).format(value)
}
