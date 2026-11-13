import { pickTime } from "./helpers/time";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { next14Days } from "../lib/time";
import { completeProfile, signInAs, uniqueGatechEmail } from "./helpers/auth";

const outputDir = "/home/ubuntu/artifacts/m4";

async function createRide(page: Page, date: string, time: string) {
  await page.goto("/rides/new");
  await page.getByLabel("Date").fill(date);
  await pickTime(page, time);
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+$/);
}

test("captures the M4 review screens at desktop and mobile sizes", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  test.skip(process.env.CAPTURE_M4_SCREENSHOTS !== "1");
  mkdirSync(outputDir, { recursive: true });

  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, {
    firstName: "Alex",
    lastName: "Parker",
    phone: "(404) 555-0123",
    venmo: "carpool5",
  });
  const dates = next14Days(new Date());
  await createRide(page, dates[1], "09:30");
  const rideUrl = page.url();
  await createRide(page, dates[2], "10:30");
  await createRide(page, dates[3], "11:30");
  await createRide(page, dates[4], "12:30");

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await signInAs(memberPage, uniqueGatechEmail());
  await completeProfile(memberPage, {
    firstName: "Casey",
    lastName: "Member",
    phone: "(404) 555-0100",
    venmo: "casey",
  });
  await memberPage.goto(rideUrl);
  await memberPage.getByRole("button", { name: "Join ride" }).click();
  const joinDialog = memberPage.getByRole("dialog");
  await joinDialog.getByRole("button", { name: "Join" }).click();
  await expect(joinDialog).toBeHidden();

  for (const viewport of [
    { name: "desktop", width: 1280, height: 800 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await memberPage.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });

    await memberPage.goto(rideUrl);
    await memberPage.screenshot({
      path: join(outputDir, `ride-member-${viewport.name}.png`),
    });

    await memberPage.goto("/me");
    await memberPage.screenshot({
      path: join(outputDir, `me-${viewport.name}.png`),
    });

    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.screenshot({
      path: join(outputDir, `browse-bottom-${viewport.name}.png`),
    });

    await memberPage.goto("/profile");
    await memberPage.getByRole("button", { name: "Delete account" }).click();
    const deleteDialog = memberPage.getByRole("dialog");
    await deleteDialog.getByLabel("Type DELETE to confirm").fill("DELETE");
    await memberPage.screenshot({
      path: join(outputDir, `delete-dialog-${viewport.name}.png`),
    });
    await memberPage.keyboard.press("Escape");

    await memberPage.goto("/rides/not-a-uuid");
    await expect(
      memberPage.getByRole("heading", { name: "This page isn't here." }),
    ).toBeVisible();
    await memberPage.screenshot({
      path: join(outputDir, `not-found-${viewport.name}.png`),
    });
  }

  await memberContext.close();
});
