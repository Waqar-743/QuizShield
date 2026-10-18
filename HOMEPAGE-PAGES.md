# Homepage artwork for GitHub Pages

This branch starts from production `main` at `b268807cfb7effa5e66aeb68595c87696b7122d6` and copies only the homepage and its original SVG/CSS artwork from staging source `3d953b8550141d8508b300c9a3c5ca88f355046a`.

The nine section-specific illustrations use inline SVG and CSS, so they do not require Vercel, a rendering service, API keys, or an image server. The existing React Router basename follows Vite's `BASE_URL`. The Pages workflow builds with `--base=/QuizShield/`, preserving asset and application links under the repository URL.

## Scope

- Assessment journey, activity review, focus, copy protection, practice, courses, exports, workflow, and private-results artwork.
- Compact artwork for small screens, accessible SVG descriptions, shared animation controls, reduced-motion support, and offscreen animation pausing.
- Existing homepage palette, typefaces, navigation destinations, and frontend architecture.

The administrator implementation, teacher automation changes, authentication changes, camera removal outside the homepage, database migrations, and backend configuration remain on the separate staging branch and PR #6. This targeted update does not release those features. The existing Pages workflow continues to use the existing production API URL. No dependencies or workflow permissions change.

## Publishing constraint

The repository's `github-pages` deployment environment currently permits only `main`. Its Pages workflow runs on pushes to `main` or manual dispatch, but dispatching another branch does not override that environment restriction. The earlier instruction prohibits merging into `main` and deploying production. A specific approval to merge this homepage-only PR is therefore required before publishing. Do not merge the larger staging PR for this purpose, and do not weaken deployment protection rules.

After approval, merge this PR and wait for **Deploy Frontend to GitHub Pages** to finish. Verify <https://waqar-743.github.io/QuizShield/> and its `/QuizShield/login` and `/QuizShield/register` links, section navigation, artwork, and pause/resume controls. Do not deploy the backend or run migrations for this release.

## Rollback

Revert this isolated homepage commit on `main` and let the existing Pages workflow redeploy. This update has no database or provider side effects.

## Verification

See the PR for the Pages-path production build and browser verification results. The same artwork was already reviewed on staging at <https://quizshield-automation-ui.vercel.app/>; source and screenshots are recorded in [the staging artwork guide](https://github.com/Waqar-743/QuizShield/blob/codex/fastn-email-staging/HOMEPAGE-ILLUSTRATIONS.md).
