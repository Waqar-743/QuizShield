# Homepage SVG review

See [the research and implementation guide](../../HOMEPAGE-ILLUSTRATIONS.md) and [verification metadata](verification.json).

The `staging-` images are real browser screenshots of the deployed application, not design mockups:

- [Hero](staging-hero.png): assessment journey and brand treatment.
- [Features](staging-features.png): activity review, browser focus and shortcut protection.
- [Feature details](staging-feature-details.png): practice, course submissions and CSV export.
- [Integrity](staging-integrity.png): locked reviewed results in the dark section.
- [Workflow](staging-workflow.png): draft, publish, review and release.

[375px hero](mobile-hero-375.png) and [320px feature](mobile-features-320.png) were captured in embedded viewports rendering the actual local application. They are responsive browser checks, not physical-device screenshots. [Before](before.png) records the original desktop homepage. Operating-system reduced-motion emulation and physical devices were not tested; the static CSS/preference handling was reviewed, and manual pause/resume was exercised locally and on staging.
