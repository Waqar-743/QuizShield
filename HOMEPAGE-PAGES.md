# Homepage artwork for GitHub Pages

This branch starts from production `main` at `b268807cfb7effa5e66aeb68595c87696b7122d6` and copies only the homepage and its original SVG/CSS artwork from staging source `3d953b8550141d8508b300c9a3c5ca88f355046a`.

The nine section-specific illustrations use inline SVG and CSS, so they do not require Vercel, a rendering service, API keys, or an image server. The existing React Router basename follows Vite's `BASE_URL`. The Pages workflow builds with `--base=/QuizShield/`, preserving asset and application links under the repository URL.

## Scope

- Assessment journey, activity review, focus, copy protection, practice, courses, assessment records, workflow, and teacher-review artwork.
- Compact artwork for small screens, accessible SVG descriptions, shared animation controls, reduced-motion support, and offscreen animation pausing.
- Existing homepage palette, typefaces, navigation destinations, and frontend architecture.

The administrator implementation, teacher automation changes, authentication changes, camera removal outside the homepage, database migrations, and backend configuration remain on the separate staging branch and PR #6. This targeted update does not release those features. The existing Pages workflow continues to use the existing production API URL. No dependencies or workflow permissions change.

## Publishing constraint

The repository's `github-pages` deployment environment permits only `main`. Its Pages workflow runs on pushes to `main` or manual dispatch, but dispatching another branch does not override that environment restriction. On 2026-10-18 the user specifically approved merging and publishing only this homepage update in PR #7. The larger staging PR #6 remains separate. Deployment protection rules remain unchanged.

Production copy is adapted to the existing backend: teacher-reviewed results, scheduled availability, course enrolment and assessment records. It does not promise the staging-only draft/publication lifecycle, explicit results-release action, CSV exports or Google integrations.

After approval, merge this PR and wait for **Deploy Frontend to GitHub Pages** to finish. Verify <https://waqar-743.github.io/QuizShield/> and its `/QuizShield/login` and `/QuizShield/register` links, section navigation, artwork, and pause/resume controls. Do not deploy the backend or run migrations for this release.

## Rollback

Revert this isolated homepage commit on `main` and let the existing Pages workflow redeploy. This update has no database or provider side effects.

## Verification

- Local production build with `VITE_API_URL=https://quiz-shield.vercel.app/api` and `--base=/QuizShield/`: passed. The existing non-blocking large-chunk and Browserslist age warnings remain.
- Scoped ESLint checks on the edited TSX components: passed with zero warnings.
- Real browser checks against the production build at `http://127.0.0.1:4176/QuizShield/`: homepage loaded; all three pause controls changed together from running to paused and back; sign-in and registration links stayed under `/QuizShield/` and rendered their existing pages. No account or API mutation was performed.
- GitHub CI on the initial isolated commit `9b556b0`: backend and frontend jobs passed. Final-head CI and the Pages deployment are recorded in the PR.
- Mobile compact illustrations were reviewed previously on staging. This release reuses their layout and changes production-specific wording; physical devices and OS reduced-motion emulation were not retested.

The same artwork was already reviewed on staging at <https://quizshield-automation-ui.vercel.app/>; source and screenshots are recorded in [the staging artwork guide](https://github.com/Waqar-743/QuizShield/blob/codex/fastn-email-staging/HOMEPAGE-ILLUSTRATIONS.md). This homepage release does not claim that staging's account-management, automation or camera-removal regression coverage applies to the existing production application.
