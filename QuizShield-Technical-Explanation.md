# QuizShield - Technical Explanation

## 1. System purpose

QuizShield is a web-based quiz and learning platform focused on academic integrity. The system supports teacher workflows for creating courses, questions, and quizzes, while enforcing stricter student verification and monitoring during login and assessment activity.

## 2. Core architecture

QuizShield is split into three layers:

| Layer | Implementation | Responsibility |
|---|---|---|
| Frontend | React + TypeScript + Vite | UI, routing, state, webcam capture, browser-side proctoring |
| Backend | Express + TypeScript | Authentication, quiz logic, analytics, integrations, API delivery |
| Data / Services | Supabase + external APIs | Persistence, face encodings, AI generation, email |

The frontend communicates with the backend through REST endpoints. The backend uses Supabase as the main datastore and external services for AI and email features.

## 3. Main modules

### Frontend

- React Router-based application with public, protected, student, and teacher routes
- Zustand stores for authentication and shared client state
- `face-api.js` for webcam-based face detection and descriptor generation
- Tailwind CSS for styling

### Backend

- Auth, courses, quizzes, analytics, AI, questions, and notifications routes
- Service layer for core business logic
- JWT-based authentication and role checks
- CORS, logging, and centralized error handling

## 4. Authentication design

### Standard authentication

1. User submits email and password.
2. Backend fetches the user from Supabase.
3. Password is verified with `bcrypt.compare`.
4. Access behavior depends on role.

### Teacher login

Teachers bypass webcam verification. After a valid password check, the backend immediately issues the final JWT.

### Student login

Students must pass two steps:

1. **Credential verification**
2. **Live webcam verification**

After password validation, the backend does **not** return the final session token for students. Instead it returns:

```json
{
  "requiresFaceVerification": true,
  "tempToken": "..."
}
```

The frontend then switches from the login form to the webcam verification view.

## 5. Student face verification flow

### Login step

The backend creates a short-lived temporary JWT with a special `type: "face_verification"` payload. This token proves that the password step already succeeded but does not allow normal authenticated access.

### Webcam step

The frontend:

1. loads `face-api.js` models from `frontend/public/models`
2. requests webcam access
3. captures a live descriptor from the camera stream
4. submits the descriptor and temporary token to `/api/auth/verify-face-login`

### Verification step

The backend:

1. validates the temporary token
2. fetches the user record
3. checks whether a face encoding already exists

Two cases are supported:

#### A. Existing face encoding

- Stored encoding is parsed from the database
- Incoming live encoding is compared using Euclidean distance
- If the distance is below the threshold, the user is verified

#### B. First-time enrollment

- If no stored face encoding exists, the live webcam descriptor is saved to `users.face_encoding`
- That successful enrollment is treated as the verification step
- The final JWT is then issued

This design prevents password-only login for students while still allowing legacy student accounts to enroll after the `face_encoding` column was added.

## 6. Database impact

The student verification flow depends on these user fields:

- `password`
- `role`
- `profile_picture_url`
- `face_encoding`

The required migration is:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_encoding TEXT;
```

That migration is stored in:

```text
backend/migrations/003_add_profile_picture_columns.sql
```

## 7. Quiz integrity controls

QuizShield combines browser and webcam signals during quiz attempts.

### Browser-side controls

- tab visibility checks
- focus and blur monitoring
- blocked context menu
- blocked copy actions
- blocked sensitive keyboard shortcuts

### Webcam-based monitoring

- camera gate before entering a quiz
- live face status tracking during the attempt
- detection states such as `looking`, `away`, and `no_face`
- face-away timer and violation accumulation
- auto-submit when configured limits are exceeded

### Processing location

Face detection runs in the browser through `face-api.js`. Raw webcam video is not sent to the backend for face analysis.

## 8. Security model

### Password security

- Passwords are hashed with bcrypt before storage
- Plain-text passwords are never stored

### Session security

- JWTs are used for authenticated requests
- Student login uses a temporary verification token before the final JWT
- Final JWT is only issued after the full required login flow completes

### Access control

- Middleware protects authenticated routes
- Teacher and student dashboards are separated
- Frontend route guards and backend role checks work together

### CORS

The backend explicitly allows configured frontend origins, including local development and deployed GitHub Pages / GitLab Pages targets.

## 9. API surface

Important endpoints include:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Password step of login |
| POST | `/api/auth/verify-face-login` | Webcam verification for students |
| GET | `/api/auth/me` | Resolve current user |
| POST | `/api/quizzes/start-by-code/:code` | Start quiz by code |
| POST | `/api/quizzes/:attemptId/submit-all` | Submit attempt |
| GET | `/api/analytics/...` | Teacher analytics |

## 10. Frontend route structure

The application separates routes into:

- public routes
- guest-only auth routes
- authenticated routes
- student-only dashboard routes
- teacher-only dashboard routes

This keeps role-specific UX isolated and prevents direct navigation into restricted sections.

## 11. Deployment model

| Part | Deployment target |
|---|---|
| Frontend | GitHub Pages / GitLab Pages |
| Backend | Vercel |
| Database | Supabase |

Because the frontend may be served from a repository subpath, face model files are loaded through Vite `BASE_URL` instead of hard-coded root paths.

## 12. Current strengths

- Enforced student login gate with webcam verification
- Teacher bypass for faster legitimate staff access
- Browser-based proctoring during quiz attempts
- Role-specific dashboards
- AI and analytics support
- Clear frontend/backend separation

## 13. Current limitations

- Face matching depends on webcam quality and lighting
- Legacy accounts may need first-time face enrollment
- Backend does not currently expose a dedicated lint script
- Some advanced reporting and testing flows can still be expanded

## 14. Conclusion

QuizShield is not only a quiz delivery system; it is an integrity-focused assessment platform. Its most important technical rule is that student access is gated by both credential validation and live webcam verification, ensuring the dashboard is not reachable through password-only login.
