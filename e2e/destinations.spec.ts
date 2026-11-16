import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { completeProfile, signInAs, uniqueGatechEmail } from "./helpers/auth";
import { getLatestEmailBody } from "./helpers/mailpit";
import { pickTime } from "./helpers/time";

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

async function deleteCommunityPlace(name: string) {
  const pool = new Pool({ connectionString: localDatabaseUrl() });
  try {
    await pool.query(
      "delete from public.places where name_key = app.place_key($1)",
      [name],
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
  test.setTimeout(60_000);
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
  await page.getByRole("link", { name: "Other destinations" }).click();

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
  await page.getByLabel("Place", { exact: true }).press("Enter");
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "Use a city or venue name, 2–32 characters.",
  );
  await capture(page, testInfo, "sheet-error-390");

  await page.getByLabel("Place", { exact: true }).fill("athens ");
  await page.getByLabel("Place", { exact: true }).press("Enter");
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

test("R-DEST-11/12/13 suggests, selects, confirms, and clears near matches", async ({
  page,
}, testInfo) => {
  await deleteCommunityPlace("Athens GA");
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, { firstName: "Near", lastName: "Match" });
  await page.goto("/rides/new");
  const athensOption = page
    .getByLabel("To", { exact: true })
    .locator("option")
    .filter({ hasText: /^Athens$/ });
  const athensSlug = await athensOption.getAttribute("value");
  if (!athensSlug) throw new Error("Athens is not available in the picker");
  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill("Athens GA");
  await page.getByRole("button", { name: "Use this place" }).click();
  await expect(
    page.getByRole("heading", { name: "Did you mean…?" }),
  ).toBeVisible();
  const athensSuggestion = page.getByRole("button", {
    name: /Athens · .* upcoming rides?/,
  });
  await expect(athensSuggestion).toBeVisible();
  await capture(page, testInfo, "didyoumean-390");

  await page.getByLabel("Place", { exact: true }).fill("Athens");
  await expect(
    page.getByRole("heading", { name: "Did you mean…?" }),
  ).toHaveCount(0);
  await page.getByLabel("Place", { exact: true }).fill("Athens GA");
  await page.getByRole("button", { name: "Use this place" }).click();
  await expect(
    page.getByRole("heading", { name: "Did you mean…?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Athens · .* upcoming rides?/ })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("To", { exact: true })).toHaveValue(athensSlug);

  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill("Athens GA");
  await page.getByRole("button", { name: "Use this place" }).click();
  await expect(
    page.getByRole("heading", { name: "Did you mean…?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: 'No, add "Athens GA"' }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .getByLabel("To", { exact: true })
      .locator("option")
      .filter({ hasText: "Athens GA" }),
  ).toHaveCount(1);
  await expect(page.getByLabel("To", { exact: true })).not.toHaveValue(
    athensSlug,
  );
});

test("R-DEST-13 32-character near match truncates at 320px", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, { firstName: "Narrow", lastName: "Match" });
  await page.goto("/rides/new");

  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill("Georgia Aquarium");
  await page.getByRole("button", { name: "Use this place" }).click();
  if (await page.getByRole("heading", { name: "Did you mean…?" }).count()) {
    const typedName = await page
      .getByLabel("Place", { exact: true })
      .inputValue();
    await page.getByRole("button", { name: `No, add "${typedName}"` }).click();
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const suffix = Array.from(randomUUID())
    .map((character) =>
      String.fromCharCode(97 + (character.charCodeAt(0) % 26)),
    )
    .join("")
    .slice(0, 15);
  const longName = `Georgia Aquarium ${suffix}`;
  expect(longName).toHaveLength(32);
  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill(longName);
  await page.getByRole("button", { name: "Use this place" }).click();
  await expect(
    page.getByRole("heading", { name: "Did you mean…?" }),
  ).toBeVisible();
  const addButton = page.getByRole("button", {
    name: `No, add "${longName}"`,
  });
  await expect(addButton).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  const addButtonDimensions = await addButton.evaluate((button) => ({
    clientWidth: button.clientWidth,
    scrollWidth: button.scrollWidth,
    labelOverflow: getComputedStyle(button.firstElementChild!).textOverflow,
  }));
  expect(addButtonDimensions.scrollWidth).toBeLessThanOrEqual(
    addButtonDimensions.clientWidth,
  );
  expect(addButtonDimensions.labelOverflow).toBe("ellipsis");
  await capture(page, testInfo, "didyoumean-320");
});

test("R-DEST-2/7 signed-out Other destinations and 320px tabs render without overflow", async ({
  page,
}, testInfo) => {
  await page.context().clearCookies();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?dir=other");
  await expect(
    page.getByRole("navigation", { name: "Ride direction" }).getByRole("link", {
      name: "Other destinations",
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

test("R-DEST-1/6/7/8 post, join, notify, and filter both community directions", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const ownerEmail = uniqueGatechEmail();
  await signInAs(page, ownerEmail);
  await completeProfile(page, { firstName: "Taylor", lastName: "Owner" });
  await page.goto("/rides/new");
  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill("Six Flags");
  await page.getByRole("button", { name: "Use this place" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Post ride" }).click();
  await expect(page.getByText("Your ride is up!")).toBeVisible();
  const firstRideId = new URL(page.url()).pathname.split("/").pop();
  expect(firstRideId).toMatch(/^[0-9a-f-]{36}$/i);
  await capture(page, testInfo, "six-flags-posted-390");

  const calendarResponse = await page
    .context()
    .request.get(`/rides/${firstRideId}/calendar.ics`);
  expect(calendarResponse.status()).toBe(200);
  const calendar = await calendarResponse.text();
  const location = calendar.match(/^LOCATION:(.*)$/m)?.[1] ?? "";
  expect(location).toContain("Six Flags");
  expect(location).not.toMatch(/undefined|null|,,/);

  const riderEmail = uniqueGatechEmail();
  await page.context().clearCookies();
  await signInAs(page, riderEmail);
  await completeProfile(page, { firstName: "Jordan", lastName: "Rider" });
  await page.goto("/?dir=other");
  await page
    .getByRole("navigation", { name: "Filter by place" })
    .getByRole("link", { name: "Six Flags" })
    .click();
  await page.locator(`a[href="/rides/${firstRideId}"]`).click();
  await expect(
    page.getByRole("heading", { name: "Georgia Tech → Six Flags" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Join ride" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Join" }).click();
  await expect(page.getByText("You're in!")).toBeVisible();
  const emailBody = await getLatestEmailBody(ownerEmail, {
    subject: "Jordan R. joined your ride",
  });
  expect(emailBody).toContain("Six Flags");

  await page.goto("/rides/new");
  await page.getByLabel("From", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill("six");
  const sixFlagsSuggestion = page.getByRole("button", {
    name: /Six Flags · .* upcoming ride/,
  });
  await expect(sixFlagsSuggestion).toBeVisible();
  await sixFlagsSuggestion.click();
  await expect(page.getByLabel("To", { exact: true })).toHaveValue("gt");
  await page.getByRole("button", { name: "Post ride" }).click();
  await expect(page.getByText("Your ride is up!")).toBeVisible();
  const reverseRideId = new URL(page.url()).pathname.split("/").pop();
  expect(reverseRideId).toMatch(/^[0-9a-f-]{36}$/i);

  await page.goto("/?dir=other");
  await page
    .getByRole("navigation", { name: "Filter by place" })
    .getByRole("link", { name: "Six Flags" })
    .click();
  await expect(page.locator(`a[href="/rides/${reverseRideId}"]`)).toBeVisible();
});

test("R-DEST-4/6/7 community ride edit, invalid directions, and signed-out link", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, { firstName: "Edit", lastName: "Owner" });
  await page.goto("/rides/new");
  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill("Macon");
  await page.getByRole("button", { name: "Use this place" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("To", { exact: true })).not.toHaveValue(
    "atl-domestic",
  );
  await page.getByRole("button", { name: "Post ride" }).click();
  await expect(page.getByText("Your ride is up!")).toBeVisible();
  const rideId = new URL(page.url()).pathname.split("/").pop();
  expect(rideId).toMatch(/^[0-9a-f-]{36}$/i);

  await page.goto(`/rides/${rideId}/edit`);
  await expect(page.getByRole("heading", { name: "Edit ride" })).toBeVisible();
  const date = await page.locator('input[name="date"]').inputValue();
  const nextDate = new Date(`${date}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  await page.getByLabel("Date").fill(nextDate.toISOString().slice(0, 10));
  await pickTime(page, "11:00");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(`/rides/${rideId}`);
  await expect(page.getByText("11:00 AM", { exact: true })).toBeVisible();

  await page.goto("/?dir=other&place=does-not-exist");
  await expect(
    page.getByRole("navigation", { name: "Ride direction" }).getByRole("link", {
      name: "Other destinations",
    }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto("/?dir=garbage");
  await expect(
    page.getByRole("navigation", { name: "Ride direction" }).getByRole("link", {
      name: "To ATL",
    }),
  ).toHaveAttribute("aria-current", "page");

  await page.context().clearCookies();
  await page.goto(`/rides/${rideId}`);
  const signInLink = page.getByRole("link", {
    name: "Sign in with your GT email to join",
  });
  await expect(signInLink).toBeVisible();
  await expect(signInLink).toHaveAttribute(
    "href",
    `/signin?next=${encodeURIComponent(`/rides/${rideId}`)}`,
  );
  expect(pageErrors).toEqual([]);
});

test("R-DEST-8 similar-rides prompt matches the same community route", async ({
  page,
}) => {
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, { firstName: "First", lastName: "Rider" });
  await page.goto("/rides/new");
  const date = await page.locator('input[name="date"]').inputValue();
  const time = await page.locator('input[name="time"]').inputValue();
  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill("Hartsfield Center");
  await page.getByRole("button", { name: "Use this place" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("To", { exact: true })).not.toHaveValue(
    "atl-domestic",
  );
  const destination = await page.getByLabel("To", { exact: true }).inputValue();
  await page.getByRole("button", { name: "Post ride" }).click();
  await expect(page.getByText("Your ride is up!")).toBeVisible();

  await page.context().clearCookies();
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, { firstName: "Second", lastName: "Rider" });
  await page.goto("/rides/new");
  await page.getByLabel("To", { exact: true }).selectOption(destination);
  await page.getByLabel("Date").fill(date);
  await pickTime(page, time);
  await expect(
    page.locator('section[aria-label="Similar rides"]'),
  ).toBeVisible();
});

test("R-DEST-3/4/7 a 32-character destination truncates and the sheet supports Escape and Enter", async ({
  page,
}, testInfo) => {
  const suffix = Array.from(randomUUID())
    .map((character) =>
      String.fromCharCode(97 + (character.charCodeAt(0) % 26)),
    )
    .join("")
    .slice(0, 11);
  const longName = `The Georgia Aquarium ${suffix}`;
  expect(longName).toHaveLength(32);
  await page.setViewportSize({ width: 320, height: 800 });
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, { firstName: "Long", lastName: "Name" });
  await page.goto("/rides/new");
  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill(longName);
  await page.getByRole("button", { name: "Use this place" }).click();
  await expect(
    page.getByRole("heading", { name: "Did you mean…?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: `No, add "${longName}"` }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("To", { exact: true })).not.toHaveValue(
    "atl-domestic",
  );
  const longSlug = await page.getByLabel("To", { exact: true }).inputValue();
  const formWidth = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(formWidth.scrollWidth).toBeLessThanOrEqual(formWidth.clientWidth);
  await page.getByRole("button", { name: "Post ride" }).click();
  await expect(page.getByText("Your ride is up!")).toBeVisible();

  await page.context().clearCookies();
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, { firstName: "Long", lastName: "Picker" });
  await page.goto("/rides/new");
  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill("The Georgia");
  const suggestionRow = page.getByRole("button", {
    name: new RegExp(`${longName} · .* upcoming ride`),
  });
  await expect(suggestionRow).toBeVisible();
  const suggestionDimensions = await suggestionRow.evaluate((button) => {
    const name = button.querySelector("span");
    return {
      rowClientWidth: button.clientWidth,
      rowScrollWidth: button.scrollWidth,
      nameClientWidth: name?.clientWidth ?? 0,
      nameScrollWidth: name?.scrollWidth ?? 0,
      textOverflow: name ? getComputedStyle(name).textOverflow : "",
    };
  });
  expect(suggestionDimensions.rowScrollWidth).toBeLessThanOrEqual(
    suggestionDimensions.rowClientWidth,
  );
  expect(suggestionDimensions.nameScrollWidth).toBeGreaterThan(
    suggestionDimensions.nameClientWidth,
  );
  expect(suggestionDimensions.textOverflow).toBe("ellipsis");
  await capture(page, testInfo, "suggestion-truncation-320");
  await suggestionRow.click();
  await expect(page.getByLabel("To", { exact: true })).toHaveValue(longSlug);
  const selectedFormWidth = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(selectedFormWidth.scrollWidth).toBeLessThanOrEqual(
    selectedFormWidth.clientWidth,
  );

  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill("The Georgia");
  await page.getByLabel("Place", { exact: true }).press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("To", { exact: true })).toHaveValue(longSlug);

  await page.getByLabel("To", { exact: true }).selectOption("__add-place__");
  await page.getByLabel("Place", { exact: true }).fill("Sandy Springs");
  await page.getByLabel("Place", { exact: true }).press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("To", { exact: true })).not.toHaveValue(
    longSlug,
  );
});
