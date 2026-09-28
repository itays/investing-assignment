import { type FormEvent, type ReactNode, useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  type AlertFieldErrors,
  type AlertInput,
  alertSchemaFor,
  describeRule,
  formatDecimal,
  type PercentDirection,
  type PriceDirection,
  type Rule,
  toFieldErrors,
} from "@/lib/alert-rules"
import { formatPrice } from "@/lib/format-price"
import type { Alert } from "@/server/alerts"
import type { AlertFormContext } from "@/server/functions"

export interface AlertFormValues {
  symbol: string
  kind: "price" | "percentage"
  priceDirection: PriceDirection
  percentDirection: PercentDirection
  source: "typed" | "price_paid"
  price: string
  percent: string
  title: string
}

/** What the page tells the form after a submit that didn't leave it. */
export interface AlertFormFeedback {
  fieldErrors?: AlertFieldErrors
  formError?: string
}

export function emptyAlertValues(symbol: string): AlertFormValues {
  return {
    symbol,
    kind: "price",
    priceDirection: "above",
    percentDirection: "rises",
    source: "typed",
    price: "",
    percent: "",
    title: "",
  }
}

export function alertValuesFrom(alert: Alert): AlertFormValues {
  const values = emptyAlertValues(alert.symbol)
  values.title = alert.title ?? ""
  const { rule } = alert
  if (rule.kind === "price") {
    values.kind = "price"
    values.priceDirection = rule.direction
    values.source = rule.source
    values.price = rule.source === "typed" ? rule.threshold : ""
  } else {
    values.kind = "percentage"
    values.percentDirection = rule.direction
    values.percent = rule.percent
  }
  return values
}

type FieldKey =
  | "symbol"
  | "title"
  | "rule.threshold.price"
  | "rule.threshold"
  | "rule.percent"

const FIELD_KEYS: readonly string[] = [
  "symbol",
  "title",
  "rule.threshold.price",
  "rule.threshold",
  "rule.percent",
] satisfies FieldKey[]

type AlertFormProps = {
  context: AlertFormContext
  initialValues: AlertFormValues
  /** Edit mode: the Instrument can't change, so it is shown as text. */
  lockedSymbol?: boolean
  submitLabel: string
  onSubmit: (input: AlertInput) => Promise<AlertFormFeedback | undefined>
}

export function AlertForm({
  context,
  initialValues,
  lockedSymbol = false,
  submitLabel,
  onSubmit,
}: AlertFormProps) {
  const id = useId()
  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<AlertFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)

  const instrument = context.instruments.find(
    (candidate) => candidate.symbol === values.symbol
  )
  const decimals = instrument?.decimals ?? 2
  const pricePaid = context.pricesPaid[values.symbol]
  // "What I paid" is only offered for an Instrument the Owner holds.
  const source = pricePaid ? values.source : "typed"
  const input = toInput(values, source)
  const parsed = alertSchemaFor(decimals).safeParse(input)
  const clientErrors: AlertFieldErrors = parsed.success
    ? {}
    : toFieldErrors(parsed.error)
  if (!instrument && !clientErrors.symbol) {
    clientErrors.symbol = "Choose an instrument"
  }
  const preview =
    parsed.success && instrument
      ? previewRule(parsed.data, pricePaid, decimals)
      : null

  const errorFor = (key: FieldKey): string | undefined =>
    serverErrors[key] ??
    (submitted || touched.has(key) ? clientErrors[key] : undefined)

  const otherErrors = submitted
    ? Object.entries({ ...clientErrors, ...serverErrors })
        .filter(([key]) => !FIELD_KEYS.includes(key))
        .map(([, message]) => message)
    : []

  const update = (patch: Partial<AlertFormValues>) => {
    setValues((current) => ({ ...current, ...patch }))
    setServerErrors({})
    setFormError(null)
  }
  const touch = (key: FieldKey) => {
    setTouched((current) =>
      current.has(key) ? current : new Set(current).add(key)
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pendingRef.current) {
      return
    }
    setSubmitted(true)
    setServerErrors({})
    setFormError(null)
    if (!parsed.success || !instrument) {
      return
    }
    pendingRef.current = true
    setPending(true)
    try {
      const feedback = await onSubmit(input)
      if (feedback?.fieldErrors) {
        setServerErrors(feedback.fieldErrors)
      }
      if (feedback?.formError) {
        setFormError(feedback.formError)
      }
    } catch {
      setFormError("Couldn't save this alert. Please try again.")
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  const fieldId = (name: string) => `${id}-${name}`
  const symbolError = errorFor("symbol")
  const priceError = errorFor("rule.threshold.price")
  const thresholdError = errorFor("rule.threshold")
  const percentError = errorFor("rule.percent")
  const titleError = errorFor("title")

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(event)}>
      <FieldGroup>
        {lockedSymbol ? (
          <Field>
            <p className="text-sm font-medium">Instrument</p>
            <p className="text-base">
              {instrument
                ? `${instrument.symbol} — ${instrument.name}`
                : values.symbol}
            </p>
          </Field>
        ) : (
          <Field data-invalid={symbolError ? true : undefined}>
            <FieldLabel htmlFor={fieldId("symbol")}>Instrument</FieldLabel>
            <NativeSelect
              id={fieldId("symbol")}
              className="w-full max-w-md"
              value={values.symbol}
              aria-invalid={symbolError ? true : undefined}
              aria-describedby={
                symbolError ? fieldId("symbol-error") : undefined
              }
              onChange={(event) => {
                update({ symbol: event.target.value })
                touch("symbol")
              }}
              onBlur={() => touch("symbol")}
            >
              {instrument ? null : (
                <NativeSelectOption value="">
                  Choose an instrument
                </NativeSelectOption>
              )}
              {context.instruments.map((candidate) => (
                <NativeSelectOption
                  key={candidate.symbol}
                  value={candidate.symbol}
                >
                  {candidate.symbol} — {candidate.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError id={fieldId("symbol-error")}>{symbolError}</FieldError>
          </Field>
        )}

        <ChoiceGroup
          label="Rule kind"
          name={fieldId("kind")}
          value={values.kind}
          options={[
            { value: "price", label: "Price" },
            { value: "percentage", label: "Percentage" },
          ]}
          onChange={(kind) => update({ kind })}
        />

        {values.kind === "price" ? (
          <>
            <ChoiceGroup
              label="Direction"
              name={fieldId("price-direction")}
              value={values.priceDirection}
              options={[
                { value: "above", label: "Goes above" },
                { value: "below", label: "Goes below" },
              ]}
              onChange={(priceDirection) => update({ priceDirection })}
            />
            <ChoiceGroup
              label="Threshold"
              name={fieldId("source")}
              value={source}
              options={[
                { value: "typed", label: "A price" },
                ...(pricePaid
                  ? [
                      {
                        value: "price_paid" as const,
                        label: `What I paid (${formatDecimal(pricePaid, decimals)})`,
                      },
                    ]
                  : []),
              ]}
              onChange={(nextSource) => {
                update({ source: nextSource })
                touch("rule.threshold")
              }}
              error={thresholdError}
              errorId={fieldId("threshold-error")}
            />
            {source === "typed" ? (
              <Field data-invalid={priceError ? true : undefined}>
                <FieldLabel htmlFor={fieldId("price")}>Price</FieldLabel>
                <Input
                  id={fieldId("price")}
                  className="max-w-xs"
                  inputMode="decimal"
                  autoComplete="off"
                  value={values.price}
                  aria-invalid={priceError ? true : undefined}
                  aria-describedby={
                    priceError ? fieldId("price-error") : undefined
                  }
                  onChange={(event) => update({ price: event.target.value })}
                  onBlur={() => touch("rule.threshold.price")}
                />
                {instrument ? <LastPrice instrument={instrument} /> : null}
                <FieldError id={fieldId("price-error")}>
                  {priceError}
                </FieldError>
              </Field>
            ) : null}
          </>
        ) : (
          <>
            <ChoiceGroup
              label="Direction"
              name={fieldId("percent-direction")}
              value={values.percentDirection}
              options={[
                { value: "rises", label: "Rises by" },
                { value: "falls", label: "Falls by" },
              ]}
              onChange={(percentDirection) => update({ percentDirection })}
            />
            <Field data-invalid={percentError ? true : undefined}>
              <FieldLabel htmlFor={fieldId("percent")}>Percent</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  id={fieldId("percent")}
                  className="max-w-32"
                  inputMode="decimal"
                  autoComplete="off"
                  value={values.percent}
                  aria-invalid={percentError ? true : undefined}
                  aria-describedby={
                    percentError
                      ? `${fieldId("percent-suffix")} ${fieldId("percent-error")}`
                      : fieldId("percent-suffix")
                  }
                  onChange={(event) => update({ percent: event.target.value })}
                  onBlur={() => touch("rule.percent")}
                />
                <span
                  id={fieldId("percent-suffix")}
                  className="text-sm text-muted-foreground"
                >
                  % from today's open
                </span>
              </div>
              <FieldError id={fieldId("percent-error")}>
                {percentError}
              </FieldError>
            </Field>
          </>
        )}

        <Field data-invalid={titleError ? true : undefined}>
          <FieldLabel htmlFor={fieldId("title")}>
            Alert title (optional)
          </FieldLabel>
          <Input
            id={fieldId("title")}
            className="max-w-md"
            autoComplete="off"
            value={values.title}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={
              titleError
                ? `${fieldId("title-hint")} ${fieldId("title-error")}`
                : fieldId("title-hint")
            }
            onChange={(event) => update({ title: event.target.value })}
            onBlur={() => touch("title")}
          />
          <FieldDescription id={fieldId("title-hint")}>
            Only you see this. It helps you find this alert later.
          </FieldDescription>
          <FieldError id={fieldId("title-error")}>{titleError}</FieldError>
        </Field>

        <div aria-live="polite" className="min-h-6">
          {preview ? (
            <p className="rounded-2xl bg-muted px-4 py-3 text-sm">
              <span className="text-muted-foreground">Rule: </span>
              <span className="font-medium">{preview}</span>
            </p>
          ) : null}
        </div>

        {formError || otherErrors.length > 0 ? (
          <div role="alert" className="text-sm text-destructive">
            {formError ? <p>{formError}</p> : null}
            {otherErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}

        <div>
          <Button type="submit" disabled={pending}>
            {submitLabel}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}

function LastPrice({
  instrument,
}: {
  instrument: AlertFormContext["instruments"][number]
}) {
  return (
    <p className="text-sm text-muted-foreground tabular-nums">
      Last price {formatPrice(instrument.last_price, instrument.decimals)}
    </p>
  )
}

type ChoiceGroupProps<T extends string> = {
  label: string
  name: string
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (value: T) => void
  error?: string
  errorId?: string
}

/** A labelled radio group of native radios, so its roles and names are the platform's. */
function ChoiceGroup<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
  error,
  errorId,
}: ChoiceGroupProps<T>) {
  const labelId = `${name}-label`
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      className="flex flex-col gap-2"
    >
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="size-4 accent-primary"
            />
            {option.label}
          </label>
        ))}
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
}

function toInput(
  values: AlertFormValues,
  source: AlertFormValues["source"]
): AlertInput {
  return {
    symbol: values.symbol,
    title: values.title,
    rule:
      values.kind === "price"
        ? {
            kind: "price",
            direction: values.priceDirection,
            threshold:
              source === "typed"
                ? { source: "typed", price: values.price }
                : { source: "price_paid" },
          }
        : {
            kind: "percentage",
            direction: values.percentDirection,
            percent: values.percent,
          },
  }
}

/** The Owner's Rule Description of what the form holds right now. */
function previewRule(
  input: AlertInput,
  pricePaid: string | undefined,
  decimals: number
): string | null {
  const { rule } = input
  let resolved: Rule
  if (rule.kind === "percentage") {
    resolved = rule
  } else if (rule.threshold.source === "typed") {
    resolved = {
      kind: "price",
      direction: rule.direction,
      source: "typed",
      threshold: rule.threshold.price,
    }
  } else if (pricePaid) {
    resolved = {
      kind: "price",
      direction: rule.direction,
      source: "price_paid",
      threshold: pricePaid,
    }
  } else {
    return null
  }
  return describeRule(input.symbol, resolved, decimals)
}
