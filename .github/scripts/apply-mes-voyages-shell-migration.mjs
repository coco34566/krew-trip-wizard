import { readFileSync, writeFileSync } from "node:fs";

function replaceOne(path, from, to) {
  const source = readFileSync(path, "utf8");
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}`);
  writeFileSync(path, source.replace(from, to));
}

const dashboardPath = "src/routes/_authenticated/dashboard.tsx";
let dashboard = readFileSync(dashboardPath, "utf8");
const importAnchor = 'import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";\n';
if ((dashboard.split(importAnchor).length - 1) !== 1) throw new Error("dashboard import anchor mismatch");
dashboard = dashboard.replace(importAnchor, `${importAnchor}import { KrewPageShell } from "@/components/krew/KrewPageShell";\n`);
const oldMain = '<main className="mx-auto max-w-[1180px] space-y-8 overflow-x-clip overflow-y-visible px-4 py-8 sm:space-y-12 sm:px-6 sm:py-10 lg:px-10">';
const newMain = '<KrewPageShell size="wide" gutter="wide" data-krew-page-surface="mes-voyages" className="krew-mes-voyages-shell space-y-8 overflow-x-clip overflow-y-visible sm:space-y-12">';
if ((dashboard.split(oldMain).length - 1) !== 1) throw new Error("dashboard root mismatch");
dashboard = dashboard.replace(oldMain, newMain);
const lastMainClose = dashboard.lastIndexOf("</main>");
if (lastMainClose < 0) throw new Error("dashboard closing main missing");
dashboard = `${dashboard.slice(0, lastMainClose)}</KrewPageShell>${dashboard.slice(lastMainClose + 7)}`;
writeFileSync(dashboardPath, dashboard);

replaceOne(
  "src/components/krew/KrewPageShell.tsx",
  'export type KrewPageShellGutter = "default" | "compact";',
  'export type KrewPageShellGutter = "default" | "compact" | "wide";',
);

const tokensPath = "src/krew-design-tokens.css";
let tokens = readFileSync(tokensPath, "utf8");
for (const [from, to] of [
  ["  --krew-page-padding-x-compact: 16px;\n", "  --krew-page-padding-x-compact: 16px;\n  --krew-page-padding-x-wide: 16px;\n"],
  ["    --krew-page-padding-x: 28px;\n", "    --krew-page-padding-x: 28px;\n    --krew-page-padding-x-wide: 24px;\n"],
  ["    --krew-page-padding-x: 32px;\n", "    --krew-page-padding-x: 32px;\n    --krew-page-padding-x-wide: 40px;\n"],
]) {
  if ((tokens.split(from).length - 1) !== 1) throw new Error(`token anchor mismatch: ${from}`);
  tokens = tokens.replace(from, to);
}
const compactRule = '.krew-page-shell[data-krew-page-gutter="compact"] {\n  --krew-page-shell-padding-x: var(--krew-page-padding-x-compact);\n}';
if ((tokens.split(compactRule).length - 1) !== 1) throw new Error("compact gutter rule mismatch");
tokens = tokens.replace(compactRule, `${compactRule}\n\n.krew-page-shell[data-krew-page-gutter="wide"] {\n  --krew-page-shell-padding-x: var(--krew-page-padding-x-wide);\n}`);
writeFileSync(tokensPath, tokens);

const mesPath = "src/styles/krew-mes-voyages.css";
let mes = readFileSync(mesPath, "utf8").trimEnd();
if (mes.includes(".krew-mes-voyages-shell")) throw new Error("Mes voyages semantic rules already present");
mes += `\n\n.krew-mes-voyages-shell {\n  padding-block: var(--krew-page-padding-y);\n}\n\n[data-krew-page-surface="mes-voyages"] > header > div[class*="max-w-[680px]"] > div:first-child { animation: krew-dashboard-header-in 1050ms cubic-bezier(.18,.74,.24,1) both; }\n[data-krew-page-surface="mes-voyages"] > header > div[class*="max-w-[680px]"] > p { animation: krew-dashboard-copy-in 920ms cubic-bezier(.18,.74,.24,1) 180ms both; }\n[data-krew-page-surface="mes-voyages"] > header > div[class*="max-w-[680px]"] > div:first-child > svg path {\n  stroke-dasharray: 140;\n  stroke-dashoffset: 140;\n  animation: krew-dashboard-line-draw 1350ms cubic-bezier(.32,0,.18,1) 420ms forwards;\n}\n[data-krew-page-surface="mes-voyages"] > header a[data-slot="button"][href="/trips/new"] {\n  animation: krew-dashboard-cta-in 820ms cubic-bezier(.18,.74,.24,1) 250ms both;\n}\n[data-krew-page-surface="mes-voyages"] h2 + svg[class*="w-[92px]"] { bottom: -1.25rem !important; }\n\n@media (max-width: 639px) {\n  [data-krew-page-surface="mes-voyages"] > header {\n    display: grid;\n    grid-template-columns: minmax(0, 1fr) auto;\n    grid-template-rows: auto auto;\n    min-height: 0;\n    column-gap: 8px;\n    row-gap: 10px;\n    align-items: start;\n  }\n  [data-krew-page-surface="mes-voyages"] > header > div[class*="max-w-[680px]"] { display: contents; }\n  [data-krew-page-surface="mes-voyages"] > header > div[class*="max-w-[680px]"] > div:first-child { grid-column: 1; grid-row: 1; min-width: 0; }\n  [data-krew-page-surface="mes-voyages"] > header > div[class*="max-w-[680px]"] > p {\n    grid-column: 1 / -1;\n    grid-row: 2;\n    width: 100%;\n    max-width: none;\n    margin-top: 0;\n    line-height: 1.45;\n  }\n  [data-krew-page-surface="mes-voyages"] > header a[data-slot="button"][href="/trips/new"] {\n    grid-column: 2;\n    grid-row: 1;\n    align-self: center;\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  [data-krew-page-surface="mes-voyages"] > header > div[class*="max-w-[680px]"] > div:first-child,\n  [data-krew-page-surface="mes-voyages"] > header > div[class*="max-w-[680px]"] > p,\n  [data-krew-page-surface="mes-voyages"] > header a[data-slot="button"][href="/trips/new"] {\n    animation: none !important;\n    opacity: 1 !important;\n    transform: none !important;\n  }\n  [data-krew-page-surface="mes-voyages"] > header > div[class*="max-w-[680px]"] > div:first-child > svg path {\n    stroke-dasharray: none !important;\n    stroke-dashoffset: 0 !important;\n    animation: none !important;\n    opacity: 1 !important;\n  }\n}\n`;
writeFileSync(mesPath, mes);

const visualPath = "tests/e2e/design-system-migration-visual.spec.ts";
let visual = readFileSync(visualPath, "utf8").trimEnd();
if (visual.includes("Mes voyages migration remains pixel-identical")) throw new Error("Mes voyages visual proof already present");
visual += `\n\ntest("Mes voyages migration remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {\n  test.setTimeout(360_000);\n  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");\n  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");\n  const current = await openAuthenticatedPage(browser, CURRENT_URL);\n  const before = await openAuthenticatedPage(browser, BEFORE_URL);\n  try {\n    for (const viewport of VIEWPORTS) {\n      const currentScreenshot = await captureMain(current.page, "/dashboard", viewport);\n      await testInfo.attach(\`after-\${viewport.name}-mes-voyages\`, { body: currentScreenshot, contentType: "image/png" });\n      const beforeScreenshot = await captureMain(before.page, "/dashboard", viewport);\n      await testInfo.attach(\`before-\${viewport.name}-mes-voyages\`, { body: beforeScreenshot, contentType: "image/png" });\n      const snapshotName = \`runtime-before-\${viewport.name}-mes-voyages.png\`;\n      const snapshotPath = testInfo.snapshotPath(snapshotName);\n      mkdirSync(dirname(snapshotPath), { recursive: true });\n      writeFileSync(snapshotPath, beforeScreenshot);\n      expect(currentScreenshot).toMatchSnapshot(snapshotName, { threshold: 0, maxDiffPixels: 0 });\n    }\n  } finally {\n    await current.context.close();\n    await before.context.close();\n  }\n});\n`;
writeFileSync(visualPath, visual);
