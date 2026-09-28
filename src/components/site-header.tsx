import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button, buttonVariants } from "@/components/ui/button"
import { clearPerson } from "@/server/functions"
import type { Person } from "@/server/people"

type SiteHeaderProps = {
  person: Person | null
}

export function SiteHeader({ person }: SiteHeaderProps) {
  const signOut = useServerFn(clearPerson)
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
      await router.invalidate()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-heading text-sm font-semibold">
            Market Desk
          </Link>
          {person ? (
            <nav aria-label="Main">
              <Link
                to="/alerts"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Alerts
              </Link>
            </nav>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {person ? (
            <>
              <div className="mr-2 text-right">
                <p className="text-sm font-medium">{person.displayName}</p>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  {person.email}
                </p>
              </div>
              <Link
                to="/sign-in"
                className={buttonVariants({ variant: "ghost" })}
              >
                Switch
              </Link>
              <Button
                variant="outline"
                disabled={isSigningOut}
                onClick={() => void handleSignOut()}
              >
                {isSigningOut ? "Signing out" : "Sign out"}
              </Button>
            </>
          ) : (
            <Link to="/sign-in" className={buttonVariants()}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
