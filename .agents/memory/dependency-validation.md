---
name: Dependency validation
description: Validation constraints for this imported Krew project.
---

Use the committed Bun lockfile for dependency installation and validation. npm on the available Node runtime may reject the imported lockfile or its Vite/Tailwind peer combination even when the project builds successfully with Bun.

**Why:** The imported project has a mixed npm/Bun setup and packages with newer Node engine requirements than the default runtime.

**How to apply:** Prefer `bun install --frozen-lockfile`, then run TypeScript and production-build checks. Treat npm peer-resolution or engine warnings as environment/setup issues unless the project source itself fails validation.