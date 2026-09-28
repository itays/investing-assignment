import { Badge } from "@/components/ui/badge"
import type { Alert } from "@/server/alerts"

/** Active or Paused, as a badge. */
export function AlertStateBadge({ state }: { state: Alert["state"] }) {
  return state === "active" ? (
    <Badge variant="secondary">Active</Badge>
  ) : (
    <Badge variant="outline">Paused</Badge>
  )
}

/**
 * What is known about the Alert's Matches. No Checking System is connected in
 * step 2, so nothing is known yet: never "no matches", never a Match line.
 */
export function AlertCheckStatus() {
  return <span className="text-sm text-muted-foreground">Not yet checked</span>
}
