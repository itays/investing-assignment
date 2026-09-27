import { Link } from "@tanstack/react-router"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatPrice } from "@/lib/format-price"
import type { Instrument } from "@/server/instruments"

type InstrumentTableProps = {
  instruments: readonly Instrument[]
}

export function InstrumentTable({ instruments }: InstrumentTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Symbol</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Asset class</TableHead>
          <TableHead>Exchange</TableHead>
          <TableHead className="pr-6 text-right">Last price</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {instruments.map((instrument) => (
          <TableRow key={instrument.symbol}>
            <TableCell className="pl-6">
              <Link
                to="/instruments/$symbol"
                params={{ symbol: instrument.symbol }}
                className="font-medium text-primary hover:underline"
              >
                {instrument.symbol}
              </Link>
            </TableCell>
            <TableCell className="min-w-48 whitespace-normal">
              {instrument.name}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {instrument.asset_class}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {instrument.exchange}
            </TableCell>
            <TableCell className="pr-6 text-right tabular-nums">
              {formatPrice(instrument.last_price, instrument.decimals)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
