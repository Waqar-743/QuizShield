# QuizShield - Project Presentation Report

---

## 1. Project Overview

### What is QuizShield?
QuizShield is a **secure online examination platform** designed to prevent cheating during quizzes. It provides teachers with tools to create and manage quizzes while ensuring academic integrity through real-time monitoring of student behavior.

### Problem Statement
Traditional online quiz systems face these challenges:
- Students can easily switch tabs to search answers
- Copy-paste from external sources is undetectable
- No way to verify if the actual student is taking the exam
- Screenshots can be shared with others

### Our Solution
QuizShield implements **multi-layered proctoring**:
1. Browser activity monitoring (tab switches, keyboard shortcuts)
2. Camera-based face detection (planned feature)
3. Real-time violation tracking with auto-submission
4. AI-powered question generation for unique quizzes

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    React + TypeScript                        │   │
│  │  • Vite (Build Tool)                                        │   │
│  │  • Zustand (State Management)                               │   │
│  │  • Tailwind CSS (Styling)                                   │   │
│  │  • React Router (Navigation)                                │   │
│  │  • Axios (HTTP Client)                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              │ HTTPS REST API                       │
│                              ▼                                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SERVER (Vercel Serverless)                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  Node.js + Express + TypeScript              │   │
│  │  • JWT Authentication                                       │   │
│  │  • bcryptjs (Password Hashing)                              │   │
│  │  • Google Gemini API (AI)                                   │   │
│  │  • Resend (Email Service)                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              │ SQL Queries                          │
│                              ▼                                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DATABASE (Supabase)                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      PostgreSQL                              │   │
│  │  Tables: users, courses, topics, questions, quizzes,        │   │
│  │          quiz_attempts, cheating_violations, notifications  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

| Component | Choice | Reason |
|-----------|--------|--------|
| **Frontend** | React + Vite | Fast development, component reusability, hot reloading |
| **State** | Zustand | Simpler than Redux, no boilerplate, lightweight |
| **Backend** | Express.js | Industry standard, extensive middleware ecosystem |
| **Database** | Supabase (PostgreSQL) | Free tier, real-time capabilities, built-in auth options |
| **Hosting** | Vercel + GitHub Pages | Zero-cost, automatic deployments, serverless scaling |
| **AI** | Google Gemini 2.0 | Free API tier, excellent text generation, fast response |

---

## 3. Key Features Explained

### 3.1 Authentication System

**How it works:**
```
User submits credentials
        │
        ▼
┌───────────────────┐
│ Password Hashing  │ ← bcryptjs (10 salt rounds)
│ bcrypt.compare()  │
└─────────┬─────────┘
          │
          ▼ (if valid)
┌───────────────────┐
│ Generate JWT      │ ← Contains: userId, email, role
│ Expiry: 7 days    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Store in          │
│ localStorage      │
└───────────────────┘
```

**Why JWT?**
- Stateless: Server doesn't store sessions
- Scalable: Works with serverless architecture
- Self-contained: All user info embedded in token
- Secure: Signed with secret key, tamper-proof

### 3.2 Quiz Access Code System

**Problem:** How to securely share quiz access with students?

**Solution:** Auto-generated 4-digit codes

```javascript
// Code Generation Logic
function generateUniqueCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000); // 1000-9999
  } while (await codeExistsInDatabase(code));
  return code.toString();
}
```

**Features:**
- Unique per quiz
- Can generate multiple codes per quiz
- Toggle active/inactive
- Set expiry time
- Track access count

### 3.3 Violation Detection System

**Detection Methods:**

| Violation | Browser API Used | How It Works |
|-----------|-----------------|--------------|
| Tab Switch | Page Visibility API | `document.visibilitychange` event fires when tab loses focus |
| Copy | Clipboard API | `document.oncopy` event intercepted, `e.preventDefault()` |
| Right Click | Context Menu | `document.oncontextmenu` blocked |
| Screenshot | Keyboard API | `PrintScreen` key detected via `keydown` event |
| DevTools | Keyboard API | `Ctrl+Shift+I`, `F12` combinations blocked |

**Code Example (Tab Detection):**
```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Tab switched!
      setViolationCount(prev => prev + 5);
      reportViolationToServer({
        type: 'tab_change',
        timestamp: new Date().toISOString(),
        attemptId: quizAttemptId
      });
      showWarningModal();
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

### 3.4 AI Question Generation

**How Gemini Integration Works:**

```
Teacher Input                    Gemini Prompt                      Output
─────────────                    ─────────────                      ──────
Topic: "Photosynthesis"    →    "Generate 10 MCQ questions    →    JSON array of
Difficulty: "Medium"             about Photosynthesis,              questions with
Count: 10                        difficulty medium,                 options and
                                 with 4 options each..."            correct answers
```

**Why AI Generation?**
- Reduces teacher workload
- Creates unique questions each time
- Adaptive difficulty based on student performance
- Generates explanations for wrong answers

### 3.5 Camera Proctoring (Planned Feature)

**Technical Flow:**
```
WebCam → getUserMedia() → Video Element → Canvas → Face Detection Model → Result
            │                                            │
            │                                            ▼
            │                                   ┌─────────────────┐
            └──────────────────────────────────▶│ Is face present?│
                                                │ Is face forward?│
                                                └────────┬────────┘
                                                         │
                                              ┌──────────┴──────────┐
                                              ▼                     ▼
                                         Yes: Continue         No: Violation
                                                               +5 points
                                                               Start 60s timer
```

**Face Detection Logic:**
- Detect 68 facial landmarks
- Calculate head pose (yaw, pitch, roll)
- Yaw > 30° → Looking left/right
- Pitch > 25° → Looking up/down
- Continuous away > 60 seconds → Auto-submit

---

## 4. Database Schema

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │     │   courses    │     │    topics    │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)      │◄────│ created_by   │     │ id (PK)      │
│ email        │     │ id (PK)      │◄────│ course_id    │
│ password     │     │ title        │     │ title        │
│ name         │     │ description  │     │ content      │
│ role         │     │ category     │     │ order        │
│ created_at   │     │ difficulty   │     │ difficulty   │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                     ┌────────────────────────────┘
                     │
                     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  questions   │     │teacher_quizzes│    │  quiz_attempts   │
├──────────────┤     ├──────────────┤     ├──────────────────┤
│ id (PK)      │     │ id (PK)      │◄────│ quiz_id          │
│ topic_id (FK)│     │ teacher_id   │     │ id (PK)          │
│ question_text│     │ title        │     │ student_id       │
│ type         │     │ access_code  │     │ status           │
│ options      │     │ time_limit   │     │ score            │
│ correct_ans  │     │ questions    │     │ violation_count  │
│ difficulty   │     │ scheduled_at │     │ started_at       │
└──────────────┘     └──────────────┘     │ completed_at     │
                                          │ auto_submitted   │
                                          └────────┬─────────┘
                                                   │
                                                   ▼
                                          ┌──────────────────┐
                                          │cheating_violations│
                                          ├──────────────────┤
                                          │ id (PK)          │
                                          │ attempt_id (FK)  │
                                          │ violation_type   │
                                          │ timestamp        │
                                          │ ip_address       │
                                          │ user_agent       │
                                          └──────────────────┘
```

---

## 5. Security Measures

| Layer | Security Measure | Implementation |
|-------|-----------------|----------------|
| **Password** | Hashing | bcryptjs with 10 salt rounds |
| **API** | Authentication | JWT token in Authorization header |
| **API** | Authorization | Role-based middleware (student/teacher/admin) |
| **Database** | SQL Injection | Parameterized queries via Supabase client |
| **Frontend** | XSS Prevention | React auto-escapes rendered content |
| **CORS** | Cross-Origin | Whitelist allowed origins only |
| **Quiz** | Anti-Cheating | Multi-layer violation detection |

---

## 6. API Endpoints Summary

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/auth/register` | User registration | No |
| POST | `/api/auth/login` | User login | No |
| GET | `/api/auth/me` | Get current user | Yes |
| GET | `/api/courses` | List courses | Yes |
| POST | `/api/courses` | Create course | Yes (Teacher) |
| POST | `/api/quizzes` | Create quiz | Yes (Teacher) |
| POST | `/api/quizzes/start-by-code/:code` | Start quiz by code | Yes (Student) |
| POST | `/api/quizzes/:attemptId/submit-all` | Submit quiz | Yes (Student) |
| POST | `/api/quizzes/attempts/:id/report-violation` | Report violation | Yes |
| GET | `/api/quizzes/teacher/analytics` | Teacher analytics | Yes (Teacher) |

---

## 7. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   GitHub Repository                                             │
│         │                                                       │
│         ├────────────────────┬──────────────────────┐          │
│         │                    │                      │          │
│         ▼                    ▼                      ▼          │
│   ┌──────────┐        ┌──────────┐          ┌──────────┐      │
│   │ GitHub   │        │ Vercel   │          │ Supabase │      │
│   │ Pages    │        │          │          │          │      │
│   │          │        │          │          │          │      │
│   │ Frontend │        │ Backend  │          │ Database │      │
│   │ (Static) │        │ (API)    │          │ (Postgres)│     │
│   └──────────┘        └──────────┘          └──────────┘      │
│        │                   │                      │            │
│        │                   │                      │            │
│        ▼                   ▼                      ▼            │
│   waqar-743.        quizshield-api.      supabase.co/         │
│   github.io/        vercel.app           project-xyz          │
│   QuizShield                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**CI/CD Pipeline:**
1. Push code to GitHub
2. GitHub Actions builds frontend → deploys to GitHub Pages
3. Vercel auto-detects backend changes → deploys serverless functions
4. Database migrations run manually via Supabase dashboard

---

## 8. User Flows

### Teacher Journey:
```
Register → Login → Create Course → Add Topics → Add Questions → Create Quiz
    │                                                              │
    │                                                              ▼
    │                                                    Share 4-digit code
    │                                                    with students
    │                                                              │
    └──────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    View Submissions → Grade → View Analytics
```

### Student Journey:
```
Register → Login → Enter Quiz Code → Start Quiz → Answer Questions
    │                                                    │
    │                                    ┌───────────────┤
    │                                    │               │
    │                            Violations          Complete
    │                            Detected            Quiz
    │                                    │               │
    │                                    ▼               ▼
    │                            Auto-Submit        Submit
    │                                    │               │
    │                                    └───────┬───────┘
    │                                            │
    │                                            ▼
    └──────────────────────────────────  View Results
                                         (after teacher grades)
```

---

## 9. Future Enhancements

| Feature | Status | Description |
|---------|--------|-------------|
| Camera Proctoring | Planned | Face detection for behavior monitoring |
| Multi-Language Support | Planned | UI in multiple languages |
| Question Bank | Planned | Reusable question library |
| Plagiarism Detection | Planned | Compare answers across students |
| Video Recording | Planned | Record exam session for review |
| Mobile App | Planned | React Native version |

---

## 10. Challenges Faced & Solutions

| Challenge | Solution Applied |
|-----------|-----------------|
| CORS errors between frontend/backend | Configured Express CORS middleware with specific origins |
| JWT token expiry handling | Axios interceptor to catch 401 and redirect to login |
| Quiz timing synchronization | Server-side time tracking, not client-side |
| Preventing quiz answer leaks | Questions sent without `correctAnswer` field to student |
| Serverless cold starts | Vercel edge functions, minimal dependencies |

---

# Part 2: Potential Instructor Questions & Answers

---

## Q1: Why did you choose React over Angular or Vue?

**Answer:**
We chose React because:
1. **Component-based architecture** — Easy to build reusable UI components
2. **Large ecosystem** — Extensive library support (React Router, Zustand, etc.)
3. **Industry adoption** — Most popular frontend framework, better for learning industry skills
4. **Virtual DOM** — Efficient rendering for real-time violation updates
5. **TypeScript support** — First-class TypeScript integration for type safety

---

## Q2: How does your authentication system work? Is it secure?

**Answer:**
Our authentication uses **JWT (JSON Web Tokens)**:

1. **Registration:** Password is hashed using bcryptjs (10 salt rounds) before storing
2. **Login:** Password compared using `bcrypt.compare()` — never stored in plain text
3. **Token Generation:** JWT contains user ID, email, and role; signed with secret key
4. **Authorization:** Every protected API checks the JWT in `Authorization: Bearer <token>` header
5. **Security measures:**
   - Tokens expire in 7 days
   - Secret key stored in environment variables
   - Passwords never logged or returned in API responses

---

## Q3: How do you prevent SQL injection attacks?

**Answer:**
We use **Supabase JavaScript client** which:
1. Uses **parameterized queries** internally
2. Never concatenates user input directly into SQL
3. Example:
```javascript
// Safe: Parameterized
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('email', userEmail);  // userEmail is safely escaped

// We NEVER do this:
// const query = `SELECT * FROM users WHERE email = '${userEmail}'`; // UNSAFE!
```

---

## Q4: How does the tab detection actually work technically?

**Answer:**
We use the **Page Visibility API** built into modern browsers:

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // This fires when:
    // - User switches to another tab
    // - User minimizes browser
    // - User opens another application (Alt+Tab)
    // - Screen is locked
    
    reportViolation('tab_change');
  }
});
```

**Why it's reliable:**
- Part of W3C standard, supported by all modern browsers
- Cannot be disabled by user
- Works even when JavaScript is otherwise blocked
- Fires synchronously when visibility changes

---

## Q5: Can a student bypass your cheating detection?

**Answer:**
**Partial bypass is possible**, but we make it difficult:

| Bypass Attempt | Our Countermeasure |
|----------------|-------------------|
| Use second device | Camera proctoring (future) detects looking away |
| Disable JavaScript | Quiz won't load, detection fails gracefully |
| Use browser extensions | Can detect some; DevTools detection catches debugging |
| Take photo of screen | Camera monitors face direction |
| Use virtual machine | Can detect VM in advanced implementations |

**Limitations we acknowledge:**
- Determined cheaters with technical skills can bypass some checks
- Physical cheating (notes, second person) needs camera
- Our goal is to deter casual cheating, not stop sophisticated attacks

---

## Q6: Why Supabase instead of Firebase or MongoDB?

**Answer:**

| Factor | Supabase | Firebase | MongoDB |
|--------|----------|----------|---------|
| **Database** | PostgreSQL (relational) | Firestore (NoSQL) | MongoDB (NoSQL) |
| **SQL Support** | Full SQL | No SQL | No SQL |
| **Relationships** | Native foreign keys | Manual | Manual |
| **Free Tier** | Generous | Limited | Generous |
| **Self-Hosting** | Possible | No | Yes |

**We chose Supabase because:**
1. Quiz data is highly relational (users → courses → topics → questions)
2. PostgreSQL provides ACID compliance for grade integrity
3. Free tier sufficient for academic project
4. Easy migration if we need to self-host later

---

## Q7: How does the AI question generation work?

**Answer:**
We use **Google Gemini 2.0 Flash API**:

```javascript
const prompt = `
Generate ${count} multiple choice questions about "${topic}".
Difficulty: ${difficulty}
Format: JSON array with structure:
{
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": "A",
  "explanation": "..."
}
`;

const response = await gemini.generateContent(prompt);
const questions = JSON.parse(response.text());
```

**Why Gemini?**
1. Free API tier with generous limits
2. Fast response times (~1-2 seconds)
3. Good at structured output (JSON)
4. Supports educational content well

---

## Q8: What happens if the server goes down during a quiz?

**Answer:**
We handle this through:

1. **Client-side answer caching:**
```javascript
// Answers saved to localStorage every time student selects one
localStorage.setItem(`quiz_${attemptId}_answers`, JSON.stringify(answers));
```

2. **Auto-recovery on reconnection:**
```javascript
// On page load, check for cached answers
const cached = localStorage.getItem(`quiz_${attemptId}_answers`);
if (cached) {
  setAnswers(JSON.parse(cached));
  showModal("Recovered your previous answers!");
}
```

3. **Server-side attempt tracking:**
- Attempt status stays "in-progress"
- Student can resume if time hasn't expired
- Violations that occurred are preserved

---

## Q9: How do you ensure quiz timing is accurate?

**Answer:**
**Server-side time tracking:**

```javascript
// Start quiz - server records start time
const startTime = new Date();
await supabase.from('quiz_attempts').insert({
  started_at: startTime,
  // ...
});

// Submit quiz - server calculates duration
const attempt = await supabase.from('quiz_attempts').select('started_at, quiz_id');
const quiz = await supabase.from('quizzes').select('time_limit');

const elapsed = (Date.now() - attempt.started_at) / 1000 / 60; // minutes
if (elapsed > quiz.time_limit) {
  return { error: "Time expired" };
}
```

**Why not client-side?**
- Client clock can be manipulated
- Server is the source of truth
- Network latency handled with grace period

---

## Q10: Explain your state management approach.

**Answer:**
We use **Zustand** instead of Redux:

```typescript
// authStore.ts
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', response.data.token);
    set({ user: response.data.user, token: response.data.token, isAuthenticated: true });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
```

**Why Zustand over Redux?**
1. No boilerplate (no actions, reducers, dispatch)
2. Built-in TypeScript support
3. ~1KB size vs Redux's ~7KB
4. Simple API — just functions and state

---

## Q11: How would you scale this for 10,000 concurrent users?

**Answer:**

| Layer | Current | Scaled Solution |
|-------|---------|-----------------|
| **Frontend** | GitHub Pages | CDN (CloudFlare, Vercel Edge) |
| **Backend** | Vercel Serverless | Multiple regions, auto-scaling |
| **Database** | Supabase Free | Supabase Pro + Read Replicas |
| **Caching** | None | Redis for session/quiz data |
| **Load Balancing** | Vercel handles | Multi-region deployment |

**Code changes needed:**
1. Add Redis caching for frequently accessed data
2. Implement database connection pooling
3. Use WebSockets for real-time violation reporting
4. Add rate limiting to prevent abuse

---

## Q12: What testing have you done?

**Answer:**

| Test Type | Tools | Coverage |
|-----------|-------|----------|
| **Manual Testing** | Browser DevTools | All user flows |
| **API Testing** | Postman/Thunder Client | All endpoints |
| **Unit Testing** | (Planned) Jest | Service functions |
| **E2E Testing** | (Planned) Cypress | Critical paths |

**Manual test cases executed:**
- Registration with valid/invalid data
- Login with correct/incorrect credentials
- Quiz creation and code generation
- Quiz taking with simulated violations
- Grading and analytics viewing

---

## Q13: How does the camera know if I'm looking away?

**Answer:**
Using **face-api.js** or similar library:

1. **Capture frame** from video stream
2. **Detect face** using neural network (returns bounding box)
3. **Detect landmarks** — 68 points on face (eyes, nose, mouth, jawline)
4. **Calculate head pose** using landmark positions:
   - **Yaw** (left-right rotation) — calculated from nose position relative to face center
   - **Pitch** (up-down tilt) — calculated from eye and chin positions
   - **Roll** (head tilt) — calculated from eye alignment

5. **Threshold check:**
   - `|yaw| > 30°` → Looking left/right
   - `|pitch| > 25°` → Looking up/down
   - Either triggers "looking away" state

---

## Q14: What is your API response format?

**Answer:**
We follow a consistent JSON structure:

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect"
  }
}
```

**HTTP Status Codes:**
- `200` — Success
- `201` — Created
- `400` — Bad Request (validation error)
- `401` — Unauthorized (missing/invalid token)
- `403` — Forbidden (wrong role)
- `404` — Not Found
- `500` — Server Error

---

## Q15: How do you handle role-based access control?

**Answer:**
**Middleware-based authorization:**

```typescript
// middleware/auth.ts
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; // Set by JWT middleware
    
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

// Usage in routes
router.post('/quizzes', requireRole('teacher', 'admin'), createQuiz);
router.get('/submissions', requireRole('teacher'), getSubmissions);
router.post('/start-quiz', requireRole('student'), startQuiz);
```

---

## Q16: Why TypeScript instead of JavaScript?

**Answer:**

| Benefit | Example |
|---------|---------|
| **Type Safety** | Catch `undefined` errors at compile time |
| **IntelliSense** | Auto-complete for all properties and methods |
| **Refactoring** | Rename a type, all usages update |
| **Documentation** | Types serve as inline documentation |
| **Team Collaboration** | Clear contracts between functions |

```typescript
// Without TypeScript — runtime error
function gradeQuiz(attempt) {
  return attempt.scor * 100; // typo: "scor" — no error until runtime
}

// With TypeScript — compile-time error
interface QuizAttempt {
  score: number;
  // ...
}
function gradeQuiz(attempt: QuizAttempt) {
  return attempt.scor * 100; // Error: Property 'scor' does not exist
}
```

---

## Q17: How do you handle real-time updates?

**Answer:**
Currently: **Polling** (simple approach)
```javascript
// Check for new notifications every 30 seconds
useEffect(() => {
  const interval = setInterval(fetchNotifications, 30000);
  return () => clearInterval(interval);
}, []);
```

Future enhancement: **WebSockets or Supabase Realtime**
```javascript
// Supabase Realtime subscription
supabase
  .channel('violations')
  .on('INSERT', { table: 'cheating_violations' }, (payload) => {
    showViolationAlert(payload.new);
  })
  .subscribe();
```

---

## Q18: What would you do differently if starting over?

**Answer:**

1. **Add testing from day one** — Would use Jest + RTL for unit tests
2. **Use a monorepo** — Nx or Turborepo for shared types between frontend/backend
3. **Implement WebSockets early** — Real-time violation reporting is important
4. **Better error boundaries** — React Error Boundaries for graceful failures
5. **Add logging service** — Sentry or LogRocket for production debugging
6. **Mobile-first design** — Current UI is desktop-focused

---

## Q19: Explain the violation point system.

**Answer:**

| Action | Points | Reason |
|--------|--------|--------|
| Tab switch | +5 | Likely searching for answers |
| Copy attempt | +5 | Trying to copy question/paste answer |
| Right-click | +5 | Accessing context menu (save, inspect) |
| Screenshot | +5 | Capturing questions to share |
| DevTools | +5 | Inspecting page for answers |
| Face away | +5 | Each time face turns from camera |

**Thresholds:**
- **Warning shown:** Every violation
- **Auto-submit:** 100 points OR face away > 60 seconds

**Why these numbers?**
- 5 points = allows some accidental violations
- 100 threshold = 20 violations before termination (enough for repeated offenders)
- 60 seconds face away = allows brief glances, catches extended looking away

---

## Q20: How secure is data transmission in your system?

**Answer:**

1. **HTTPS Everywhere:**
   - GitHub Pages uses HTTPS by default
   - Vercel uses HTTPS by default
   - Supabase uses HTTPS for all API calls

2. **No sensitive data in URLs:**
   ```javascript
   // Bad: password in URL
   GET /login?password=secret   // ❌
   
   // Good: password in body
   POST /login
   { "password": "secret" }     // ✓
   ```

3. **Token transmission:**
   - JWT in `Authorization` header, not cookies
   - Not stored in URL parameters

4. **Password handling:**
   - Never logged
   - Never returned in API responses
   - Hashed before storage

---

*End of Report*

**Good luck with your presentation!**
