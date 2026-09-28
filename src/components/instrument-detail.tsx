import { Link } from "@tanstack/react-router"

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatPrice } from "@/lib/format-price"
import type { Instrument } from "@/server/instruments"

type InstrumentDetailProps = {
  instrument: Instrument
}

export function InstrumentDetail({ instrument }: InstrumentDetailProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Back to instruments
        </Link>
        <Link
          to="/alerts/new"
          search={{ symbol: instrument.symbol }}
          className={buttonVariants({ size: "sm" })}
        >
          Create alert
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl">{instrument.symbol}</h1>
          </CardTitle>
          <CardDescription>{instrument.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-muted-foreground">Last price</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">
              {formatPrice(instrument.last_price, instrument.decimals)}
              {instrument.currency ? (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  {instrument.currency}
                </span>
              ) : null}
            </p>
          </div>
          <Separator />
          <dl className="grid gap-4 sm:grid-cols-3">
            <DetailItem label="Asset class" value={instrument.asset_class} />
            <DetailItem label="Exchange" value={instrument.exchange} />
            <DetailItem
              label="Quote currency"
              value={instrument.currency ?? "—"}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}
