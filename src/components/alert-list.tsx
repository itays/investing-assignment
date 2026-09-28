import { Link } from "@tanstack/react-router"
import { useId, useMemo, useState } from "react"

import { AlertPauseButton } from "@/components/alert-pause-button"
import { AlertCheckStatus, AlertStateBadge } from "@/components/alert-status"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { Alert } from "@/server/alerts"

type StateFilter = "all" | Alert["state"]
type KindFilter = "all" | Alert["rule"]["kind"]
type SortOrder = "newest" | "symbol"

type AlertListProps = {
  alerts: Alert[]
  onAlertChange: (alert: Alert) => void
}

/** Every Alert the Owner has, searched, filtered and sorted in the browser. */
export function AlertList({ alerts, onAlertChange }: AlertListProps) {
  const id = useId()
  const [query, setQuery] = useState("")
  const [state, setState] = useState<StateFilter>("all")
  const [kind, setKind] = useState<KindFilter>("all")
  const [symbol, setSymbol] = useState("all")
  const [sort, setSort] = useState<SortOrder>("newest")

  const symbols = useMemo(
    () => [...new Set(alerts.map((alert) => alert.symbol))].sort(),
    [alerts]
  )

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matching = alerts.filter(
      (alert) =>
        (state === "all" || alert.state === state) &&
        (kind === "all" || alert.rule.kind === kind) &&
        (symbol === "all" || alert.symbol === symbol) &&
        (needle === "" ||
          [alert.title ?? "", alert.symbol, alert.description].some((text) =>
            text.toLowerCase().includes(needle)
          ))
    )
    const newestFirst = (a: Alert, b: Alert) =>
      b.createdAt.localeCompare(a.createdAt)
    return matching.sort(
      sort === "newest"
        ? newestFirst
        : (a, b) => a.symbol.localeCompare(b.symbol) || newestFirst(a, b)
    )
  }, [alerts, query, state, kind, symbol, sort])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-search`}>Search alerts</Label>
          <Input
            id={`${id}-search`}
            type="search"
            placeholder="Title, symbol or rule"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <FilterSelect
          id={`${id}-state`}
          label="State"
          value={state}
          onChange={setState}
          options={[
            ["all", "All states"],
            ["active", "Active"],
            ["paused", "Paused"],
          ]}
        />
        <FilterSelect
          id={`${id}-kind`}
          label="Rule kind"
          value={kind}
          onChange={setKind}
          options={[
            ["all", "All kinds"],
            ["price", "Price"],
            ["percentage", "Percentage"],
          ]}
        />
        <FilterSelect
          id={`${id}-symbol`}
          label="Symbol"
          value={symbol}
          onChange={setSymbol}
          options={[
            ["all", "All symbols"],
            ...symbols.map((value): [string, string] => [value, value]),
          ]}
        />
        <FilterSelect
          id={`${id}-sort`}
          label="Sort"
          value={sort}
          onChange={setSort}
          options={[
            ["newest", "Newest"],
            ["symbol", "Symbol"],
          ]}
        />
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {shown.length} {shown.length === 1 ? "alert" : "alerts"}
      </p>

      {shown.length === 0 ? (
        <p className="text-muted-foreground">
          No alerts fit this search and these filters.
        </p>
      ) : null}

      <ul
        aria-label="Your alerts"
        className="divide-y rounded-2xl ring-1 ring-foreground/10"
      >
        {shown.map((alert) => (
          <li
            key={alert.id}
            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading font-semibold">
                  {alert.symbol}
                </span>
                <AlertStateBadge state={alert.state} />
              </div>
              <Link
                to="/alerts/$alertId"
                params={{ alertId: alert.id }}
                className="block font-medium underline-offset-4 hover:underline"
              >
                {alert.description}
              </Link>
              {alert.title ? (
                <p className="truncate text-sm">{alert.title}</p>
              ) : null}
              <AlertCheckStatus />
            </div>
            <AlertPauseButton alert={alert} onChange={onAlertChange} />
          </li>
        ))}
      </ul>
    </div>
  )
}

type FilterSelectProps<T extends string> = {
  id: string
  label: string
  value: T
  onChange: (value: T) => void
  options: [T, string][]
}

function FilterSelect<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
}: FilterSelectProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        className="w-full"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <NativeSelectOption key={optionValue} value={optionValue}>
            {optionLabel}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}
