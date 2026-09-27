import { Link, useNavigate } from "@tanstack/react-router"
import type { FormEvent } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type InstrumentFilterProps = {
  query: string
}

export function InstrumentFilter({ query }: InstrumentFilterProps) {
  const navigate = useNavigate({ from: "/" })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = new FormData(event.currentTarget).get("q")
    const nextQuery = typeof value === "string" ? value.trim() : ""

    void navigate({ search: { q: nextQuery || undefined } })
  }

  return (
    <form
      key={query}
      className="flex w-full max-w-md items-center gap-2"
      onSubmit={handleSubmit}
    >
      <Input
        aria-label="Search instruments"
        defaultValue={query}
        name="q"
        placeholder="Symbol or name"
        type="search"
      />
      <Button type="submit">Filter</Button>
      {query && (
        <Link
          to="/"
          search={{ q: undefined }}
          className={buttonVariants({ variant: "ghost" })}
        >
          Clear
        </Link>
      )}
    </form>
  )
}
