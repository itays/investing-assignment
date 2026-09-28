import { z } from "zod"

// Shared by the browser and the server: the shape of a Rule, its validation,
// and its Rule Description. Nothing here may read private data.

export type PriceDirection = "above" | "below"
export type PercentDirection = "rises" | "falls"

/** A Rule as the Owner writes it in the form. */
export type RuleInput =
  | {
      kind: "price"
      direction: PriceDirection
      threshold: { source: "typed"; price: string } | { source: "price_paid" }
    }
  | { kind: "percentage"; direction: PercentDirection; percent: string }

/** A Rule with its threshold resolved; Price Paid is already a number. */
export type Rule =
  | {
      kind: "price"
      direction: PriceDirection
      source: "typed" | "price_paid"
      threshold: string
    }
  | { kind: "percentage"; direction: PercentDirection; percent: string }

export interface AlertInput {
  symbol: string
  title: string
  rule: RuleInput
}

/** Field errors keyed by dotted path: "symbol", "title", "rule.threshold.price", "rule.threshold", "rule.percent". */
export type AlertFieldErrors = Record<string, string>

export const TITLE_MAX_LENGTH = 80

const ruleInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("price"),
    direction: z.enum(["above", "below"]),
    threshold: z.discriminatedUnion("source", [
      z.object({ source: z.literal("typed"), price: z.string() }),
      z.object({ source: z.literal("price_paid") }),
    ]),
  }),
  z.object({
    kind: z.literal("percentage"),
    direction: z.enum(["rises", "falls"]),
    percent: z.string(),
  }),
])

/** The structural shape only: what a server function accepts over the wire. */
export const alertInputSchema = z.object({
  symbol: z.string(),
  title: z.string(),
  rule: ruleInputSchema,
})

/**
 * The full Rule schema for one Instrument: the shape plus every limit that
 * depends on it. Used by the form for feedback and by the server as the authority.
 */
export function alertSchemaFor(decimals: number): z.ZodType<AlertInput> {
  return alertInputSchema.superRefine((input, context) => {
    const report = (path: string[], message: string | null) => {
      if (message) {
        context.addIssue({ code: "custom", path, message })
      }
    }
    if ([...input.title.trim()].length > TITLE_MAX_LENGTH) {
      report(
        ["title"],
        `Keep the title to ${TITLE_MAX_LENGTH} characters or fewer`
      )
    }
    const { rule } = input
    if (rule.kind === "price" && rule.threshold.source === "typed") {
      report(
        ["rule", "threshold", "price"],
        priceProblem(rule.threshold.price.trim(), decimals)
      )
    }
    if (rule.kind === "percentage") {
      report(
        ["rule", "percent"],
        percentProblem(rule.percent.trim(), rule.direction)
      )
    }
  })
}

const PLAIN_DECIMAL = /^\d+(\.\d+)?$/
const PERCENT_DECIMALS = 2

function fractionDigits(value: string): number {
  return normaliseDecimal(value).split(".")[1]?.length ?? 0
}

function priceProblem(price: string, decimals: number): string | null {
  if (!price) {
    return "Enter a price"
  }
  if (!PLAIN_DECIMAL.test(price)) {
    return "Enter a price as a number, like 300.50"
  }
  if (normaliseDecimal(price) === "0") {
    return "Enter a price above 0"
  }
  if (fractionDigits(price) > decimals) {
    return decimals === 0
      ? "This instrument is priced in whole numbers"
      : `This instrument is priced to ${decimals} decimal places`
  }
  return null
}

function percentProblem(
  percent: string,
  direction: PercentDirection
): string | null {
  if (!percent) {
    return "Enter a percentage"
  }
  if (!PLAIN_DECIMAL.test(percent)) {
    return "Enter a percentage as a number, like 5 or 2.5"
  }
  if (fractionDigits(percent) > PERCENT_DECIMALS) {
    return `Use at most ${PERCENT_DECIMALS} decimal places`
  }
  const value = Number(percent)
  if (value === 0) {
    return "Enter a percentage above 0"
  }
  if (direction === "falls" && value >= 100) {
    return "A fall must be less than 100%"
  }
  if (direction === "rises" && value > 1000) {
    return "A rise can be at most 1000%"
  }
  return null
}

export function toFieldErrors(error: z.ZodError): AlertFieldErrors {
  const fieldErrors: AlertFieldErrors = {}
  for (const issue of error.issues) {
    const path = issue.path.join(".")
    fieldErrors[path] ??= issue.message
  }
  return fieldErrors
}

/** A float (as the Holdings service stores Price Paid) as a plain decimal string: 6.12e-6 → "0.00000612". */
const fromFloat = new Intl.NumberFormat("en-US", {
  useGrouping: false,
  maximumSignificantDigits: 15,
})

export function decimalFromNumber(value: number): string {
  return fromFloat.format(value)
}

/** "5.00" → "5", "0070.50" → "70.5". Input must be a plain decimal string. */
export function normaliseDecimal(value: string): string {
  const [whole, fraction = ""] = value.trim().split(".")
  const normalisedWhole = whole.replace(/^0+(?=\d)/, "")
  const normalisedFraction = fraction.replace(/0+$/, "")
  return normalisedFraction
    ? `${normalisedWhole}.${normalisedFraction}`
    : normalisedWhole
}

/** Pads or keeps a decimal string to the Instrument's decimals: ("291.4", 2) → "291.40". */
export function formatDecimal(value: string, decimals: number): string {
  const [whole, fraction = ""] = normaliseDecimal(value).split(".")
  const padded = fraction.padEnd(decimals, "0")
  return padded ? `${whole}.${padded}` : whole
}

/** The Owner's Rule Description, e.g. "AAPL goes below what you paid (291.40)". */
export function describeRule(
  symbol: string,
  rule: Rule,
  decimals: number
): string {
  if (rule.kind === "price") {
    const threshold = formatDecimal(rule.threshold, decimals)
    return rule.source === "price_paid"
      ? `${symbol} goes ${rule.direction} what you paid (${threshold})`
      : `${symbol} goes ${rule.direction} ${threshold}`
  }
  return `${symbol} ${rule.direction} ${normaliseDecimal(rule.percent)}% from today's open`
}

/** The public Rule Description; null for a Private Rule, which has none. */
export function describePublicRule(
  symbol: string,
  rule: Rule,
  decimals: number
): string | null {
  if (rule.kind === "price" && rule.source === "price_paid") {
    return null
  }
  return describeRule(symbol, rule, decimals)
}

const ALERT_ID = /^a-[A-Za-z0-9_-]{22}$/

/** A new Alert id: "a-" followed by 128 random bits, base64url. */
export function newAlertId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const base64 = btoa(String.fromCharCode(...bytes))
  return `a-${base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}`
}

export function isAlertId(value: string): boolean {
  return ALERT_ID.test(value)
}
