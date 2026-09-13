import { test, expect } from "@playwright/test";

test("home page loads with watchlist sidebar", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("text=Watchlist")).toBeVisible();
});

test("portfolio page is reachable", async ({ page }) => {
  await page.goto("/portfolio");
  await expect(page).toHaveURL(/portfolio/);
  await expect(page.locator("body")).not.toContainText("404");
});

test("ticker detail page loads", async ({ page }) => {
  await page.goto("/ticker/AAPL");
  await expect(page.locator("body")).not.toContainText("404");
});
