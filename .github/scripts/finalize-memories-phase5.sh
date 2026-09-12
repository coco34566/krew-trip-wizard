#!/usr/bin/env bash
set -euo pipefail

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git fetch origin main
test "$(git rev-list --count origin/main..HEAD)" -eq 6

phase5="$(git rev-parse HEAD)"
phase4="$(git rev-parse HEAD^)"
git checkout -B memories-final "$phase4"
git cherry-pick "$phase5"

python3 <<'PY'
from pathlib import Path

p = Path('src/lib/krew/__tests__/design-state-contract.test.ts')
s = p.read_text()
old = '''    expect(memoriesRoute).toContain(
      '<KrewThinkingState context="generic" customMessage="Chargement des souvenirs…" delayMs={0} />',
    );
    expect(memoriesRoute).not.toContain("KrewJourneyLoadingState");'''
new = '''    expect(memoriesRoute).toContain("<KrewThinkingState");
    expect(memoriesRoute).toContain('context="generic"');
    expect(memoriesRoute).toContain('customMessage="Chargement des souvenirs…"');
    expect(memoriesRoute).toContain("delayMs={0}");
    expect(memoriesRoute).not.toContain("KrewJourneyLoadingState");'''
assert s.count(old) == 1, 'expected D7 Memories source contract block not found exactly once'
p.write_text(s.replace(old, new, 1))
PY

git diff --check
npx vitest run src/lib/krew/__tests__/design-state-contract.test.ts
git add src/lib/krew/__tests__/design-state-contract.test.ts
git commit --amend --no-edit

test "$(git rev-list --count origin/main..HEAD)" -eq 6
echo '=== six final phase commits ==='
git log --oneline --reverse origin/main..HEAD

echo '=== full unit suite ==='
npm run test:unit
echo '=== TypeScript ==='
npx tsc --noEmit
echo '=== build ==='
npm run build
git diff --check origin/main...HEAD

git push --force-with-lease origin HEAD:refactor/memories-architecture-phased
