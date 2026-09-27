import { createFileRoute, Link } from "@tanstack/react-router"

import { InstrumentDetail } from "@/components/instrument-detail"
import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { loadInstrument } from "@/server/functions"

export const Route = createFileRoute("/instruments/$symbol")({
  loader: ({ params }) => loadInstrument({ data: params.symbol }),
  component: InstrumentPage,
})

function InstrumentPage() {
  const { symbol } = Route.useParams()
  const instrument = Route.useLoaderData()

  if (!instrument) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            <h1>Instrument not found</h1>
          </EmptyTitle>
          <EmptyDescription>
            No instrument matches{" "}
            <span className="font-medium text-foreground">{symbol}</span>.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to="/" className={buttonVariants({ variant: "outline" })}>
            Back to instruments
          </Link>
        </EmptyContent>
      </Empty>
    )
  }

  return <InstrumentDetail instrument={instrument} />
}
