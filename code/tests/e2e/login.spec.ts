/*
  Test the controlled login page in a real browser.
*/
import { expect, test } from "@playwright/test";

test("shows the login controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("uses a password input for the password field", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
});

test("shows an error when required details are missing", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toHaveText("Error: Enter your email and password.");
  await expect(page.getByRole("alert")).toHaveClass(/error/);
});

test("signs in with the repair-target selector @repair-target", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Email").fill("demo@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.locator("#sign-in-button").click();

  await expect(page.getByRole("status")).toHaveText("Success: Signed in successfully.");
});
