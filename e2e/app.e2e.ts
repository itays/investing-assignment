import { expect, test } from "@playwright/test"

test("switches and remembers the theme from the header", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/")

  const html = page.locator("html")
  const colorScheme = page.locator('meta[name="color-scheme"]').first()
  const darkThemeButton = page.getByRole("button", {
    name: "Switch to dark theme",
  })

  await expect(darkThemeButton).toBeVisible()
  await darkThemeButton.click()
  await expect(html).toHaveClass(/dark/)
  await expect(colorScheme).toHaveAttribute("content", "dark")
  await expect(
    page.getByRole("button", { name: "Switch to light theme" })
  ).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("theme")))
    .toBe("dark")

  await page.reload()
  await expect(html).toHaveClass(/dark/)
  await expect(
    page.getByRole("button", { name: "Switch to light theme" })
  ).toBeVisible()
})

test("d toggles and remembers the theme without interfering with typing", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/")

  await expect(
    page.getByRole("heading", { level: 1, name: "Instruments" })
  ).toBeVisible()
  const html = page.locator("html")
  await expect(html).not.toHaveClass(/dark/)

  await page.keyboard.press("d")
  await expect(html).toHaveClass(/dark/)
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("theme")))
    .toBe("dark")
  await page.reload()
  await expect(html).toHaveClass(/dark/)

  const search = page.getByRole("searchbox", { name: "Search instruments" })
  await search.focus()
  await page.keyboard.press("d")
  await expect(search).toHaveValue("d")
  await expect(html).toHaveClass(/dark/)

  await page.getByRole("heading", { level: 1, name: "Instruments" }).click()
  await page.keyboard.press("d")
  await expect(html).not.toHaveClass(/dark/)
  await page.reload()
  await expect(html).not.toHaveClass(/dark/)
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("theme")))
    .toBe("light")
})

test("filters instruments and opens one", async ({ page }) => {
  const pageErrors: Error[] = []
  page.on("pageerror", (error) => pageErrors.push(error))

  await page.goto("/")

  await expect(
    page.getByRole("heading", { level: 1, name: "Instruments" })
  ).toBeVisible()
  await expect(page.getByText("88 results")).toBeVisible()

  await page.getByRole("searchbox", { name: "Search instruments" }).fill("eur")
  await page.getByRole("button", { name: "Filter" }).click()

  await expect(page).toHaveURL(/q=eur/)
  const eurUsd = page.getByRole("link", { name: "EUR/USD", exact: true })
  await expect(eurUsd).toBeVisible()

  await eurUsd.click()
  await expect(
    page.getByRole("heading", { level: 1, name: "EUR/USD" })
  ).toBeVisible()
  await expect(page.getByText("Euro US Dollar")).toBeVisible()
  expect(pageErrors).toEqual([])
})
