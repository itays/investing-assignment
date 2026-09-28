import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"

import { AlertList } from "@/components/alert-list"
import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import type { Alert } from "@/server/alerts"
import { loadAlerts } from "@/server/functions"

export const Route = createFileRoute("/alerts/")({
  loader: () => loadAlerts(),
  component: AlertsPage,
})

function AlertsPage() {
  const loaded = Route.useLoaderData()
  // Pause and resume return the changed Alert; keep it until the loader catches up.
  const [changed, setChanged] = useState<Record<string, Alert>>({})
  const alerts = loaded.map((alert) => {
    const newer = changed[alert.id]
    return newer && newer.version > alert.version ? newer : alert
  })

  const handleAlertChange = (alert: Alert) => {
    setChanged((current) => ({ ...current, [alert.id]: alert }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-semibold">Alerts</h1>
          <p className="text-muted-foreground">
            Rules you've set up on Instruments you follow.
          </p>
        </div>
        {alerts.length > 0 ? (
          <Link to="/alerts/new" className={buttonVariants()}>
            New alert
          </Link>
        ) : null}
      </div>

      {alerts.length > 0 ? (
        <AlertList alerts={alerts} onAlertChange={handleAlertChange} />
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No alerts yet</EmptyTitle>
            <EmptyDescription>
              An Alert watches one Instrument for a Rule you choose, such as its
              price going above a level or falling by a percentage from today's
              open.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link to="/alerts/new" className={buttonVariants()}>
              New alert
            </Link>
          </EmptyContent>
        </Empty>
      )}
    </div>
  )
}
