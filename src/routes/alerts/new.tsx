import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useRef } from "react"

import {
  AlertForm,
  type AlertFormFeedback,
  emptyAlertValues,
} from "@/components/alert-form"
import { type AlertInput, newAlertId } from "@/lib/alert-rules"
import type { AlertFormContext } from "@/server/functions"
import { createAlert, loadAlertFormContext } from "@/server/functions"

type NewAlertSearch = {
  symbol?: string
}

export const Route = createFileRoute("/alerts/new")({
  validateSearch: (search: Record<string, unknown>): NewAlertSearch => ({
    symbol: typeof search.symbol === "string" ? search.symbol : undefined,
  }),
  loader: () => loadAlertFormContext(),
  component: NewAlertPage,
})

function NewAlertPage() {
  const context = Route.useLoaderData()
  const { symbol } = Route.useSearch()
  const initialSymbol = context.instruments.some(
    (instrument) => instrument.symbol === symbol
  )
    ? (symbol ?? "")
    : ""

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-heading text-3xl font-semibold">New alert</h1>
      <NewAlertForm
        key={initialSymbol}
        context={context}
        initialSymbol={initialSymbol}
      />
    </div>
  )
}

function NewAlertForm({
  context,
  initialSymbol,
}: {
  context: AlertFormContext
  initialSymbol: string
}) {
  const navigate = useNavigate()
  const create = useServerFn(createAlert)
  // One id per form, sent with every attempt, so a retry can't create a second Alert.
  const alertId = useRef<string | null>(null)

  const handleSubmit = async (
    input: AlertInput
  ): Promise<AlertFormFeedback | undefined> => {
    alertId.current ??= newAlertId()
    const result = await create({ data: { id: alertId.current, input } })
    if (result.ok) {
      await navigate({ to: "/alerts" })
      return undefined
    }
    switch (result.error.code) {
      case "invalid":
        return { fieldErrors: result.error.fieldErrors }
      case "holding_missing":
        return {
          fieldErrors: {
            "rule.threshold": `You don't hold ${result.error.symbol}`,
          },
        }
      default:
        // The id can't be used (it belongs to something else): start over with a new one.
        alertId.current = newAlertId()
        return { formError: "Couldn't create this alert. Please try again." }
    }
  }

  return (
    <AlertForm
      context={context}
      initialValues={emptyAlertValues(initialSymbol)}
      submitLabel="Create alert"
      onSubmit={handleSubmit}
    />
  )
}
