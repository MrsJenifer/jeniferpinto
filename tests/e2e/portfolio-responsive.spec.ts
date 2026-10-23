import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const publicRoutes = [
  "/",
  "/about",
  "/projects",
  "/skills",
  "/experience",
  "/education",
  "/achievements",
  "/articles",
  "/contact",
  "/privacy",
];

const widths = [320, 360, 390, 768, 1024, 1440];

test.describe("Portfolio responsive layout", () => {
  for (const width of widths) {
    test(`public pages render without page-level horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const route of publicRoutes) {
        const response = await page.goto(route, { waitUntil: "domcontentloaded" });
        expect(response, `${route} should return a response`).toBeTruthy();
        expect(response!.status(), `${route} should not return an HTTP error`).toBeLessThan(400);
        await expect(page.locator("main"), `${route} should expose a main landmark`).toBeVisible();

        const layout = await page.evaluate(() => ({
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        }));
        expect(layout.document, `${route} document overflow at ${width}px: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(width + 1);
        expect(layout.body, `${route} body overflow at ${width}px: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(width + 1);
      }
    });
  }
});

test("main navigation contains the key portfolio sections and has usable links", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav).toBeVisible();
  for (const label of ["About", "Projects", "Skills", "Experience", "Education", "Achievements", "Articles"]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", /^\//);
  }
});

test("contact form is usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/contact", { waitUntil: "domcontentloaded" });
  for (const label of ["Your name", "Email address", "Enquiry type", "Message"]) {
    await expect(page.getByLabel(label)).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /send enquiry/i })).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(321);
});

test("admin login remains responsive without authenticating", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in securely/i })).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(321);
});

test("public pages have no critical or serious automated WCAG 2.1 A/AA violations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const summaries: Array<{
    route: string;
    id: string;
    impact: string | null;
    help: string;
    nodes: Array<{ target: string[]; html: string; failureSummary: string | null; messages: string[] }>;
  }> = [];
  for (const route of publicRoutes) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${route} should exist for accessibility testing`).toBeLessThan(400);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    for (const violation of result.violations) {
      summaries.push({
        route,
        id: violation.id,
        impact: violation.impact ?? null,
        help: violation.help,
        nodes: violation.nodes.slice(0, 4).map((node) => ({
          target: node.target.map(String),
          html: node.html.slice(0, 600),
          failureSummary: node.failureSummary ?? null,
          messages: [...node.any, ...node.all, ...node.none].map((check) => check.message).slice(0, 6),
        })),
      });
    }
  }
  const serious = summaries.filter((item) => item.impact === "critical" || item.impact === "serious");
  if (summaries.length) console.log("Axe accessibility findings with selectors and affected elements:", JSON.stringify(summaries, null, 2));
  expect(serious, "Resolve critical/serious WCAG findings before release").toEqual([]);
});
test("finance 404 mini-game works on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/__portfolio_404_finance_game_test__");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /this page.*balance sheet/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /quick finance brain break/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next question" })).toBeDisabled();
  await expect(page.locator('[data-game-ready="true"]')).toBeVisible();
  await page.getByRole("button", { name: "20%" }).click();
  await expect(page.getByRole("button", { name: "Next question" })).toBeEnabled();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
});