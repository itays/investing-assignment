import { useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { selectPerson } from "@/server/functions"
import type { Person } from "@/server/people"

type SignInPanelProps = {
  people: readonly Person[]
}

export function SignInPanel({ people }: SignInPanelProps) {
  const choosePerson = useServerFn(selectPerson)
  const navigate = useNavigate()
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const handleSelect = async (personId: string) => {
    setPendingId(personId)
    try {
      await choosePerson({ data: personId })
      await router.invalidate()
      await navigate({ to: "/" })
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {people.map((person) => (
        <Button
          key={person.id}
          variant="outline"
          className="h-auto flex-col items-start gap-0.5 rounded-2xl px-4 py-3 text-left"
          disabled={pendingId !== null}
          onClick={() => void handleSelect(person.id)}
        >
          <span className="text-base">{person.displayName}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {person.email}
          </span>
        </Button>
      ))}
    </div>
  )
}
