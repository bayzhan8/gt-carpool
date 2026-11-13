import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { next14Days } from "../lib/time";
import { completeProfile, signInAs, uniqueGatechEmail } from "./helpers/auth";
import { pickTime } from "./helpers/time";

const screenshotDirectory = process.env.CELEBRATION_SCREENSHOT_DIR;

async function setupMember(page: Page, firstName: string) {
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, {
    firstName,
    lastName: "Parker",
    phone: "(404) 555-0123",
    gender: "woman",
  });
}

async function createRide(
  page: Page,
): Promise<{ ridePath: string; celebrationStartedAt: number }> {
  await page.goto("/rides/new");
  await page.getByLabel("Date").fill(next14Days(new Date())[5] ?? "");
  await pickTime(page, "09:30");
  await page.getByRole("button", { name: "Post ride" }).click();

  const celebration = page
    .getByRole("status")
    .filter({ hasText: "Your ride is up!" });
  await expect(celebration).toBeVisible();
  const celebrationStartedAt = Date.now();
  const ridePath = new URL(page.url()).pathname;
  await expect(page).toHaveURL(new RegExp(`${ridePath}$`));
  return { ridePath, celebrationStartedAt };
}

async function captureScreenshots(
  page: Page,
  testInfo: TestInfo,
  kind: "posted" | "joined",
  celebrationStartedAt: number,
) {
  if (!screenshotDirectory || testInfo.project.name !== "mobile") return;

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.waitForTimeout(
    Math.max(0, 350 - (Date.now() - celebrationStartedAt)),
  );
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      clip: { x: 0, y: 0, width, height: 900 },
      path: join(screenshotDirectory, `${kind}-${width}-mid-v2.png`),
      scale: "css",
    });
  }

  await page.waitForTimeout(
    Math.max(0, 2000 - (Date.now() - celebrationStartedAt)),
  );
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      clip: { x: 0, y: 0, width, height: 900 },
      path: join(screenshotDirectory, `${kind}-${width}-settled-v2.png`),
      scale: "css",
    });
  }
}

test("R-CELEB-1 posting a ride celebrates, offers calendar, and does not replay", async ({
  page,
}, testInfo) => {
  await setupMember(page, "Alex");
  const { ridePath, celebrationStartedAt } = await createRide(page);
  const celebration = page
    .getByRole("status")
    .filter({ hasText: "Your ride is up!" });

  await expect(celebration).toContainText(
    "We'll email you when someone joins. Save the date now, and text your riders once they join to set up a group chat.",
  );
  await expect(
    page.getByRole("link", { name: "Save the date" }),
  ).toHaveAttribute("href", `${ridePath}/calendar.ics`);
  await captureScreenshots(page, testInfo, "posted", celebrationStartedAt);
  await expect(page).toHaveURL(new RegExp(`${ridePath}$`));

  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(celebration).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your ride is up!" }),
  ).toHaveCount(0);
});

test("R-CELEB-2 joining a ride celebrates and links to the group", async ({
  browser,
  page,
}, testInfo) => {
  const ownerContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
  });
  const ownerPage = await ownerContext.newPage();
  await setupMember(ownerPage, "Alex");
  const { ridePath } = await createRide(ownerPage);

  await setupMember(page, "Casey");
  await page.goto(ridePath);
  await page.getByRole("button", { name: "Join ride" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Join" }).click();

  const celebration = page
    .getByRole("status")
    .filter({ hasText: "You're in!" });
  await expect(celebration).toBeVisible();
  const celebrationStartedAt = Date.now();
  await expect(celebration).toContainText(
    "Save the date, then text your riders now to start a group chat and agree where to meet before the ride.",
  );
  await expect(
    page.getByRole("link", { name: "Save the date" }),
  ).toHaveAttribute("href", `${ridePath}/calendar.ics`);
  await expect(
    page.getByRole("link", { name: "Message riders" }),
  ).toHaveAttribute("href", "#riders");
  await captureScreenshots(page, testInfo, "joined", celebrationStartedAt);
  await expect(page).toHaveURL(new RegExp(`${ridePath}$`));

  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(celebration).toHaveCount(0);
  await ownerContext.close();
});

test("R-CELEB-3 ignores the celebration query for non-members and anonymous visitors", async ({
  browser,
  page,
}) => {
  const ownerContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
  });
  const ownerPage = await ownerContext.newPage();
  await setupMember(ownerPage, "Alex");
  const { ridePath } = await createRide(ownerPage);
  await ownerPage.goto(`${ridePath}?welcome=unexpected`);
  await expect(
    ownerPage.getByRole("heading", { name: "Your ride is up!" }),
  ).toHaveCount(0);

  await setupMember(page, "Casey");
  await page.goto(`${ridePath}?welcome=joined`);
  await expect(page.getByRole("heading", { name: "You're in!" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", { name: "Your ride is up!" }),
  ).toHaveCount(0);

  const anonymousContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
  });
  const anonymousPage = await anonymousContext.newPage();
  await anonymousPage.goto(`${ridePath}?welcome=joined`);
  await expect(
    anonymousPage.getByRole("heading", { name: "You're in!" }),
  ).toHaveCount(0);
  await expect(
    anonymousPage.getByRole("heading", { name: "Your ride is up!" }),
  ).toHaveCount(0);

  await anonymousContext.close();
  await ownerContext.close();
});
