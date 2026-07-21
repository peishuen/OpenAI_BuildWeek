/*
  Test the controlled login page in a real browser.
*/
import { expect, test } from "@playwright/test";

test("shows a repair run ready to start", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Repair Console" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sandbox workspace" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sandbox workspace" })).toBeVisible();
  await expect(page.getByText("Fixture state:", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Offline fixture fallback")).toBeVisible();
  await expect(page.getByText("This affects only the bundled login fixture and Playwright repair target.")).toHaveCount(0);
  await expect(page.getByText("Selected provider:", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Start a repair run to capture the known failing test.")).toBeVisible();
  const startButton = page.getByRole("button", { name: "Start repair" });
  await expect(startButton).toBeEnabled();
  await startButton.focus();
  await expect(startButton).toBeFocused();
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
  await expect.poll(() => page.evaluate(() => {
    const sandboxButtons = [...document.querySelectorAll<HTMLElement>(".sandbox-actions .secondary-button")];
    if (sandboxButtons.length !== 2) return false;
    const heights = sandboxButtons.map((button) => button.getBoundingClientRect().height);
    return Math.abs(heights[0] - heights[1]) <= 1 && heights.every((height) => height >= 40 && height <= 42);
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const divider = document.querySelector<HTMLElement>(".action-divider");
    const sandboxButtons = [...document.querySelectorAll<HTMLElement>(".sandbox-actions .secondary-button")];
    if (!divider || sandboxButtons.length !== 2) return false;
    return divider.getBoundingClientRect().top >= Math.max(...sandboxButtons.map((button) => button.getBoundingClientRect().bottom)) + 8;
  })).toBe(true);

  await page.setViewportSize({ width: 1024, height: 720 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Start repair" })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
});

test("toggles the fixed selector regression twice without terminal access @sandbox-only", async ({ page }) => {
  await page.goto("/");

  const simulateButton = page.getByRole("button", { name: "Simulate selector regression" });
  const sandboxStatus = page.getByRole("status");
  await expect(simulateButton).toBeEnabled();
  await simulateButton.click();
  await expect(sandboxStatus).toContainText("selector regression simulated");
  await expect(simulateButton).toBeEnabled();

  await simulateButton.click();
  await expect(sandboxStatus).toContainText("baseline");
  await expect(simulateButton).toBeEnabled();
});

test("gives the proposed repair room to show its selector change @baseline-only", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/");

  await page.getByLabel("Offline fixture fallback").check();
  await page.getByRole("button", { name: "Simulate selector regression" }).click();
  await page.getByRole("button", { name: "Start repair" }).click();

  const selectorChange = page.getByLabel("Proposed selector change");
  await expect(selectorChange).toBeVisible({ timeout: 35_000 });
  await expect(page.getByRole("button", { name: "Approve & rerun" })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => {
    const sections = [...document.querySelectorAll<HTMLElement>(".repair-action-section")];
    const selectorChange = document.querySelector<HTMLElement>(".selector-diff");
    if (sections.length !== 2 || !selectorChange) return false;
    return sections[1].getBoundingClientRect().height > sections[0].getBoundingClientRect().height
      && selectorChange.scrollHeight <= selectorChange.clientHeight;
  })).toBe(true);
  await page.getByRole("button", { name: "Reset sandbox" }).click();
  await expect(page.getByRole("status")).toContainText("baseline");
});

test("reports a safe repair failure when the target test is already green @baseline-only", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Start repair" }).click();

  await expect(page.getByRole("alert")).toHaveText("The repair target unexpectedly passed.");
  await expect(page.getByRole("button", { name: "Start repair" })).toBeDisabled();
  await expect.poll(() => page.getByRole("alert").evaluate((message) => (
    message.scrollWidth <= message.clientWidth
  ))).toBe(true);
  await page.getByRole("button", { name: "Reset sandbox" }).click();
  await expect(page.getByRole("button", { name: "Start repair" })).toBeEnabled();
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
  await page.locator("#sign-in-button-v2").click();

  await expect(page.locator(".toast[role='status']")).toHaveText("Success: Signed in successfully.");
});
