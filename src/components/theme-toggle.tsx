import { MoonIcon, SunIcon } from "lucide-react"
import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"

function subscribeToTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange)
  observer.observe(document.documentElement, {
    attributeFilter: ["class"],
    attributes: true,
  })

  return () => observer.disconnect()
}

function isDarkTheme() {
  return document.documentElement.classList.contains("dark")
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    subscribeToTheme,
    isDarkTheme,
    () => false
  )
  const nextTheme = isDark ? "light" : "dark"
  const label = `Switch to ${nextTheme} theme`

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={`${label} (D)`}
      data-theme-toggle=""
    >
      {isDark ? (
        <SunIcon data-icon="inline-start" aria-hidden="true" />
      ) : (
        <MoonIcon data-icon="inline-start" aria-hidden="true" />
      )}
    </Button>
  )
}
