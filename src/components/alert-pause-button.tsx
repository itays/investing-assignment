import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { Alert } from "@/server/alerts"
import { pauseAlert, resumeAlert } from "@/server/functions"

type AlertPauseButtonProps = {
  alert: Alert
  onChange: (alert: Alert) => void
}

/** "Pause" for an Active Alert, "Resume" for a Paused one, with the reason if a resume is refused. */
export function AlertPauseButton({ alert, onChange }: AlertPauseButtonProps) {
  const pause = useServerFn(pauseAlert)
  const resume = useServerFn(resumeAlert)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isActive = alert.state === "active"

  const handleClick = async () => {
    setPending(true)
    setError(null)
    try {
      const result = isActive
        ? await pause({ data: alert.id })
        : await resume({ data: alert.id })
      if (result.ok) {
        onChange(result.alert)
      } else if (result.error.code === "holding_missing") {
        setError(`You no longer hold ${result.error.symbol}`)
      } else if (result.error.code === "not_found") {
        setError("This alert no longer exists")
      } else {
        setError("Couldn't update this alert. Please try again.")
      }
    } catch {
      setError("Couldn't update this alert. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => void handleClick()}
      >
        {isActive ? "Pause" : "Resume"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
