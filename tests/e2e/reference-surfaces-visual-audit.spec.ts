import { execFileSync } from "node:child_process";
import { rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { handleNormalUserUi, signIn } from "./helpers";

const BASELINE_SHA = "57ba68fda3f95b7cac5a440cfc12c88c77352c2d";
const TRIPHUB_MIGRATION_SHA = "f9396faf1da1717c8e01029126fe9f79850b0313";
const VIEWPORTS = [
  { name: "narrow-mobile", width: 320, height: 568, screenshot: false },
  { name: "mobile", width: 390, height: 844, screenshot: true },
  { name: "mobile-landscape", width: 844, height: 390, screenshot: false },
  { name: "tablet", width: 834, height: 1112, screenshot: true },
  { name: "tablet-landscape", width: 1112, height: 834, screenshot: false },
  { name: "desktop", width: 1440, height: 1000, screenshot: true },
  { name: "wide-desktop", width: 1728, height: 1100, screenshot: false },
] as const;

const SCREENSHOT_SAFE_PIXEL_HEIGHT = 30_000;
const LONG_PAGE_CAPTURE_HEIGHT = 12_000;

type ReferenceMetric = {
  viewport: string;
  page: string;
  width: number;
  scrollWidth: number;
  scrollHeight: number;
  devicePixelRatio: number;
};

type TscSnapshot = {
  sha: string;
  exitCode: number;
  errors: string[];
};

function runTscSnapshot(sha: string, label: string): TscSnapshot {
  const worktree = join(tmpdir(), `krew-tsc-${label}-${process.pid}`);
  const repoRoot = process.cwd();
  const tscBin = join(repoRoot, "node_modules", ".bin", "tsc");

  rmSync(worktree, { recursive: true, force: true });
  execFileSync("git", ["fetch", "--no-tags", "--depth=1", "origin", sha], { cwd: repoRoot, stdio: "pipe" });
  execFileSync("git", ["worktree", "add", "--detach", worktree, sha], { cwd: repoRoot, stdio: "pipe" });
  symlinkSync(join(repoRoot, "node_modules"), join(worktree, "node_modules"), "dir");

  let exitCode = 0;
  let output = "";
  try {
    output = execFileSync(tscBin, ["--noEmit", "--pretty", "false"], {
      cwd: worktree,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error: any) {
    exitCode = typeof error?.status === "number" ? error.status : 1;
    output = `${error?.stdout ?? ""}${error?.stderr ?? ""}`;
  } finally {
    execFileSync("git", ["worktree", "remove", "--force", worktree], { cwd: repoRoot, stdio: "pipe" });
  }

  const errors = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /\berror TS\d+:/.test(line))
    .sort();

  return { sha, exitCode, errors };
}

async function settle(page: Page) {
  await handleNormalUserUi(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector("main .animate-pulse"), undefined, { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(150);
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  metrics: ReferenceMetric[],
  viewport: (typeof VIEWPORTS)[number],
  name: string,
  path: string,
) {
  await page.goto(path);
  await settle(page);
  const geometry = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
  }));
  metrics.push({ viewport: viewport.name, page: name, ...geometry });
  expect(geometry.scrollWidth, `${viewport.name}/${name}: no horizontal overflow`).toBeLessThanOrEqual(geometry.width + 1);

  if (!viewport.screenshot) return;
  const screenshotPath = testInfo.outputPath(`${viewport.name}-${name}.png`);
  const safeCssHeight = Math.max(1, Math.floor(SCREENSHOT_SAFE_PIXEL_HEIGHT / geometry.devicePixelRatio));
  if (geometry.scrollHeight <= safeCssHeight) {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } else {
    const clipHeight = Math.min(geometry.scrollHeight, LONG_PAGE_CAPTURE_HEIGHT, safeCssHeight);
    console.log(
      `[reference-visual] clipping ${viewport.name}/${name} ${path}: scrollHeight=${geometry.scrollHeight}px, dpr=${geometry.devicePixelRatio}, safeCssHeight=${safeCssHeight}px, clipHeight=${clipHeight}px`,
    );
    await page.screenshot({
      path: screenshotPath,
      clip: {
        x: 0,
        y: 0,
        width: geometry.width,
        height: clipHeight,
      },
    });
  }
  await testInfo.attach(`${viewport.name}-${name}`, { path: screenshotPath, contentType: "image/png" });
}

async function firstTripId(page: Page) {
  await page.goto("/dashboard");
  await settle(page);
  const hrefs = await page.locator('a[href*="/trips/"]').evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).getAttribute("href") || ""),
  );
  for (const href of hrefs) {
    const match = href.match(/\/trips\/([0-9a-f-]{36})(?:[/?#]|$)/i);
    if (match?.[1]) return match[1];
  }
  throw new Error("Reference visual audit needs at least one trip on the QA account");
}

test("reference surfaces visual audit", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  test.skip(testInfo.project.name !== "mobile-safari", "Reference audit creates all target viewports itself.");

  const baselineTsc = runTscSnapshot(BASELINE_SHA, "baseline");
  const tripHubTsc = runTscSnapshot(TRIPHUB_MIGRATION_SHA, "triphub");
  const tscDiff = {
    baseline: { sha: baselineTsc.sha, exitCode: baselineTsc.exitCode, count: baselineTsc.errors.length },
    tripHub: { sha: tripHubTsc.sha, exitCode: tripHubTsc.exitCode, count: tripHubTsc.errors.length },
    added: tripHubTsc.errors.filter((line) => !baselineTsc.errors.includes(line)),
    removed: baselineTsc.errors.filter((line) => !tripHubTsc.errors.includes(line)),
  };
  console.log(`[tsc-baseline] ${JSON.stringify(tscDiff)}`);
  await testInfo.attach("tsc-baseline-diff", {
    body: Buffer.from(JSON.stringify({ ...tscDiff, baselineErrors: baselineTsc.errors, tripHubErrors: tripHubTsc.errors }, null, 2)),
    contentType: "application/json",
  });
  expect(tscDiff.added, "TripHub migration must not introduce TypeScript errors vs baseline").toEqual([]);
  expect(tscDiff.removed, "TripHub migration must not hide/remove baseline TypeScript errors").toEqual([]);
  expect(tripHubTsc.errors.length, "TypeScript error count must remain identical to baseline").toBe(baselineTsc.errors.length);

  const metrics: ReferenceMetric[] = [];

  const publicPages = [
    ["landing", "/"],
    ["faq", "/faq"],
    ["tarifs", "/tarifs"],
    ["a-propos", "/a-propos"],
    ["cgu", "/cgu"],
    ["confidentialite", "/confidentialite"],
    ["mentions-legales", "/mentions-legales"],
    ["auth", "/auth"],
  ] as const;

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [name, path] of publicPages) await capture(page, testInfo, metrics, viewport, name, path);
  }

  await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
  await signIn(page);
  const tripId = await firstTripId(page);

  const authenticatedPages = [
    ["mes-voyages", "/dashboard"],
    ["nouveau-voyage", "/trips/new"],
    ["trip-dashboard", `/trips/${tripId}`],
    ["account", "/account"],
    ["recap", `/trips/${tripId}/recap`],
    ["memories", `/trips/${tripId}/memories`],
  ] as const;

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [name, path] of authenticatedPages) await capture(page, testInfo, metrics, viewport, name, path);
  }

  await testInfo.attach("reference-surface-metrics", {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: "application/json",
  });
});
