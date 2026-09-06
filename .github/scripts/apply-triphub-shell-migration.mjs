import fs from "node:fs";

function replaceOnce(path, from, to, label) {
  let source = fs.readFileSync(path, "utf8");
  const count = source.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match in ${path}, found ${count}`);
  }
  source = source.replace(from, to);
  fs.writeFileSync(path, source);
}

const shell = "src/components/krew/KrewPageShell.tsx";
replaceOnce(
  shell,
  'export type KrewPageShellSize = "form" | "standard" | "wide" | "site";\n\ntype KrewPageShellProps = ComponentPropsWithoutRef<"main"> & {\n  size?: KrewPageShellSize;\n};',
  'export type KrewPageShellSize = "form" | "standard" | "wide" | "site";\nexport type KrewPageShellGutter = "default" | "compact";\n\ntype KrewPageShellProps = ComponentPropsWithoutRef<"main"> & {\n  size?: KrewPageShellSize;\n  gutter?: KrewPageShellGutter;\n};',
  "shell gutter type",
);
replaceOnce(
  shell,
  'export function KrewPageShell({\n  size = "standard",\n  className,',
  'export function KrewPageShell({\n  size = "standard",\n  gutter = "default",\n  className,',
  "shell gutter default",
);
replaceOnce(
  shell,
  '      data-krew-page-size={size}\n      className={cn("krew-page-shell", className)}',
  '      data-krew-page-size={size}\n      data-krew-page-gutter={gutter}\n      className={cn("krew-page-shell", className)}',
  "shell gutter attribute",
);

const tokens = "src/krew-design-tokens.css";
replaceOnce(
  tokens,
  "  --krew-reading-width: 42rem;\n\n  /* Shared component radii */",
  "  --krew-reading-width: 42rem;\n\n  /* Semantic horizontal gutters. Compact preserves the current TripHub 16px gutter. */\n  --krew-page-padding-x-compact: 16px;\n\n  /* Shared component radii */",
  "compact gutter token",
);
replaceOnce(
  tokens,
  "  padding-inline: var(--krew-page-padding-x);",
  "  padding-inline: var(--krew-page-shell-padding-x, var(--krew-page-padding-x));",
  "shell padding indirection",
);
let tokenSource = fs.readFileSync(tokens, "utf8");
if (tokenSource.includes('[data-krew-page-gutter="compact"]')) {
  throw new Error("compact gutter selector already exists");
}
tokenSource = `${tokenSource.trimEnd()}\n\n.krew-page-shell[data-krew-page-gutter="compact"] {\n  --krew-page-shell-padding-x: var(--krew-page-padding-x-compact);\n}\n`;
fs.writeFileSync(tokens, tokenSource);

const route = "src/routes/_authenticated/trips.$tripId.index.tsx";
replaceOnce(
  route,
  'import { TripHubDashboard } from "@/components/krew/TripHubDashboard.entry";\n',
  'import { TripHubDashboard } from "@/components/krew/TripHubDashboard.entry";\nimport { KrewPageShell } from "@/components/krew/KrewPageShell";\n',
  "TripHub shell import",
);
replaceOnce(
  route,
  '  if (isLoading || !data) {\n    return (\n      <main className="mx-auto max-w-5xl space-y-4 px-4 py-10">\n        <Skeleton className="h-10 w-2/3" />\n        <Skeleton className="h-64 rounded-3xl" />\n      </main>\n    );\n  }',
  '  if (isLoading || !data) {\n    return (\n      <KrewPageShell\n        size="standard"\n        gutter="compact"\n        data-krew-page-surface="trip-hub"\n        className="space-y-4 py-10"\n      >\n        <Skeleton className="h-10 w-2/3" />\n        <Skeleton className="h-64 rounded-3xl" />\n      </KrewPageShell>\n    );\n  }',
  "TripHub loading shell",
);
replaceOnce(
  route,
  '    <main className="mx-auto max-w-5xl px-4 py-10">',
  '    <KrewPageShell size="standard" gutter="compact" data-krew-page-surface="trip-hub" className="py-10">',
  "TripHub page shell opening",
);
let routeSource = fs.readFileSync(route, "utf8");
const closing = "    </main>\n  );\n}\n";
const closeIndex = routeSource.lastIndexOf(closing);
if (closeIndex < 0) throw new Error("TripHub page shell closing marker not found");
routeSource = `${routeSource.slice(0, closeIndex)}    </KrewPageShell>\n  );\n}\n${routeSource.slice(closeIndex + closing.length)}`;
fs.writeFileSync(route, routeSource);

const dashboard = "src/components/krew/TripHubDashboard.tsx";
replaceOnce(
  dashboard,
  'className="relative overflow-visible -mx-4 sm:mx-0 pb-2"',
  'className="relative overflow-visible krew-trip-hub-hero-bleed pb-2"',
  "TripHub hero bleed token owner",
);
replaceOnce(
  dashboard,
  'className="relative z-20 -mt-10 px-4 pt-2"',
  'className="relative z-20 -mt-10 krew-trip-hub-gutter-x pt-2"',
  "TripHub hero inner gutter token owner",
);
replaceOnce(
  dashboard,
  'className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5 px-4 sm:gap-5"',
  'className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5 krew-trip-hub-gutter-x sm:gap-5"',
  "TripHub metadata gutter token owner",
);

const ownerCss = "src/styles/krew-trip-hub.css";
let ownerSource = fs.readFileSync(ownerCss, "utf8");
if (ownerSource.includes(".krew-trip-hub-gutter-x")) {
  throw new Error("TripHub gutter owner styles already exist");
}
ownerSource = `${ownerSource.trimEnd()}\n\n/* Page-gutter alignment now reads from the canonical compact shell token. */\n[data-krew-dashboard-root="true"] .krew-trip-hub-gutter-x {\n  padding-inline: var(--krew-page-padding-x-compact);\n}\n\n[data-krew-dashboard-root="true"] .krew-trip-hub-hero-bleed {\n  margin-inline: calc(var(--krew-page-padding-x-compact) * -1);\n}\n\n@media (min-width: 640px) {\n  [data-krew-dashboard-root="true"] .krew-trip-hub-hero-bleed {\n    margin-inline: 0;\n  }\n}\n`;
fs.writeFileSync(ownerCss, ownerSource);

const test = "src/components/krew/KrewPageShell.test.tsx";
let testSource = fs.readFileSync(test, "utf8");
const final = "\n});\n";
const finalIndex = testSource.lastIndexOf(final);
if (finalIndex < 0) throw new Error("KrewPageShell test closing marker not found");
const addition = `\n  it("exposes the compact 16px TripHub gutter semantically", () => {\n    render(<KrewPageShell size="standard" gutter="compact">Contenu</KrewPageShell>);\n\n    const shell = screen.getByRole("main");\n    expect(shell).toHaveAttribute("data-krew-page-size", "standard");\n    expect(shell).toHaveAttribute("data-krew-page-gutter", "compact");\n  });\n`;
testSource = `${testSource.slice(0, finalIndex)}${addition}${testSource.slice(finalIndex)}`;
fs.writeFileSync(test, testSource);

console.log("TripHub semantic shell patch applied with exact-match guards.");
