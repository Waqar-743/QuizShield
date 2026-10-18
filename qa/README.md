# QA evidence — 18 October 2026

## Current administrator and camera retirement acceptance

See [ADMIN-VERIFICATION.md](../ADMIN-VERIFICATION.md) for the current scope, real hosted/provider/browser evidence, automated tests and explicit release blockers. Files prefixed `admin-` and `admin-evidence/` belong to that run. Older reports below document the preserved previous QA work; any face/camera requirements in those historical records are superseded by the current camera-free implementation.

## Earlier QA evidence

Read [the QA review](../QA_REVIEW_2026-10-18.md) for the verdict, issue register, coverage and limitations.

Evidence types are deliberately separate:

- `*-api.json`, `photo-privacy.json`, `direct-database-boundary.json`, `violations-*.json`: real requests to isolated hosted staging. Student identity uses a synthetic descriptor in API harnesses, not a real-person camera acceptance.
- `browser-desktop.json`: browser DOM observations. Entries with `mockedApi: true` use an explicit local in-memory API. A loading observation alone is not a pass.
- `evidence/hosted-*`, teacher and topic screenshots: actual staging browser captures. `homepage-*` and `mock-*` are local UI tests; they do not prove hosted backend behavior.
- `fastn-verification.json`: live saved-workflow runs, independent hosted trigger evidence, and target read-backs. Tokens and message bodies are excluded.
- `dependency-audit-*.json`: package audit snapshots, not penetration-test results.
- `performance-readonly.json`: five small real HTTP samples, not a load or Core Web Vitals test.

Baseline failures are retained to show before/after behavior. A before-file containing failed assertions is expected. Latest named after-files are authoritative for retests. The old `hosted-invalid-login-feedback` capture missed the transient toast; `hosted-invalid-login-error-visible` is the observed error proof. `teacher-analytics-before.jpg` actually shows the automation page and is not analytics evidence.

Camera imagery is excluded. Screenshots containing controlled course/quiz access codes are local-only evidence and must not be published; these exclusions are listed in `.gitignore`. Fixture credentials and operator settings remain in ignored environment or `.vercel` files. Temporary callback inputs were removed after verification.
