# QuizShield - Technical Report (Detailed Explanation)

---

## 1. What is QuizShield?

**Simple Explanation:** QuizShield is like an online exam hall with security cameras. Just like a real exam hall has invigilators watching students, QuizShield watches what students do on their computer during a quiz.

**Problem it solves:**
- Students open Google in another tab to search answers
- Students copy questions and paste in ChatGPT
- Someone else might be taking the exam instead of the actual student
- Students share screenshots of questions with friends

**Our Solution - Multi-layered proctoring:**
1. Browser activity monitoring (tab switches, keyboard shortcuts)
2. Camera-based face detection (planned feature)
3. Real-time violation tracking with auto-submission
4. AI-powered question generation for unique quizzes

---

## 2. System Architecture (How the Parts Connect)

Think of it like a restaurant:

| Component | Restaurant Analogy | What It Does |
|-----------|-------------------|--------------|
| **Frontend (React)** | The dining area where customers sit | What users see and interact with |
| **Backend (Express)** | The kitchen | Processes requests, applies business logic |
| **Database (Supabase)** | The storage room / inventory | Stores all data permanently |
| **API** | Waiters | Carries requests from frontend to backend |

### Data Flow Example: Student Submits Quiz

1. User clicks "Submit Quiz" button
2. Frontend (React) creates a request with answers
3. Axios sends HTTP POST request to server
4. Request travels over internet via HTTPS
5. Backend (Express) receives request
6. Backend validates JWT token (checks if user is logged in)
7. Backend runs business logic (calculate score, check violations)
8. Backend saves results to Supabase database
9. Backend sends response back to frontend
10. Frontend shows "Quiz Submitted!" message to user

---

## 3. Why These Technologies?

### React (Frontend Framework)

**What it is:** A JavaScript library for building user interfaces

**Why we use it:**
- **Components:** Build once, reuse everywhere. Example: One Button component used in 50 places
- **Virtual DOM:** React only updates what changed, not the whole page (faster)
- **One-way data flow:** Data flows parent → child, easier to debug
- **Large ecosystem:** Many libraries available (React Router, Zustand, etc.)
- **Industry standard:** Most popular frontend framework, good for learning industry skills

### TypeScript (Programming Language)

**What it is:** JavaScript with type checking

**Why we use it:**
- Catches errors at compile time instead of runtime
- Auto-complete for all properties and methods (IntelliSense)
- Refactoring is safer - rename a type, all usages update
- Types serve as inline documentation
- Clear contracts between functions for team collaboration

### Zustand (State Management)

**What it is:** A library to share data between components

**Problem it solves:**
Without Zustand, to pass user data from App to Header, you need to pass it through every component in between (called "prop drilling"). With Zustand, any component can directly access user data from a shared store.

**Why Zustand over Redux:**
- No boilerplate (no actions, reducers, dispatch)
- Built-in TypeScript support
- ~1KB size vs Redux's ~7KB
- Simple API — just functions and state

### Express.js (Backend Framework)

**What it is:** A web server framework for Node.js

**Why we use it:**
- Industry standard for Node.js backends
- Simple routing system
- Extensive middleware ecosystem
- Easy to learn and use
- Great documentation and community support

### Supabase (Database)

**What it is:** A cloud PostgreSQL database with additional features

**Why PostgreSQL over MongoDB:**

| Feature | PostgreSQL (Supabase) | MongoDB |
|---------|----------------------|---------|
| Data structure | Tables with rows/columns | Documents (JSON-like) |
| Relationships | Native foreign keys | Manual references |
| Data integrity | ACID compliant | Eventually consistent |
| Schema | Enforced (safer) | Flexible (can be messy) |

**Our data is highly relational:**
- User creates Course which has Topics which have Questions
- User takes Quiz which creates Attempt which has Violations

PostgreSQL handles these relationships naturally with foreign keys.

---

## 4. Authentication System Explained

### What is JWT?

**JWT = JSON Web Token**

Think of it like a wristband at a concert:
- You show ID at entrance → get wristband
- Wristband proves you paid → can enter any area
- Wristband has info encoded → staff can read it
- Wristband expires at midnight → need new one next day

**JWT Structure (3 parts separated by dots):**
1. **Header:** Algorithm used (HS256) + type (JWT)
2. **Payload:** User data (userId, email, role, expiry time)
3. **Signature:** Encrypted hash to prevent tampering

**Why JWT?**
- Stateless: Server doesn't need to store sessions
- Scalable: Works with serverless architecture
- Self-contained: All user info embedded in token
- Secure: Signed with secret key, tamper-proof

### Password Hashing with bcrypt

**Why hash?** If database is hacked, attacker can't see real passwords.

**How it works:**
1. User enters password: "mypassword123"
2. bcrypt generates random salt
3. Password + salt goes through hash function 2^10 times (10 rounds)
4. Result is a long string that cannot be reversed

**Login verification:**
- bcrypt does NOT decrypt the stored hash
- It hashes the input the same way and compares the two hashes
- If hashes match, password is correct

**Why 10 rounds?**
- Each round doubles the computation time
- 10 rounds ≈ 100ms to hash one password
- Attacker trying 1 billion passwords would take ~3 years

---

## 5. How Tab Detection Works (Technical Deep Dive)

### Page Visibility API

**What is it?** A browser API that tells you when the page is visible or hidden.

**Browser states:**
- **Visible:** User is looking at your page (tab is active, browser in front)
- **Hidden:** User switched to another tab, minimized browser, opened another app, or locked screen

**What triggers the hidden state:**
| Action | Event Fires? |
|--------|--------------|
| Click another tab | YES |
| Alt+Tab to another app | YES |
| Click on taskbar to minimize | YES |
| Lock screen (Win+L) | YES |
| Second monitor with other app focused | YES |
| Resize browser window | NO |
| Scroll page | NO |
| Click elsewhere on same page | NO |

**Why Browser Knows:**
- The browser is the "host" — it controls everything
- When you switch tabs, the browser MUST fire this event
- JavaScript cannot block or fake this event
- Works even in incognito mode
- Built into browser engine, cannot be bypassed by user

---

## 6. How Camera Face Detection Works (Technical Deep Dive)

### Step 1: Get Camera Access

The browser shows "Allow camera?" popup. If user allows, we get a video stream from the webcam. This stream is attached to a video element on the page.

### Step 2: Capture Frames

A hidden canvas element captures screenshots from the video stream. This happens every 300 milliseconds (about 3 frames per second). Each frame is converted to image data for analysis.

### Step 3: Detect Faces

A machine learning model (like face-api.js) analyzes each frame:
- Finds faces in the image
- Returns bounding box (where face is located)
- Detects 68 landmark points (eyes, nose, mouth, jawline)
- Calculates head pose angles

### Step 4: Calculate Head Pose

**The 68 Landmarks:**
- Points 0-16: Jaw outline
- Points 17-21: Left eyebrow
- Points 22-26: Right eyebrow
- Points 27-30: Nose bridge
- Points 31-35: Nose bottom
- Points 36-41: Left eye
- Points 42-47: Right eye
- Points 48-59: Outer lip
- Points 60-67: Inner lip

**How head direction is calculated:**
1. Identify key reference points (nose tip, chin, eye corners)
2. Calculate relative positions of these points
3. Apply mathematical algorithms (PnP - Perspective-n-Point)
4. Convert 2D positions to 3D rotation angles

### Step 5: Determine "Looking Away"

**Head Pose Angles:**

| Angle | Movement | "Looking Away" Threshold |
|-------|----------|-------------------------|
| **Yaw** | Left ↔ Right | More than 30° either direction |
| **Pitch** | Up ↔ Down | More than 25° either direction |
| **Roll** | Tilt head | More than 20° (optional) |

**Logic:**
- If no face detected → Looking away
- If face detected but yaw > 30° → Looking left/right
- If face detected but pitch > 25° → Looking up/down
- Otherwise → Looking at camera (OK)

### Step 6: Handle Violations

**State Machine:**
1. **LOOKING (Normal):** Face detected, facing camera
2. **LOOKING AWAY:** Face turns away, timer starts, +5 points
3. **AUTO-SUBMIT:** If away > 60 seconds OR total violations ≥ 100

**Each time face turns away:**
- Add +5 violation points
- Start 60-second timer
- If face returns, timer resets (but points remain)
- If timer reaches 60 seconds, quiz auto-submits

---

## 7. Database Design Explained

### Why Tables Instead of JSON Files?

| Aspect | JSON Files | PostgreSQL Tables |
|--------|------------|-------------------|
| Search speed | Slow (read entire file) | Fast (indexed queries) |
| Concurrent access | Problems (file locks) | Handles thousands |
| Data integrity | None | Constraints, foreign keys |
| Relationships | Manual linking | Native joins |

### Our Main Tables

**Users Table:**
- id: Unique identifier (UUID)
- email: User's email (unique)
- password: bcrypt hash (never plain text)
- name: Display name
- role: 'student', 'teacher', or 'admin'
- created_at: When account was created

**Quiz Attempts Table:**
- id: Unique identifier
- quiz_id: Links to which quiz
- student_id: Links to which student
- status: 'in-progress', 'completed', etc.
- score: Points earned
- violation_count: Total violation points
- auto_submitted: Whether quiz was auto-submitted
- submission_reason: Why it was auto-submitted
- started_at: When student started
- completed_at: When student finished

**Cheating Violations Table:**
- id: Unique identifier
- attempt_id: Links to which attempt
- violation_type: 'tab_change', 'copy', 'face_away', etc.
- timestamp: When violation occurred
- ip_address: Student's IP
- user_agent: Browser info

### Foreign Key Explanation

A foreign key ensures data integrity. For example:
- quiz_id in quiz_attempts MUST match an existing id in teacher_quizzes
- If someone tries to insert a fake quiz_id → Database throws error
- If someone tries to delete a quiz that has attempts → Database prevents it (or cascades)

---

## 8. API Design Explained

### RESTful API Principles

**REST = Representational State Transfer**

| HTTP Method | Purpose | Example |
|-------------|---------|---------|
| GET | Read data | GET /users → list all users |
| POST | Create new | POST /users → create new user |
| PUT | Update existing | PUT /users/123 → update user 123 |
| DELETE | Remove | DELETE /users/123 → delete user 123 |

### Our Key API Endpoints

| Method | Endpoint | Purpose | Who Can Access |
|--------|----------|---------|----------------|
| POST | /api/auth/register | User registration | Anyone |
| POST | /api/auth/login | User login | Anyone |
| GET | /api/auth/me | Get current user | Logged in users |
| GET | /api/courses | List courses | Logged in users |
| POST | /api/courses | Create course | Teachers only |
| POST | /api/quizzes | Create quiz | Teachers only |
| POST | /api/quizzes/start-by-code/:code | Start quiz | Students only |
| POST | /api/quizzes/:attemptId/submit-all | Submit quiz | Students only |
| POST | /api/quizzes/attempts/:id/report-violation | Report violation | Logged in users |
| GET | /api/quizzes/teacher/analytics | Teacher analytics | Teachers only |

### API Response Format

**Success Response:**
- success: true
- data: The requested information
- message: Human-readable confirmation

**Error Response:**
- success: false
- error.code: Machine-readable error code
- error.message: Human-readable explanation

**HTTP Status Codes We Use:**
- 200: Success
- 201: Created (new resource made)
- 400: Bad Request (validation error)
- 401: Unauthorized (not logged in)
- 403: Forbidden (wrong role)
- 404: Not Found
- 500: Server Error

---

## 9. Security Measures Explained

### 1. Password Security (bcrypt)

- Passwords are hashed with 10 rounds of bcrypt
- Salt is randomly generated for each password
- Even identical passwords have different hashes
- Original password cannot be recovered from hash

### 2. SQL Injection Prevention

**The Attack:** Attacker enters malicious SQL in input fields to manipulate database queries.

**Our Protection:** Supabase uses parameterized queries internally. User input is treated as data, never as SQL code. Even if someone enters SQL commands, they're treated as plain text.

### 3. XSS Prevention (Cross-Site Scripting)

**The Attack:** Attacker saves malicious JavaScript that runs when other users view the page.

**Our Protection:** React automatically escapes HTML content. If someone saves `<script>alert('hacked')</script>` as their username, it displays as plain text instead of executing.

### 4. CORS Protection

**What it does:** Only allows requests from approved domains. Our backend only accepts requests from our frontend URL, not from random websites.

### 5. JWT Token Security

- Tokens are signed with a secret key stored in environment variables
- Tokens expire after 7 days
- Tokens are sent in Authorization header, not URL
- Invalid/expired tokens are rejected

### 6. Role-Based Access Control

- Middleware checks user's role before allowing access
- Students can't access teacher endpoints
- Users can only view/modify their own data

---

## 10. Deployment Explained

### Frontend Deployment (GitHub Pages)

1. Push code to GitHub
2. GitHub Actions automatically triggered
3. Build process runs (npm run build)
4. Creates optimized files (HTML, JS, CSS)
5. Copies to gh-pages branch
6. GitHub serves from username.github.io/QuizShield

**Why static hosting works:**
- React is a Single Page Application
- All logic runs in the browser (JavaScript)
- Only needs HTML, JS, CSS files served
- No server-side processing needed

### Backend Deployment (Vercel Serverless)

1. Push code to GitHub
2. Vercel detects changes automatically
3. Compiles TypeScript to JavaScript
4. Creates serverless function
5. Function sleeps until request arrives
6. Request wakes function → Process → Respond → Sleep

**Serverless Benefits:**
- Pay only for execution time (not idle time)
- Auto-scales to handle traffic spikes
- No server maintenance needed
- Free tier available

### Database (Supabase)

- Hosted PostgreSQL database
- Always running (not serverless)
- Automatic backups
- Dashboard for management
- Free tier with generous limits

---

## 11. Violation Point System

### Point Values

| Action | Points | Reasoning |
|--------|--------|-----------|
| Tab switch | +5 | Likely searching for answers |
| Copy attempt | +5 | Trying to copy question or paste answer |
| Right-click | +5 | Accessing context menu (save, inspect) |
| Screenshot | +5 | Capturing questions to share |
| DevTools | +5 | Inspecting page for answers |
| Face away | +5 | Looking at notes or another person |

### Auto-Submit Thresholds

| Condition | Result |
|-----------|--------|
| Total violations ≥ 100 points | Quiz auto-submitted (Excessive violations) |
| Face away > 60 seconds continuously | Quiz auto-submitted (Face away too long) |

### Why These Numbers?

- **5 points per violation:** Allows some accidental violations
- **100 point threshold:** 20 violations before termination (catches repeated offenders)
- **60 second face away limit:** Allows brief glances but catches extended looking away

---

## 12. Libraries Used For Face Detection

| Library | Purpose | Size | Accuracy |
|---------|---------|------|----------|
| **face-api.js** | Face detection + landmarks + pose | ~6MB models | High |
| **TensorFlow.js + BlazeFace** | Lightweight face detection | ~400KB | Medium |
| **MediaPipe Face Mesh** | 468 landmarks + pose | ~2MB | Very High |
| **tracking.js** | Simple face detection | ~100KB | Low |

**Recommended:** face-api.js — good balance of accuracy and ease of use

---

## 13. False Positive Prevention

| Issue | Solution |
|-------|----------|
| Brief glance away (< 2 sec) | Add 2-second grace period before counting as "away" |
| Poor lighting | Calibration step before quiz + lower confidence threshold |
| Webcam lag | Use smoothing (average last 3-5 frames) |
| Multiple faces | Only track largest/closest face |
| Face partially visible | Require minimum detection confidence (e.g., > 0.7) |

**Smoothing Technique:**
Instead of triggering on a single frame, we collect the last 5 detection results. Only if 3+ out of 5 frames show "looking away" do we trigger a violation. This prevents false positives from brief webcam glitches.

---

## 14. Future Enhancements

| Feature | Status | Description |
|---------|--------|-------------|
| Camera Proctoring | Planned | Face detection for behavior monitoring |
| Multi-Language Support | Planned | UI in multiple languages |
| Question Bank | Planned | Reusable question library |
| Plagiarism Detection | Planned | Compare answers across students |
| Video Recording | Planned | Record exam session for review |
| Mobile App | Planned | React Native version |

---

## 15. Challenges Faced & Solutions

| Challenge | Solution Applied |
|-----------|-----------------|
| CORS errors between frontend/backend | Configured Express CORS middleware with specific origins |
| JWT token expiry handling | Axios interceptor catches 401 and redirects to login |
| Quiz timing synchronization | Server-side time tracking, not client-side |
| Preventing quiz answer leaks | Questions sent without correctAnswer field to students |
| Serverless cold starts | Vercel edge functions with minimal dependencies |

---

## Summary of Key Technical Concepts

| Concept | Simple Explanation |
|---------|-------------------|
| **JWT** | Encrypted ID card that proves who you are |
| **bcrypt** | One-way scrambler for passwords |
| **REST API** | Standard way to communicate with server |
| **PostgreSQL** | Spreadsheet-like database with superpowers |
| **React Components** | Reusable UI building blocks |
| **Zustand** | Shared memory for React components |
| **Page Visibility API** | Browser telling you when tab is hidden |
| **Face Detection ML** | AI recognizing faces in camera frames |
| **Head Pose Estimation** | Math calculating where head is pointing |
| **Foreign Keys** | Links between database tables ensuring data integrity |
| **Serverless** | Server that only runs when needed |
| **HTTPS** | Encrypted communication between browser and server |
| **CORS** | Security feature limiting which websites can access API |

---

*Generated for QuizShield Project Presentation*
