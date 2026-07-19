/*
  Test the controlled login page in a real browser.
*/
import { expect, test } from "@playwright/test";

test("shows a reviewable static repair proposal", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Repair Console" })).toBeVisible();
  await expect(page.getByText("#sign-in-button", { exact: true })).toBeVisible();
  await expect(page.getByText(/#sign-in-button-v2/)).toBeVisible();
  const approvalButton = page.getByRole("button", { name: "Approve & rerun" });
  await expect(approvalButton).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(approvalButton).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const console = document.querySelector(".repair-console");
    if (!console) return false;
    const bounds = console.getBoundingClientRect();
    return bounds.width < window.innerWidth && bounds.height >= window.innerHeight - 24;
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const console = document.querySelector(".repair-console");
    const timeline = document.querySelector(".repair-timeline");
    if (!console || !timeline) return false;
    return timeline.getBoundingClientRect().bottom >= console.getBoundingClientRect().bottom - 24;
  })).toBe(true);
});

test("keeps the dashboard and controlled login fixture on separate pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Repair Console" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Controlled login fixture" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Repair Console" })).toHaveCount(0);
});

test("shows the login controls", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("uses a password input for the password field", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
});

test("shows an error when required details are missing", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toHaveText("Error: Enter your email and password.");
  await expect(page.getByRole("alert")).toHaveClass(/error/);
});

test("signs in with the repair-target selector @repair-target", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill("demo@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.locator("#sign-in-button").click();

  await expect(page.locator(".toast[role='status']")).toHaveText("Success: Signed in successfully.");
});
