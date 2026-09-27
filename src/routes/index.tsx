import { createFileRoute } from "@tanstack/react-router"

import { InstrumentFilter } from "@/components/instrument-filter"
import { InstrumentTable } from "@/components/instrument-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { loadInstruments } from "@/server/functions"

type InstrumentSearch = {
  q?: string
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): InstrumentSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q ?? "" }),
  loader: ({ deps }) => loadInstruments({ data: deps.q }),
  component: InstrumentIndex,
})

function InstrumentIndex() {
  const instruments = Route.useLoaderData()
  const { q = "" } = Route.useSearch()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-semibold">Instruments</h1>
        <p className="text-muted-foreground">
          Browse the available instruments and their latest quoted prices.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 border-b sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <CardTitle>All instruments</CardTitle>
            <CardDescription>
              {instruments.length}{" "}
              {instruments.length === 1 ? "result" : "results"}
            </CardDescription>
          </div>
          <InstrumentFilter query={q} />
        </CardHeader>
        <CardContent className="px-0">
          {instruments.length > 0 ? (
            <InstrumentTable instruments={instruments} />
          ) : (
            <p className="px-6 text-muted-foreground">
              No instruments match that search.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
