# QuizShield - Presentation Report

## 1. Project summary

QuizShield is a secure quiz platform built for online learning environments where identity verification and exam integrity matter. It helps teachers create and manage quizzes while forcing students through stricter verification and monitoring flows.

## 2. Problem being solved

Common weaknesses in online quiz systems include:

- students switching tabs to search answers
- copy/paste misuse
- weak identity verification at login
- lack of monitoring during the attempt

QuizShield addresses these gaps by combining authentication, quiz management, browser monitoring, and webcam-based face checks.

## 3. Key value of the system

### For teachers

- create and manage courses, topics, questions, and quizzes
- share quiz access codes
- review submissions and analytics
- use AI-assisted features to speed up content workflows

### For students

- access learning content and quizzes
- join quizzes by code
- complete assessments in a monitored environment

## 4. Most important implemented security rule

The main enforcement rule in the current system is:

> A student cannot enter the dashboard with email and password alone.

Student login is now a strict two-step process:

1. email/password validation
2. live webcam face verification

Teachers are intentionally excluded from this webcam step and can log in directly after password validation.

## 5. Student login flow

```text
Student enters email/password
        ↓
Backend validates credentials
        ↓
Backend returns tempToken + requiresFaceVerification
        ↓
Frontend hides login form and opens webcam step
        ↓
Student clicks verify
        ↓
Live face descriptor sent to /api/auth/verify-face-login
        ↓
Final JWT issued only after successful verification
        ↓
Student enters dashboard
```

If the student does not yet have a saved face encoding, the first live verification is used to enroll it for future logins.

## 6. System architecture

```text
Frontend (React + TypeScript + Vite)
        ↓
REST API over HTTPS
        ↓
Backend (Express + TypeScript)
        ↓
Supabase PostgreSQL + External Services
```

### Technology choices

| Area | Technology | Reason |
|---|---|---|
| Frontend | React + TypeScript | component-based UI and safer code |
| State | Zustand | lightweight global state |
| Styling | Tailwind CSS | fast UI development |
| Webcam / face detection | face-api.js | browser-side face detection and descriptors |
| Backend | Express | simple API structure and middleware support |
| Database | Supabase PostgreSQL | relational data and hosted infrastructure |
| Authentication | JWT + bcrypt | secure session and password flow |
| AI | Google Generative AI | question and learning assistance |

## 7. Main implemented features

### Authentication and access control

- registration and login
- JWT-based protected routes
- role-aware routing for teachers and students
- student webcam verification during login

### Quiz and course management

- course and topic organization
- question management
- quiz creation and student access by code
- submission and result flows

### Integrity and monitoring

- tab visibility monitoring
- restricted browser actions
- webcam check before quiz access
- webcam face status tracking during attempts
- violation counting and auto-submit behavior

### Analytics and reporting

- teacher analytics endpoints
- dashboard views for summaries and performance review

## 8. Security approach

QuizShield uses layered controls instead of depending on a single defense.

### Layer 1: Password security

- passwords are hashed with bcrypt
- plain-text passwords are never stored

### Layer 2: Session control

- JWT is used for authenticated access
- student login uses a temporary token before final access is granted

### Layer 3: Role separation

- teacher and student dashboards are separated
- protected routes prevent direct unauthorized access

### Layer 4: Browser monitoring

- tab switching and other suspicious client actions are tracked during quiz attempts

### Layer 5: Webcam verification

- student identity is checked with live webcam capture
- quiz monitoring also uses webcam-based face detection

## 9. Database considerations

The user record now includes support for face verification with:

- `profile_picture_url`
- `face_encoding`

This enables:

- student face enrollment
- future face comparison at login

## 10. Deployment model

| Part | Platform |
|---|---|
| Frontend | GitHub Pages / GitLab Pages |
| Backend | Vercel |
| Database | Supabase |

The frontend also ships the required `face-api.js` model files so webcam verification works in deployed environments.

## 11. Challenges solved

| Challenge | Solution |
|---|---|
| Students bypassing login verification | mandatory student webcam step added |
| Legacy users missing stored face data | first successful live verification now enrolls face data |
| Multi-origin frontend deployment | backend CORS rules updated for local and deployed origins |
| Client-side face model loading on hosted subpaths | models served through Vite base path aware setup |

## 12. Current outcome

QuizShield is now stronger in the exact area that mattered most: identity verification before student access. The system no longer allows student dashboard access after password-only authentication.

## 13. Future improvement ideas

- stronger automated testing coverage
- more advanced reporting/export flows
- real-time alerts for teachers
- expanded analytics and question bank tooling

## 14. Conclusion

QuizShield is more than a quiz app. It is a security-focused assessment platform that combines user roles, protected workflows, browser monitoring, and live webcam verification to make online testing more trustworthy.
