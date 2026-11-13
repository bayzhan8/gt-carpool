import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const trustPage of [
  { path: "/privacy", heading: "Privacy" },
  { path: "/safety", heading: "Safety" },
]) {
  test(`${trustPage.heading} page is indexable and accessible`, async ({
    page,
  }) => {
    const response = await page.goto(trustPage.path);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: trustPage.heading }),
    ).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(
      page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }),
    ).toHaveAttribute("href", "/privacy");
    await expect(
      page.getByRole("contentinfo").getByRole("link", { name: "Safety" }),
    ).toHaveAttribute("href", "/safety");
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
  });
}

test("site footer links to both trust pages", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute(
    "href",
    "/privacy",
  );
  await expect(footer.getByRole("link", { name: "Safety" })).toHaveAttribute(
    "href",
    "/safety",
  );
});
