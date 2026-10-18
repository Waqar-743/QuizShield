# QuizShield homepage SVG artwork

The homepage now uses nine original SVG illustrations, with separate compact compositions for the hero and activity review. The React, Tailwind and existing brand system remain in place. This change affects the public landing page only; administrator access, assessments, automation, backend services and email restrictions are unchanged.

## Research and design decisions

The starting page used Clash Display and Plus Jakarta Sans, emerald/cyan accents, fine outlines, rounded double-border panels and a dark integrity section. Those choices are retained in the artwork. The existing shield mark informs the hero; documents, browser tabs, course folders and locked results provide section-specific subjects. Generic rings, synthetic charts and the mock live-session student/anomaly counters have been replaced with explicitly labelled workflow illustrations.

Technical research informed the implementation:

- [MDN: SVG viewBox](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox) and [preserveAspectRatio](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/preserveAspectRatio): each scene has a defined coordinate system and scales proportionally into its section. The two densest scenes get compact compositions rather than shrinking all their desktop labels.
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion): the page listens for the operating-system preference and supplies a complete static version. Text and meaning do not depend on movement.
- [W3C: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html): visible controls in the hero, feature and integrity sections pause or resume the entire page's animation set. Reduced motion is honoured independently of the manual controls.

All geometry is original code derived from this application's design. No stock illustration, raster image, video, external animation service or new dependency was added.

## Section mapping

| Section | Artwork | Motion and meaning |
| --- | --- | --- |
| Hero | Draft document → QuizShield checks → locked reviewed result | Gentle document float, a drawn brand check and a travelling connector; dedicated compact hero |
| Activity review | Submitted work beside recorded browser events | Subtle event emphasis; a compact layout keeps annotations readable on narrow screens |
| Tab-switch sentinel | Quiz browser window and focus-event record | A dotted connector and small event-card movement |
| Copy-paste guard | Assessment document, shortcut keys and a lock | Quiet keycap presses illustrate supported browser controls |
| Practice | Released review leading to practice material | A connector and small book movement; no fabricated scores |
| Courses | Course folder and submitted answer sheets | Staggered document emphasis; no invented student counts |
| Exports | Reviewed rows and a CSV file | Review checks and an export document |
| How it works | Draft, publish, review, release | A connecting path reinforces the four existing steps |
| Integrity | A locked reviewed assessment | The lock remains closed; the teacher controls release |

## Implementation and accessibility

- Artwork: [Illustrations.tsx](frontend/src/components/landing/Illustrations.tsx).
- Styling and responsive/static variants: [illustrations.css](frontend/src/components/landing/illustrations.css).
- Placement and page-wide controls: [LandingPage.tsx](frontend/src/pages/LandingPage.tsx).
- SVG titles/descriptions use unique React IDs. Nested decorative glyphs are hidden from assistive technology.
- Animation uses CSS rather than per-frame React updates. Memoized scenes stop their loops outside the viewport and when the document is hidden.
- The pause controls share one state, have visible keyboard focus and expose their pressed state. When the device requests reduced motion, animation stays off and the controls explain why.
- Narrow screens use the compact hero/activity artwork and larger annotations. The navigation switches to the existing mobile menu before desktop links become cramped.

## Validation

Frontend lint, TypeScript and the production build passed. Browser checks exercised the desktop hero and the shared pause/resume state, plus actual application rendering in 375px and 320px embedded browser viewports. The mobile menu opened, selected Features and closed correctly; the compact hero and activity layouts were visually inspected. These embedded viewports are responsive browser tests, not physical-device tests. The operating-system reduced-motion setting was not changed during browser testing; its static CSS and preference handling were reviewed.

Screenshots and final staging/deployment checks are recorded in [qa/homepage-svg](qa/homepage-svg). Temporary responsive-review HTML is excluded from the delivered application. Production and GitHub Pages remain unchanged; the reviewed application is on [Vercel staging](https://quizshield-automation-ui.vercel.app/).
