import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the home page shows the Rides heading and wordmark", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Rides", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "GT Carpool", exact: true }),
  ).toHaveAttribute("href", "/");
});

test("the home page has no serious or critical accessibility violations", async ({
  page,
}) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );

  expect(violations).toEqual([]);
});
