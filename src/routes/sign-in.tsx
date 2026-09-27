import { createFileRoute } from "@tanstack/react-router"

import { SignInPanel } from "@/components/sign-in-panel"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { loadPeople } from "@/server/functions"

export const Route = createFileRoute("/sign-in")({
  loader: () => loadPeople(),
  component: SignInPage,
})

function SignInPage() {
  const people = Route.useLoaderData()

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl">Choose a person</h1>
        </CardTitle>
        <CardDescription>
          Select a person to continue with this local session.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignInPanel people={people} />
      </CardContent>
    </Card>
  )
}
