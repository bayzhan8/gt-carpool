import { pickTime } from "./helpers/time";
import { expect, test, type Page } from "@playwright/test";
import { nextDays } from "../lib/time";
import { completeProfile, signInAs, uniqueGatechEmail } from "./helpers/auth";

async function setupMember(page: Page, firstName: string) {
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, {
    firstName,
    lastName: "Browser",
    phone: "(404) 555-0140",
  });
}

async function createRide(
  page: Page,
  {
    dir = "airport",
    date,
    time,
    seats = 4,
  }: {
    dir?: "airport" | "campus";
    date: string;
    time: string;
    seats?: number;
  },
) {
  await page.goto(`/rides/new?dir=${dir}&date=${date}`);
  await expect(page.getByLabel("Date")).toHaveValue(date);
  await pickTime(page, time);
  for (let count = 4; count > seats; count -= 1) {
    await page.getByRole("button", { name: "Decrease seats" }).click();
  }
  for (let count = 4; count < seats; count += 1) {
    await page.getByRole("button", { name: "Increase seats" }).click();
  }
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+$/);
  return page.url();
}

test("direction browsing is local and makes no document or RSC request", async ({
  page,
}) => {
  await setupMember(page, "Alex");
  const date = nextDays(28)[15]!;
  await createRide(page, { date, time: "06:15" });
  await createRide(page, {
    dir: "campus",
    date,
    time: "07:15",
  });

  await page.goto("/");
  const requests: string[] = [];
  await page.waitForTimeout(300);
  page.on("request", (request) => {
    if (
      request.resourceType() === "document" ||
      request.url().includes("_rsc") ||
      request.headers().rsc
    ) {
      requests.push(request.url());
    }
  });

  await page.getByRole("link", { name: "To campus" }).click();
  await expect(page).toHaveURL(/dir=campus/);
  await expect(
    page.getByText("7:15 AM", { exact: true }).first(),
  ).toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:3000/?dir=campus");
  await page.getByRole("button", { name: "Morning" }).click();
  await expect(page).toHaveURL(
    "http://127.0.0.1:3000/?dir=campus&time=morning",
  );
  await expect(page.getByText("6:15 AM", { exact: true })).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("browser Back restores direction, time filter, and ride list", async ({
  page,
}) => {
  await setupMember(page, "Riley");
  const date = nextDays(28)[14]!;
  await createRide(page, { date, time: "08:20" });
  await createRide(page, { dir: "campus", date, time: "07:20" });

  await page.goto("/");
  await page.getByRole("link", { name: "To campus" }).click();
  await page.getByRole("button", { name: "Morning" }).click();
  await expect(page).toHaveURL("/?dir=campus&time=morning");
  await expect(
    page.getByText("7:20 AM", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("8:20 AM", { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL("/privacy");
  await page.goBack();

  await expect(page).toHaveURL("/?dir=campus&time=morning");
  await expect(page.getByRole("link", { name: "To campus" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("button", { name: "Morning" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByText("7:20 AM", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("8:20 AM", { exact: true })).toHaveCount(0);
});

test("day chips filter rides and direct URL loads are filtered on first render", async ({
  page,
}) => {
  await setupMember(page, "Casey");
  const date = nextDays(28)[16]!;
  await createRide(page, { date, time: "08:25" });

  await page.goto(`/?dir=airport&day=${date}`);
  await expect(
    page.getByText("8:25 AM", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Departure day" }).getByRole("link"),
  ).toHaveCount(29);

  await page.goto("/?dir=airport");
  await page
    .locator(
      `nav[aria-label="Departure day"] a[href="/?dir=airport&day=${date}"]`,
    )
    .click();
  await expect(page).toHaveURL(`/?dir=airport&day=${date}`);
  await expect(
    page.getByText("8:25 AM", { exact: true }).first(),
  ).toBeVisible();
});

test("desktop time and seat filters stay within the browse column", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.setViewportSize({ width: 1280, height: 800 });
  await setupMember(page, "Sam");
  const date = nextDays(28)[13]!;
  await createRide(page, { date, time: "09:10" });
  await page.goto(`/?dir=airport&day=${date}`);

  const mainBox = await page.locator("main").boundingBox();
  const seatsBox = await page
    .getByRole("button", { name: "3+ seats" })
    .boundingBox();
  expect(mainBox).not.toBeNull();
  expect(seatsBox).not.toBeNull();
  expect(seatsBox!.x + seatsBox!.width).toBeLessThanOrEqual(
    mainBox!.x + mainBox!.width,
  );
});

test("time and seat filters work, full rides disappear, and filters clear", async ({
  page,
  browser,
}) => {
  await setupMember(page, "Jordan");
  const date = nextDays(28)[27]!;
  const fullRide = await createRide(page, {
    date,
    time: "08:35",
    seats: 2,
  });
  await createRide(page, { date, time: "13:35", seats: 4 });
  await createRide(page, { date, time: "18:35", seats: 5 });

  if (!browser) throw new Error("Browser is unavailable");
  const memberContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
  });
  const member = await memberContext.newPage();
  await setupMember(member, "Taylor");
  await member.goto(fullRide);
  await member.getByRole("button", { name: "Join ride" }).click();
  await member
    .getByRole("dialog")
    .getByRole("button", { name: "Join" })
    .click();
  await expect(member.getByRole("dialog")).toBeHidden();

  await page.goto(`/?dir=airport&day=${date}`);
  await expect(
    page.getByText("8:35 AM", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("1:35 PM", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("6:35 PM", { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Morning" }).click();
  await expect(
    page.getByText("8:35 AM", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("1:35 PM", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "1+ seats" }).click();
  await expect(page.getByText("No rides match these filters.")).toBeVisible();
  await expect(page.getByText("8:35 AM", { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL("/?dir=airport");
  await expect(page.getByRole("link", { name: "Any day" })).toHaveAttribute(
    "aria-current",
    "date",
  );
  await expect(
    page.getByText("8:35 AM", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("1:35 PM", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Evening" }).click();
  await expect(
    page.getByText("6:35 PM", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Any time" }).click();
  await expect(
    page.getByText("8:35 AM", { exact: true }).first(),
  ).toBeVisible();
  await memberContext.close();
});

test("empty filtered day prefills the selected date and direction", async ({
  page,
}) => {
  await setupMember(page, "Morgan");
  const days = nextDays(28);
  await createRide(page, {
    dir: "campus",
    date: days[25]!,
    time: "10:00",
  });

  const emptyDate = days[27]!;
  await page.goto(`/?dir=campus&day=${emptyDate}`);
  await expect(page.getByText("No rides match these filters.")).toBeVisible();
  await page
    .getByText("No rides match these filters.")
    .locator("..")
    .getByRole("link", { name: "Post a ride" })
    .click();
  await expect(page).toHaveURL(`/rides/new?dir=campus&date=${emptyDate}`);
  await expect(page.getByLabel("Date")).toHaveValue(emptyDate);
  await expect(page.locator('input[name="time"]')).toHaveValue("09:00");
  await expect(page.getByLabel("From")).toHaveValue("atl-domestic");
  await expect(page.getByLabel("To", { exact: true })).toHaveValue("gt");
});
