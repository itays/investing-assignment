import { redirect } from "@tanstack/react-router"
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server"
import type { Person } from "./people"
import { findPerson } from "./people"

const PERSON_COOKIE = "person_id"

export function getCurrentPerson(): Person | null {
  const personId = getCookie(PERSON_COOKIE)
  return personId ? findPerson(personId) : null
}

/** The signed-in Person, or a redirect to sign in. */
export function requireCurrentPerson(): Person {
  const person = getCurrentPerson()
  if (!person) {
    throw redirect({ to: "/sign-in" })
  }
  return person
}

export function signIn(personId: string): Person {
  const person = findPerson(personId)
  if (!person) {
    throw new Error("Unknown person")
  }

  setCookie(PERSON_COOKIE, person.id, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  })

  return person
}

export function signOut(): void {
  deleteCookie(PERSON_COOKIE, { path: "/" })
}
