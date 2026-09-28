import { randomUUID } from "node:crypto"
import { expect, type Page, test } from "@playwright/test"

// The e2e server has its own database, but a local run may reuse a server
// that already has data in it. Every test therefore names its Alerts uniquely
// and never assumes an empty list.

type Persona = "Ava Morgan" | "Liam Chen"

function uniqueTitle(label: string): string {
  return `e2e ${label} ${randomUUID().slice(0, 8)}`
}

function collectPageErrors(page: Page): Error[] {
  const errors: Error[] = []
  page.on("pageerror", (error) => errors.push(error))
  return errors
}

/**
 * Waits until React has hydrated the server-rendered page, so a click is
 * handled by the app rather than lost. TanStack Start's inline stream script
 * defines `window.$_TSR` and deletes it once hydration and streaming are done.
 */
async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => !("$_TSR" in window))
}

async function open(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await hydrated(page)
}

async function reload(page: Page): Promise<void> {
  await page.reload()
  await hydrated(page)
}

async function signIn(page: Page, persona: Persona): Promise<void> {
  await open(page, "/sign-in")
  await page.getByRole("button").filter({ hasText: persona }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("banner").getByText(persona)).toBeVisible()
}

function alertsList(page: Page) {
  return page.getByRole("list", { name: "Your alerts" })
}

/** The Alert's row in the list, found by its unique Alert Title. */
function alertItem(page: Page, title: string) {
  return alertsList(page).getByRole("listitem").filter({ hasText: title })
}

async function gotoAlerts(page: Page): Promise<void> {
  await open(page, "/alerts")
  await expect(
    page.getByRole("heading", { level: 1, name: "Alerts" })
  ).toBeVisible()
}

type PriceRule = {
  direction: "Goes above" | "Goes below"
  threshold: "A price" | "What I paid (291.40)"
  price?: string
  /** The Rule Description the form previews before saving. */
  description: string
}

/** Fills and submits the new-Alert form that is already open on AAPL. */
async function submitAaplPriceAlert(
  page: Page,
  title: string,
  rule: PriceRule
): Promise<void> {
  await expect(
    page.getByRole("heading", { level: 1, name: "New alert" })
  ).toBeVisible()
  await page
    .getByRole("radiogroup", { name: "Rule kind" })
    .getByRole("radio", { name: "Price", exact: true })
    .click()
  await page
    .getByRole("radiogroup", { name: "Direction" })
    .getByRole("radio", { name: rule.direction })
    .click()
  await page
    .getByRole("radiogroup", { name: "Threshold" })
    .getByRole("radio", { name: rule.threshold, exact: true })
    .click()
  if (rule.price !== undefined) {
    await page
      .getByRole("textbox", { name: "Price", exact: true })
      .fill(rule.price)
  }
  await page
    .getByRole("textbox", { name: "Alert title (optional)" })
    .fill(title)
  await expect(page.getByText(`Rule: ${rule.description}`)).toBeVisible()
  await page.getByRole("button", { name: "Create alert" }).click()
  await expect(page).toHaveURL(/\/alerts$/)
}

/** Creates an AAPL Alert with a typed price and returns its page's path. */
async function createAaplAlert(
  page: Page,
  title: string,
  rule: PriceRule = {
    direction: "Goes below",
    threshold: "A price",
    price: "300.00",
    description: "AAPL goes below 300.00",
  }
): Promise<string> {
  await open(page, "/alerts/new?symbol=AAPL")
  await submitAaplPriceAlert(page, title, rule)
  const href = await alertItem(page, title)
    .getByRole("link", { name: /^AAPL goes / })
    .getAttribute("href")
  expect(href).toMatch(/^\/alerts\/[^/]+$/)
  return href as string
}

test("creates Alerts with a Price Rule and a Private Rule from the Instrument page and keeps them after a reload", async ({
  page,
}) => {
  const pageErrors = collectPageErrors(page)
  const priceTitle = uniqueTitle("price")
  const privateTitle = uniqueTitle("private")
  await signIn(page, "Ava Morgan")

  await open(page, "/instruments/AAPL")
  await page.getByRole("link", { name: "Create alert" }).click()
  await expect(page).toHaveURL(/\/alerts\/new\?symbol=AAPL/)
  await submitAaplPriceAlert(page, priceTitle, {
    direction: "Goes below",
    threshold: "A price",
    price: "300.00",
    description: "AAPL goes below 300.00",
  })

  await open(page, "/instruments/AAPL")
  await page.getByRole("link", { name: "Create alert" }).click()
  await expect(page).toHaveURL(/\/alerts\/new\?symbol=AAPL/)
  await submitAaplPriceAlert(page, privateTitle, {
    direction: "Goes below",
    threshold: "What I paid (291.40)",
    description: "AAPL goes below what you paid (291.40)",
  })

  await open(page, "/")
  await page.getByRole("link", { name: "Alerts", exact: true }).click()
  await expect(page).toHaveURL(/\/alerts$/)
  await reload(page)
  await expect(
    page.getByRole("heading", { level: 1, name: "Alerts" })
  ).toBeVisible()

  const priceItem = alertItem(page, priceTitle)
  await expect(priceItem).toHaveCount(1)
  await expect(priceItem).toContainText("AAPL")
  await expect(
    priceItem.getByRole("link", { name: "AAPL goes below 300.00" })
  ).toBeVisible()
  await expect(priceItem.getByText("Active", { exact: true })).toBeVisible()
  await expect(priceItem.getByText("Not yet checked")).toBeVisible()
  await expect(priceItem.getByRole("button", { name: "Pause" })).toBeVisible()

  const privateItem = alertItem(page, privateTitle)
  await expect(privateItem).toHaveCount(1)
  await expect(
    privateItem.getByRole("link", {
      name: "AAPL goes below what you paid (291.40)",
    })
  ).toBeVisible()
  await expect(privateItem.getByText("Not yet checked")).toBeVisible()

  await expect(page.getByText("No matches")).toHaveCount(0)
  await expect(page.getByText(/Last matched/i)).toHaveCount(0)
  expect(pageErrors).toEqual([])
})

test("edits an Alert's Rule and shows the new Rule Description", async ({
  page,
}) => {
  const pageErrors = collectPageErrors(page)
  const title = uniqueTitle("edit")
  await signIn(page, "Ava Morgan")
  await createAaplAlert(page, title)

  await alertItem(page, title)
    .getByRole("link", { name: "AAPL goes below 300.00" })
    .click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Edit alert" })
  ).toBeVisible()
  await expect(page.getByText(/AAPL — Apple Inc/)).toBeVisible()
  await expect(page.getByText("Not yet checked")).toBeVisible()
  await expect(
    page.getByRole("textbox", { name: "Alert title (optional)" })
  ).toHaveValue(title)

  await page
    .getByRole("radiogroup", { name: "Direction" })
    .getByRole("radio", { name: "Goes above" })
    .click()
  await page.getByRole("textbox", { name: "Price", exact: true }).fill("320.00")
  await expect(page.getByText("Rule: AAPL goes above 320.00")).toBeVisible()
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()

  await gotoAlerts(page)
  const item = alertItem(page, title)
  await expect(
    item.getByRole("link", { name: "AAPL goes above 320.00" })
  ).toBeVisible()
  await expect(item.getByText("Not yet checked")).toBeVisible()
  expect(pageErrors).toEqual([])
})

test("pauses and resumes an Alert from the list", async ({ page }) => {
  const pageErrors = collectPageErrors(page)
  const title = uniqueTitle("pause")
  await signIn(page, "Ava Morgan")
  await createAaplAlert(page, title)

  const item = alertItem(page, title)
  await expect(item.getByText("Active", { exact: true })).toBeVisible()
  await item.getByRole("button", { name: "Pause" }).click()
  await expect(item.getByText("Paused", { exact: true })).toBeVisible()
  await expect(item.getByRole("button", { name: "Resume" })).toBeVisible()

  await reload(page)
  await expect(item.getByText("Paused", { exact: true })).toBeVisible()
  await expect(item.getByRole("button", { name: "Resume" })).toBeVisible()

  await item.getByRole("button", { name: "Resume" }).click()
  await expect(item.getByText("Active", { exact: true })).toBeVisible()
  await expect(item.getByRole("button", { name: "Pause" })).toBeVisible()

  await reload(page)
  await expect(item.getByText("Active", { exact: true })).toBeVisible()
  expect(pageErrors).toEqual([])
})

test("deletes an Alert through the in-page dialog", async ({ page }) => {
  const pageErrors = collectPageErrors(page)
  const title = uniqueTitle("delete")
  await signIn(page, "Ava Morgan")
  const alertPath = await createAaplAlert(page, title)

  await open(page, alertPath)
  await expect(
    page.getByRole("heading", { level: 1, name: "Edit alert" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Delete alert" }).click()

  const dialog = page
    .locator('[role="dialog"], [role="alertdialog"]')
    .filter({ hasText: "Delete this alert?" })
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(new RegExp(`${alertPath}$`))

  await page.getByRole("button", { name: "Delete alert" }).click()
  await dialog.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page).toHaveURL(/\/alerts$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "Alerts" })
  ).toBeVisible()
  await expect(page.getByText(title)).toHaveCount(0)

  await reload(page)
  await expect(
    page.getByRole("heading", { level: 1, name: "Alerts" })
  ).toBeVisible()
  await expect(page.getByText(title)).toHaveCount(0)

  await open(page, alertPath)
  await expect(
    page.getByRole("heading", { level: 1, name: "Alert not found" })
  ).toBeVisible()
  expect(pageErrors).toEqual([])
})

test("another Person can neither list nor open someone else's Alert", async ({
  page,
}) => {
  const pageErrors = collectPageErrors(page)
  const title = uniqueTitle("private to ava")
  await signIn(page, "Ava Morgan")
  const alertPath = await createAaplAlert(page, title)

  await signIn(page, "Liam Chen")
  await gotoAlerts(page)
  await expect(page.getByText(title)).toHaveCount(0)

  await open(page, alertPath)
  await expect(
    page.getByRole("heading", { level: 1, name: "Alert not found" })
  ).toBeVisible()
  await expect(page.getByText(title)).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(
    0
  )

  // The server-rendered response itself must not carry the Alert.
  const response = await page.request.get(alertPath)
  const html = await response.text()
  expect(html).toContain("Alert not found")
  expect(html).not.toContain(title)
  expect(pageErrors).toEqual([])
})

test("sends a signed-out Person from the Alerts page to sign in", async ({
  page,
}) => {
  const pageErrors = collectPageErrors(page)
  await open(page, "/alerts")
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "Choose a person" })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Alerts", exact: true })
  ).toHaveCount(0)
  expect(pageErrors).toEqual([])
})

test("warns when saving an Alert that changed in another tab", async ({
  page,
  context,
}) => {
  const pageErrors = collectPageErrors(page)
  const title = uniqueTitle("stale")
  await signIn(page, "Ava Morgan")
  const alertPath = await createAaplAlert(page, title)

  const otherTab = await context.newPage()
  const otherTabErrors = collectPageErrors(otherTab)
  for (const tab of [page, otherTab]) {
    await open(tab, alertPath)
    await expect(
      tab.getByRole("heading", { level: 1, name: "Edit alert" })
    ).toBeVisible()
  }

  await page
    .getByRole("radiogroup", { name: "Direction" })
    .getByRole("radio", { name: "Goes above" })
    .click()
  await page.getByRole("textbox", { name: "Price", exact: true }).fill("310.00")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()

  await otherTab
    .getByRole("textbox", { name: "Price", exact: true })
    .fill("305.00")
  await otherTab.getByRole("button", { name: "Save changes" }).click()
  await expect(
    otherTab
      .getByRole("alert")
      .filter({ hasText: "This alert changed since you opened it" })
  ).toBeVisible()
  // The form now shows the latest values, not the rejected ones.
  await expect(otherTab.getByText("Rule: AAPL goes above 310.00")).toBeVisible()

  await gotoAlerts(page)
  await expect(
    alertItem(page, title).getByRole("link", { name: "AAPL goes above 310.00" })
  ).toBeVisible()
  expect(pageErrors).toEqual([])
  expect(otherTabErrors).toEqual([])
})

test("rejects a price with more decimals than the Instrument allows", async ({
  page,
}) => {
  const pageErrors = collectPageErrors(page)
  const title = uniqueTitle("invalid")
  await signIn(page, "Ava Morgan")

  await open(page, "/alerts/new?symbol=AAPL")
  await expect(
    page.getByRole("heading", { level: 1, name: "New alert" })
  ).toBeVisible()
  await page
    .getByRole("radiogroup", { name: "Rule kind" })
    .getByRole("radio", { name: "Price", exact: true })
    .click()
  await page
    .getByRole("radiogroup", { name: "Threshold" })
    .getByRole("radio", { name: "A price", exact: true })
    .click()
  await page
    .getByRole("textbox", { name: "Price", exact: true })
    .fill("300.123")
  await page
    .getByRole("textbox", { name: "Alert title (optional)" })
    .fill(title)
  await page.getByRole("button", { name: "Create alert" }).click()

  await expect(page.getByText(/decimal/i)).toBeVisible()
  await expect(page).toHaveURL(/\/alerts\/new/)
  await expect(
    page.getByRole("heading", { level: 1, name: "New alert" })
  ).toBeVisible()

  await gotoAlerts(page)
  await expect(page.getByText(title)).toHaveCount(0)
  expect(pageErrors).toEqual([])
})
