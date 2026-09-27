import { describe, expect, it } from "vitest"

import { formatPrice } from "./format-price"

describe("formatPrice", () => {
  it("uses the requested decimal places", () => {
    expect(formatPrice(7.5, 1)).toBe("7.5")
    expect(formatPrice(309.35, 2)).toBe("309.35")
    expect(formatPrice(1.1677, 4)).toBe("1.1677")
    expect(formatPrice(0.0000053, 8)).toBe("0.00000530")
  })
})
