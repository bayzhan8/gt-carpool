import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const artifactDirectory = process.env.M6_ARTIFACT_DIR;

for (const page of ["privacy", "safety"] as const) {
  test(`capture ${page} trust page`, async ({
    page: browserPage,
  }, testInfo) => {
    test.skip(
      !artifactDirectory,
      "Set M6_ARTIFACT_DIR to capture M6 screenshots.",
    );
    const size =
      testInfo.project.name === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1280, height: 800 };
    await browserPage.setViewportSize(size);
    await browserPage.goto(`/${page}`);
    await expect(
      browserPage.getByRole("heading", {
        level: 1,
        name: page === "privacy" ? "Privacy" : "Safety",
      }),
    ).toBeVisible();
    await mkdir(artifactDirectory!, { recursive: true });
    await browserPage.screenshot({
      path: join(artifactDirectory!, `${page}-${testInfo.project.name}.png`),
      scale: "css",
    });
  });
}
