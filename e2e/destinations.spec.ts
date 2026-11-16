import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { completeProfile, signInAs, uniqueGatechEmail } from "./helpers/auth";

const screenshotDirectory = process.env.DESTINATIONS_SCREENSHOT_DIR;
if (screenshotDirectory) {
  mkdirSync(screenshotDirectory, { recursive: true });
}

function localDatabaseUrl(): string {
  let value = process.env.DB_URL;
  if (!value) {
    const output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    value = output
      .split(/\r?\n/)
      .find((line) => line.startsWith("DB_URL="))
      ?.slice("DB_URL=".length);
  }
  if (!value) throw new Error("Local Supabase DB_URL is unavailable");
  value = value.replace(/^["']|["']$/g, "");
  if (!["127.0.0.1", "localhost"].includes(new URL(value).hostname)) {
    throw new Error("Destination E2E fixtures may only modify local Supabase");
  }
  return value;
}

async function setCommunityPlacesHidden(hidden: boolean) {
  const pool = new Pool({ connectionString: localDatabaseUrl() });
  try {
    await pool.query(
      "update public.places set hidden = $1 where kind = 'other'",
      [hidden],
    );
  } finally {
    await pool.end();
  }
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  if (!screenshotDirectory) return;
  await page.screenshot({
    path: join(screenshotDirectory, `${name}-${testInfo.project.name}.png`),
    scale: "css",
  });
}

test("R-DEST-4 dir=other opens the add-place sheet when no places are open", async ({
  page,
}) => {
  await setCommunityPlacesHidden(true);
  try {
    await signInAs(page, uniqueGatechEmail(), "/rides/new?dir=other");
    await completeProfile(page);
    await page.goto("/rides/new?dir=other");
    await expect(
      page.getByRole("heading", { name: "Where are you headed?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    await setCommunityPlacesHidden(false);
  }
});

test("R-DEST-1/2/3/7/8 students add, reuse, find, and join a community destination", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, { firstName: "Riley" });
  await page.goto("/rides/new");
  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await expect(
    page.getByRole("heading", { name: "Where are you headed?" }),
  ).toBeVisible();
  await page.getByLabel("Place", { exact: true }).fill("Athens");
  await page.getByRole("button", { name: "Use this place" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("From")).toHaveValue("gt");
  await expect(page.getByLabel("To", { exact: true })).not.toHaveValue(
    "atl-domestic",
  );
  await page.getByRole("button", { name: "Post ride" }).click();
  await expect(page.getByText("Your ride is up!")).toBeVisible();
  const rideId = new URL(page.url()).pathname.split("/").pop();
  expect(rideId).toMatch(/^[0-9a-f-]{36}$/i);

  await page.goto("/?dir=other");
  const rideLink = page.locator(`a[href="/rides/${rideId}"]`);
  await expect(rideLink).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Filter by place" })
      .getByRole("link", {
        name: "Athens",
      }),
  ).toBeVisible();
  await capture(page, testInfo, "board-other-390");
  await page.getByRole("link", { name: "To ATL" }).click();
  await expect(page.locator(`a[href="/rides/${rideId}"]`)).toHaveCount(0);
  await capture(page, testInfo, "board-to-atl-390");
  await page.getByRole("link", { name: "From ATL" }).click();
  await expect(page.locator(`a[href="/rides/${rideId}"]`)).toHaveCount(0);
  await page.getByRole("link", { name: "Other trips" }).click();

  await page.context().clearCookies();
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, { firstName: "Jordan" });
  await page.goto("/rides/new");
  await expect(
    page
      .getByLabel("To", { exact: true })
      .locator("option")
      .filter({ hasText: "Athens" }),
  ).toHaveCount(1);
  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill("ath");
  const athensSuggestion = page.getByRole("button", {
    name: /Athens · .* upcoming rides?/,
  });
  await expect(athensSuggestion).toBeVisible();
  await capture(page, testInfo, "post-sheet-suggestions-390");

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("To", { exact: true })).toHaveValue(
    "atl-domestic",
  );
  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill("ath");
  await page
    .getByRole("button", { name: /Athens · .* upcoming rides?/ })
    .click();
  await expect(page.getByLabel("To", { exact: true })).not.toHaveValue(
    "atl-domestic",
  );
  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill("foo.com");
  await page.getByRole("button", { name: "Use this place" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "Use a city or venue name, 2–32 characters.",
  );
  await capture(page, testInfo, "sheet-error-390");

  await page.getByLabel("Place", { exact: true }).fill("athens ");
  await page.getByRole("button", { name: "Use this place" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .getByLabel("To", { exact: true })
      .locator("option")
      .filter({ hasText: "Athens" }),
  ).toHaveCount(1);
  await page.goto("/?dir=other");
  await page.locator(`a[href="/rides/${rideId}"]`).click();
  await expect(
    page.getByRole("heading", { name: "Georgia Tech → Athens" }),
  ).toBeVisible();
  await capture(page, testInfo, "community-ride-390");
  await page.getByRole("button", { name: "Join ride" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Join" }).click();
  await expect(page.getByText("You're in!")).toBeVisible();
});

test("R-DEST-2/7 signed-out Other trips and 320px tabs render without overflow", async ({
  page,
}, testInfo) => {
  await page.context().clearCookies();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?dir=other");
  await expect(
    page.getByRole("navigation", { name: "Ride direction" }).getByRole("link", {
      name: "Other trips",
    }),
  ).toHaveAttribute("aria-current", "page");
  const tabRow = page.getByRole("navigation", { name: "Ride direction" });
  const dimensions = await tabRow.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await tabRow.scrollIntoViewIfNeeded();
  await capture(page, testInfo, "tabs-320");
});
