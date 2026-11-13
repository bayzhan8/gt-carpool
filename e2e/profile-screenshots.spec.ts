import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { completeProfile, signInAs, uniqueGatechEmail } from "./helpers/auth";

test("captures profile settings and delete dialog", async ({
  page,
}, testInfo) => {
  const outputDir = process.env.PROFILE_SCREENSHOT_DIR ?? testInfo.outputDir;
  mkdirSync(outputDir, { recursive: true });
  await page.setViewportSize(
    testInfo.project.name === "desktop"
      ? { width: 1280, height: 800 }
      : { width: 390, height: 844 },
  );
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, {
    firstName: "Taylor",
    lastName: "Parker",
    phone: "(404) 555-0123",
    venmo: "carpool5",
  });
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await page.screenshot({
    path: join(outputDir, `profile-${testInfo.project.name}.png`),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Delete account" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(
    "Rides you organize pass to the next person who joined. Rides where you're the only rider are cancelled. Other riders get an email. This can't be undone.",
  );
  await page.screenshot({
    path: join(outputDir, `delete-dialog-${testInfo.project.name}.png`),
    fullPage: true,
  });
});
