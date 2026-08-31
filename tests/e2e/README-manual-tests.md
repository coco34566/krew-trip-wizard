# Manual E2E user tests

Tests in this area that are explicitly documented as **manual-only** must never be added to automatic `push` / `pull_request` workflows or to `test:ci`.

They are run only on explicit request with their dedicated environment variables and Playwright project.
