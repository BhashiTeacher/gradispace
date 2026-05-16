# Gradispace — API Contract

**Base URL**: `https://api.gradispace.com` (production) / `http://localhost:4000` (dev)  
**Format**: All requests and responses are `application/json` unless noted.  
**Auth**: Protected routes require `Authorization: Bearer <jwt>` header.  
**Versioning**: All routes prefixed `/api/v1/`.

---

## Plan Tiers

| Feature                        | Free | Pro  | School |
|-------------------------------|------|------|--------|
| Exams                         | 3    | ∞    | ∞      |
| Question bank size            | 50   | ∞    | ∞      |
| AI generations / month        | 10   | ∞    | ∞      |
| Exam types                    | Open | Both | Both   |
| Image / audio uploads         | ✗    | ✓    | ✓      |
| Analytics + PDF reports       | ✗    | ✓    | ✓      |
| Closed exam (email gate)      | ✗    | ✓    | ✓      |
| Exam groups (class sets)      | ✗    | ✓    | ✓      |
| Price                         | $0   | $12/mo | $35/mo |

---

## Error format

All errors return:
```json
{ "error": "short_code", "message": "Human readable message" }
```

Common codes: `unauthorized`, `forbidden`, `not_found`, `validation_error`,
`plan_limit`, `duplicate`, `already_submitted`.

---

## 1. Auth  `/api/v1/auth`

### POST `/signup`
Create a teacher account.
```json
// Request
{ "name": "string", "email": "string", "password": "string (min 8)" }

// Response 201
{ "token": "jwt", "teacher": { "id", "name", "email", "plan", "createdAt" } }
```

### POST `/login`
```json
// Request
{ "email": "string", "password": "string" }

// Response 200
{ "token": "jwt", "teacher": { "id", "name", "email", "plan" } }
```

### GET `/me`  🔒
```json
// Response 200
{ "id", "name", "email", "plan", "aiUsage": { "used": 4, "limit": 10 }, "createdAt" }
```

### POST `/forgot-password`
```json
// Request
{ "email": "string" }
// Response 200 — always returns ok (no enumeration)
{ "ok": true }
```

### POST `/reset-password`
```json
// Request
{ "token": "string", "newPassword": "string (min 8)" }
// Response 200
{ "ok": true }
```

### POST `/logout` 🔒
```json
// Response 200
{ "ok": true }
```

---

## 2. Exams  `/api/v1/exams`

### GET `/`  🔒
List teacher's exams.
```
Query: ?subject=&gradeLevel=&published=true|false&groupId=&page=1&limit=20
```
```json
// Response 200
{
  "exams": [{
    "id", "title", "subject", "topic", "gradeLevel", "duration",
    "examType": "open|closed", "published": true,
    "accessToken": "uuid",  // null if unpublished
    "questionCount": 10,
    "submissionCount": 24,
    "createdAt", "updatedAt"
  }],
  "total": 42, "page": 1, "pages": 3
}
```

### POST `/`  🔒  [plan: free ≤3 exams]
```json
// Request
{
  "title": "string",
  "subject": "string",
  "topic": "string",
  "gradeLevel": "string",
  "duration": 45,
  "description": "string",
  "examType": "open|closed",
  "questions": []   // optional — array of question IDs or inline question objects
}
// Response 201
{ "exam": { ...exam object } }
```

### GET `/:id`  🔒
```json
// Response 200
{
  "exam": { ...exam fields },
  "questions": [{
    "id", "order", "part", "partInstruction", "type",
    "stem", "options", "answer", "imageUrl", "audioUrl", "videoUrl",
    "passage", "fromQuestionBank": true
  }]
}
```

### PUT `/:id`  🔒
```json
// Request — any subset of exam fields
{ "title"?: "string", "duration"?: 60, "examType"?: "closed", ... }
// Response 200
{ "exam": { ...updated exam } }
```

### DELETE `/:id`  🔒
```json
// Response 200
{ "ok": true }
```

### POST `/:id/publish`  🔒
Generates `accessToken` (UUID) if not yet set. Returns the full student link.
```json
// Response 200
{
  "exam": { ...exam, "published": true, "accessToken": "uuid" },
  "studentLink": "https://gradispace.com/e/uuid"
}
```

### POST `/:id/unpublish`  🔒
```json
// Response 200
{ "exam": { ...exam, "published": false } }
```

### GET `/:id/questions`  🔒
```json
// Response 200
{ "questions": [ ...question objects in order ] }
```

### PUT `/:id/questions`  🔒
Replace the exam's question list (sets order).
```json
// Request
{
  "questions": [
    { "questionId": "uuid", "part": "Part 1", "partInstruction": "..." },
    { "questionId": "uuid", "part": "Part 1", "partInstruction": "..." }
  ]
}
// Response 200
{ "questions": [ ...updated list ] }
```

---

## 3. Questions  `/api/v1/questions`
These are the teacher's question bank entries. Every question belongs to a teacher.
A question can exist in the bank independently of any exam.

### GET `/`  🔒
```
Query: ?subject=&gradeLevel=&topic=&type=mcq|short_answer&search=&page=1&limit=50
```
```json
// Response 200
{
  "questions": [{ "id", "type", "stem", "subject", "gradeLevel", "topic",
                  "tags", "imageUrl", "audioUrl", "videoUrl", "createdAt" }],
  "total": 120, "page": 1, "pages": 3
}
```

### POST `/`  🔒  [plan: free ≤50 questions]
Create a single question and add to question bank.
```json
// Request
{
  "type": "mcq|short_answer",
  "stem": "string",
  "options": [{ "letter": "A", "text": "..." }],  // mcq only
  "answer": "A",                                   // mcq only
  "subject": "Science",
  "gradeLevel": "Year 6",
  "topic": "Photosynthesis",
  "tags": ["plants", "biology"],
  "partInstruction": "string",
  "passage": { "title": "", "text": "" },          // optional reference paragraph
  "imageUrl": "string",                             // set after upload
  "audioUrl": "string",
  "videoUrl": "https://youtube.com/...",
  "stimulus": { "type": "sign|notice|message|...", "body": "..." }
}
// Response 201
{ "question": { ...full question object } }
```

### POST `/bulk`  🔒
Add multiple questions at once (e.g. after AI generation or exam import).
Silently skips exact duplicates (matched by stem hash).
```json
// Request
{ "questions": [ ...array of question objects (same shape as POST /) ] }
// Response 201
{ "added": 8, "skipped": 2, "questions": [ ...added question objects ] }
```

### GET `/:id`  🔒
```json
// Response 200
{ "question": { ...full question object } }
```

### PUT `/:id`  🔒
```json
// Request — any subset of question fields
{ "stem"?: "...", "answer"?: "B", "imageUrl"?: "...", ... }
// Response 200
{ "question": { ...updated } }
```

### DELETE `/:id`  🔒
Removes from question bank. Does NOT remove from exams already using it.
```json
// Response 200
{ "ok": true }
```

---

## 4. Exam Groups  `/api/v1/groups`
A group is a named set of exams shared via one link (e.g. "Year 6 Science — Term 2").
Students who open the group link see all published exams in that group.

### GET `/`  🔒
```json
// Response 200
{ "groups": [{ "id", "name", "gradeLevel", "subject", "accessToken",
               "examCount", "createdAt" }] }
```

### POST `/`  🔒  [plan: Pro+]
```json
// Request
{ "name": "Year 6 Science", "gradeLevel": "Year 6", "subject": "Science", "description": "" }
// Response 201
{ "group": { ...group, "accessToken": "uuid", "groupLink": "https://gradispace.com/g/uuid" } }
```

### PUT `/:id`  🔒
```json
// Request — any subset of group fields
// Response 200
{ "group": { ...updated } }
```

### DELETE `/:id`  🔒
```json
// Response 200
{ "ok": true }
```

### GET `/:id/exams`  🔒
```json
// Response 200
{ "exams": [ ...exam objects ] }
```

### POST `/:id/exams`  🔒
Add exams to group.
```json
// Request
{ "examIds": ["uuid", "uuid"] }
// Response 200
{ "added": 2 }
```

### DELETE `/:id/exams/:examId`  🔒
```json
// Response 200
{ "ok": true }
```

---

## 5. File Upload  `/api/v1/upload`
Files are stored on Cloudinary. Max sizes: image 5 MB, audio 20 MB.

### POST `/image`  🔒  [plan: Pro+]
`Content-Type: multipart/form-data`
```
Field: file  (JPEG/PNG/GIF/WEBP, max 5 MB)
```
```json
// Response 201
{ "url": "https://res.cloudinary.com/gradispace/..." }
```

### POST `/audio`  🔒  [plan: Pro+]
`Content-Type: multipart/form-data`
```
Field: file  (MP3/WAV/M4A, max 20 MB)
```
```json
// Response 201
{ "url": "https://res.cloudinary.com/gradispace/..." }
```

---

## 6. AI Generation  `/api/v1/ai`
AI calls run server-side. The Anthropic API key is never exposed to the client.
Usage is counted per teacher per calendar month.

### POST `/generate`  🔒  [plan: free ≤10/month]
Generate questions from text or theory content.
```json
// Request
{
  "source": "text",
  "content": "string (pasted theory or extracted text)",
  "subject": "Science",
  "topic": "Photosynthesis",
  "gradeLevel": "Year 6",
  "difficulty": "medium",
  "count": 10,
  "types": ["mcq", "short_answer"],
  "includePassage": false
}
// Response 200
{
  "questions": [ ...question objects (not yet saved — teacher reviews first) ],
  "usage": { "used": 5, "limit": 10 }
}
```

### POST `/import-pdf`  🔒  [plan: free ≤10/month]
Upload a PDF question paper; AI extracts and structures the questions.
`Content-Type: multipart/form-data`
```
Field: file  (PDF, max 20 MB)
```
```json
// Response 200
{
  "questions": [ ...extracted question objects ],
  "usage": { "used": 6, "limit": 10 }
}
```

---

## 7. Student (Public)  `/api/v1/student`
No auth header. Rate-limited per IP (60 req/min).

### GET `/exam/:token`
Fetch a published exam by its access token. Answers are stripped.
```json
// Response 200
{
  "exam": { "id", "title", "subject", "gradeLevel", "duration",
            "examType": "open|closed", "description" },
  "questions": [{ "id", "order", "part", "partInstruction", "type",
                  "stem", "options" (letters+text, no answer),
                  "imageUrl", "audioUrl", "videoUrl", "passage", "stimulus" }],
  "teacher": { "name" }   // branding
}
```

### POST `/exam/:token/start`
Register intent to start. For **closed** exams validates email uniqueness.
```json
// Request
{
  "studentName": "string",
  "studentClass": "string",
  "email": "string",          // required for closed exams
  "phone": "string"           // optional
}
// Response 200
{ "sessionToken": "uuid", "startedAt": "ISO" }
// Response 409 (closed exam, already submitted)
{ "error": "already_submitted", "message": "This email has already completed this exam." }
```

### POST `/exam/:token/submit`
```json
// Request
{
  "sessionToken": "uuid",
  "answers": { "<questionId>": "A", "<questionId>": "B text answer" }
}
// Response 200
{
  "result": {
    "correct": 8, "total": 10, "pct": 80, "grade": "Excellent",
    "timeTaken": "12m 34s",
    "breakdown": { "Part 1": { "correct": 5, "total": 5 } },
    "answers": { "<questionId>": { "given": "A", "correct": "A", "isCorrect": true } }
  }
}
// Response 409 — session already submitted
{ "error": "already_submitted" }
```

### GET `/group/:token`
Fetch a published exam group (student portal view).
```json
// Response 200
{
  "group": { "id", "name", "gradeLevel", "subject" },
  "exams": [{ "id", "title", "subject", "duration", "questionCount",
              "accessToken" }],
  "teacher": { "name" }
}
```

---

## 8. Results  `/api/v1/results`

### GET `/`  🔒
```
Query: ?examId=&studentEmail=&gradeLevel=&subject=&dateFrom=&dateTo=&page=1&limit=50
```
```json
// Response 200
{
  "results": [{
    "id", "examTitle", "examSubject", "studentName", "studentClass",
    "studentEmail", "submittedAt", "timeTaken", "correct", "total",
    "pct", "grade"
  }],
  "total": 80, "page": 1, "pages": 2
}
```

### GET `/:id`  🔒
Full detail including per-question breakdown.
```json
// Response 200
{
  "result": { ...summary fields },
  "answers": [{ "questionId", "stem", "given", "correct", "isCorrect" }]
}
```

### GET `/stats`  🔒  [plan: Pro+]
Aggregate analytics for an exam or group.
```
Query: ?examId=  OR  ?groupId=
```
```json
// Response 200
{
  "submissionCount": 32,
  "averagePct": 71,
  "highestPct": 98,
  "lowestPct": 34,
  "distribution": [
    { "range": "0-20", "count": 1 },
    { "range": "21-40", "count": 3 },
    { "range": "41-60", "count": 8 },
    { "range": "61-80", "count": 14 },
    { "range": "81-100", "count": 6 }
  ],
  "weakQuestions": [
    { "questionId", "stem", "correctRate": 0.28 }
  ],
  "gradeBreakdown": { "Excellent": 6, "Good": 14, "Keep Practising": 8, "Try Again": 4 }
}
```

### GET `/student/:email`  🔒  [plan: Pro+]
Progress tracking across all exams for one student.
```json
// Response 200
{
  "student": { "name", "class", "email" },
  "submissions": [{
    "examTitle", "subject", "submittedAt", "pct", "grade"
  }],
  "progressChart": [
    { "date": "2026-03-01", "pct": 55, "examTitle": "..." },
    { "date": "2026-04-01", "pct": 68, "examTitle": "..." }
  ]
}
```

### DELETE `/:id`  🔒
```json
// Response 200
{ "ok": true }
```

---

## 9. Billing  `/api/v1/billing`

### GET `/plans`  — public
```json
// Response 200
{
  "plans": [
    { "id": "free",   "name": "Free",   "price": 0,  "currency": "usd", "interval": null },
    { "id": "pro",    "name": "Pro",    "price": 12, "currency": "usd", "interval": "month" },
    { "id": "school", "name": "School", "price": 35, "currency": "usd", "interval": "month" }
  ]
}
```

### GET `/subscription`  🔒
```json
// Response 200
{
  "plan": "pro",
  "status": "active",   // active | trialing | past_due | canceled
  "currentPeriodEnd": "2026-06-16T00:00:00Z",
  "cancelAtPeriodEnd": false
}
```

### POST `/checkout`  🔒
Create a Stripe Checkout session. Client redirects to `url`.
```json
// Request
{ "planId": "pro|school" }
// Response 200
{ "url": "https://checkout.stripe.com/pay/cs_..." }
```

### POST `/portal`  🔒
Stripe Customer Portal — manage/cancel subscription.
```json
// Response 200
{ "url": "https://billing.stripe.com/session/..." }
```

### POST `/webhook`  — public, verified by Stripe signature
Handles: `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_failed`.
```
Response: 200 OK (always — Stripe retries on non-200)
```

---

## 10. Settings  `/api/v1/settings`

### GET `/`  🔒
```json
// Response 200
{
  "portalTitle": "Mrs Smith's Exams",
  "brandColour": "#003865",
  "sheetsUrl": "https://script.google.com/..."   // optional results webhook
}
```

### PUT `/`  🔒
```json
// Request — any subset
{ "portalTitle"?: "string", "brandColour"?: "#hex", "sheetsUrl"?: "string" }
// Response 200
{ "settings": { ...updated } }
```

---

## Rate limits

| Route group        | Limit              |
|--------------------|--------------------|
| `/api/v1/student/` | 60 req/min per IP  |
| `/api/v1/auth/`    | 20 req/min per IP  |
| All other          | 120 req/min per IP |

---

## Webhook Events (internal — Stripe → server)

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set `teacher.plan` + save `stripeCustomerId` |
| `customer.subscription.updated` | Update `teacher.plan` and `planStatus` |
| `customer.subscription.deleted` | Downgrade `teacher.plan` to `free` |
| `invoice.payment_failed` | Set `planStatus = past_due`, send email |
