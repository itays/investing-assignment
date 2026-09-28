import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"

import {
  AlertForm,
  type AlertFormFeedback,
  alertValuesFrom,
} from "@/components/alert-form"
import { AlertPauseButton } from "@/components/alert-pause-button"
import { AlertCheckStatus, AlertStateBadge } from "@/components/alert-status"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { type AlertInput, isAlertId } from "@/lib/alert-rules"
import type { Alert } from "@/server/alerts"
import {
  type AlertFormContext,
  deleteAlert,
  loadAlert,
  loadAlertFormContext,
  updateAlert,
} from "@/server/functions"

export const Route = createFileRoute("/alerts/$alertId")({
  loader: async ({ params }) => {
    const [alert, context] = await Promise.all([
      // An id no Alert could have is simply not found.
      isAlertId(params.alertId) ? loadAlert({ data: params.alertId }) : null,
      loadAlertFormContext(),
    ])
    return { alert, context }
  },
  component: AlertPage,
})

function AlertPage() {
  const { alert, context } = Route.useLoaderData()

  // Foreign and missing Alerts look exactly the same.
  if (!alert) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            <h1>Alert not found</h1>
          </EmptyTitle>
          <EmptyDescription>
            This alert doesn't exist, or it has been deleted.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to="/alerts" className={buttonVariants({ variant: "outline" })}>
            Back to alerts
          </Link>
        </EmptyContent>
      </Empty>
    )
  }

  return <EditAlert key={alert.id} loaded={alert} context={context} />
}

function EditAlert({
  loaded,
  context,
}: {
  loaded: Alert
  context: AlertFormContext
}) {
  const update = useServerFn(updateAlert)
  const [latest, setLatest] = useState<Alert>(loaded)
  const alert = loaded.version > latest.version ? loaded : latest
  // Bumped when the form must show the Alert again (after a save, or a stale save).
  const [formKey, setFormKey] = useState(0)
  const [notice, setNotice] = useState<"saved" | "stale" | null>(null)

  const handleSubmit = async (
    input: AlertInput
  ): Promise<AlertFormFeedback | undefined> => {
    setNotice(null)
    const result = await update({
      data: {
        id: alert.id,
        version: alert.version,
        edit: { title: input.title, rule: input.rule },
      },
    })
    if (result.ok) {
      setLatest(result.alert)
      setFormKey((key) => key + 1)
      setNotice("saved")
      return undefined
    }
    switch (result.error.code) {
      case "stale_version":
        setLatest(result.error.latest)
        setFormKey((key) => key + 1)
        setNotice("stale")
        return undefined
      case "invalid":
        return { fieldErrors: result.error.fieldErrors }
      case "holding_missing":
        return {
          fieldErrors: {
            "rule.threshold": `You don't hold ${result.error.symbol}`,
          },
        }
      case "not_found":
        return { formError: "This alert no longer exists." }
      default:
        return { formError: "Couldn't save this alert. Please try again." }
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold">Edit alert</h1>
          <div className="flex flex-wrap items-center gap-3">
            <AlertStateBadge state={alert.state} />
            <AlertCheckStatus />
          </div>
        </div>
        <div className="flex items-start gap-2">
          <AlertPauseButton alert={alert} onChange={setLatest} />
          <DeleteAlertButton alertId={alert.id} />
        </div>
      </div>

      {notice === "stale" ? (
        <div className="space-y-1">
          <p
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            This alert changed since you opened it
          </p>
          <p className="text-sm text-muted-foreground">
            The form now shows its latest version.
          </p>
        </div>
      ) : null}
      <div role="status" className="text-sm">
        {notice === "saved" ? "Saved" : null}
      </div>

      <AlertForm
        key={formKey}
        context={context}
        initialValues={alertValuesFrom(alert)}
        lockedSymbol
        submitLabel="Save changes"
        onSubmit={handleSubmit}
      />
    </div>
  )
}

function DeleteAlertButton({ alertId }: { alertId: string }) {
  const remove = useServerFn(deleteAlert)
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setPending(true)
    setError(null)
    try {
      // Deleted now or already gone: either way it isn't there any more.
      await remove({ data: alertId })
      await navigate({ to: "/alerts" })
    } catch {
      setError("Couldn't delete this alert. Please try again.")
      setPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
        Delete alert
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this alert?</AlertDialogTitle>
          <AlertDialogDescription>
            The alert and its history are removed for good.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() => void handleDelete()}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
