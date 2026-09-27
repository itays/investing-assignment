export interface Person {
  id: string
  displayName: string
  email: string
}

export const PEOPLE: readonly Person[] = [
  {
    id: "person-ava",
    displayName: "Ava Morgan",
    email: "ava.morgan@example.com",
  },
  {
    id: "person-liam",
    displayName: "Liam Chen",
    email: "liam.chen@example.com",
  },
]

export function findPerson(id: string): Person | null {
  return PEOPLE.find((person) => person.id === id) ?? null
}
