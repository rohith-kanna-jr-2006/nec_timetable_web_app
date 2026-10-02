# NEC Faculty API Reference Documentation

All endpoints are mounted under base path: `/api`.

Standard JSON format:
```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": { ... } // Optional pagination
}

// Error
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": [ ... ] // Optional validation details
}
```

---

## 1. System Health

### `GET /api/health`
Health check endpoint.
- **Access**: Public
- **Response**:
```json
{
  "success": true,
  "service": "nec-faculty-backend"
}
```

---

## 2. Authentication & Authorization (Web Integration Contract)

### `POST /api/auth/login`
Authenticate user with email and password to receive a JWT and user profile.
- **Access**: Public (Rate-limited: 50 requests / 15 minutes)
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "email": "hod@nec.edu.in",
  "password": "Password123!"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "6795f0000000000000000001",
      "name": "Dr. T. Rajasekaran",
      "email": "hod@nec.edu.in",
      "role": "HOD",
      "facultyId": "FWL-01",
      "isActive": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": "HOD",
    "facultyId": "FWL-01"
  }
}
```
- **Error Responses**:
  - `400 Bad Request` (`code: "VALIDATION_ERROR"`): Missing email, invalid email format, or empty password.
  - `401 Unauthorized` (`code: "INVALID_CREDENTIALS"`): Incorrect password or email not registered.
  - `401 Unauthorized` (`code: "ACCOUNT_DEACTIVATED"`): User account is marked `isActive: false`.

### `GET /api/auth/me`
Retrieve active user session profile during page refresh or session restoration.
- **Access**: Authenticated
- **Required Header**: `Authorization: Bearer <token>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "6795f0000000000000000001",
    "name": "Dr. T. Rajasekaran",
    "email": "hod@nec.edu.in",
    "role": "HOD",
    "facultyId": "FWL-01",
    "isActive": true,
    "createdAt": "2026-09-20T10:00:00.000Z",
    "user": {
      "id": "6795f0000000000000000001",
      "name": "Dr. T. Rajasekaran",
      "email": "hod@nec.edu.in",
      "role": "HOD",
      "facultyId": "FWL-01",
      "isActive": true,
      "createdAt": "2026-09-20T10:00:00.000Z"
    }
  }
}
```
- **Error Responses**:
  - `401 Unauthorized` (`code: "UNAUTHORIZED"`): Missing or non-Bearer `Authorization` header.
  - `401 Unauthorized` (`code: "INVALID_TOKEN"`): Malformed or tampered token.
  - `401 Unauthorized` (`code: "TOKEN_EXPIRED"`): Token has expired (triggers client auto-redirect to `/login?expired=true`).
  - `401 Unauthorized` (`code: "USER_INACTIVE"`): User account deactivated.

---

### Seed User Credentials (Development Environment)

| Role | Email | Password | Faculty ID | Default Dashboard Route |
| :--- | :--- | :--- | :--- | :--- |
| **HOD** | `hod@nec.edu.in` | `Password123!` | `FWL-01` | `/hod/dashboard` |
| **AC** | `ac@nec.edu.in` | `Password123!` | `FWL-22` | `/coordinator/dashboard` |
| **FACULTY** | `faculty@nec.edu.in` | `Password123!` | `FWL-03` | `/faculty/dashboard` |
| **ADMIN** | `admin@nec.edu.in` | `Password123!` | *None* | `/hod/dashboard` |

---

### Role-Based Access Control (RBAC) Matrix

| Domain Operation | Method & Endpoint | FACULTY | AC | HOD | ADMIN |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Authentication** | `POST /api/auth/login`, `GET /api/auth/me` | Allowed | Allowed | Allowed | Allowed |
| **View Own Timetable** | `GET /api/timetable/faculty/:id` | Allowed | Allowed | Allowed | Allowed |
| **View Class Timetable** | `GET /api/timetable/class/:id` | Allowed | Allowed | Allowed | Allowed |
| **View Workload** | `GET /api/workload`, `/summary` | Allowed | Allowed | Allowed | Allowed |
| **Submit Absence** | `POST /api/absences` | Allowed | Allowed | Allowed | Allowed |
| **Approve/Reject Absence** | `PATCH /api/absences/:id/status` | **403** | **403** | Allowed | Allowed |
| **Assign Substitute** | `POST /api/substitutes` | **403** | **403** | Allowed | Allowed |
| **Course Candidate Handlers**| `POST/PUT/DELETE /api/course-faculty-handlers` | **403** | Allowed | Allowed | Allowed |
| **Create Timetable Version** | `POST /api/timetable/version` | **403** | Allowed | Allowed | Allowed |
| **Approve / Publish Timetable**| `PATCH /api/timetable/version/:id/status` | **403** | **403** | Allowed | Allowed |
| **Create Draft Allocation** | `POST /api/hod-allocations` | **403** | Allowed | Allowed | Allowed |
| **Approve HOD Allocation** | `PATCH /api/hod-allocations/:id/status` | **403** | **403** | Allowed | Allowed |
| **Assign Class Advisor** | `POST /api/class-advisors` | **403** | **403** | Allowed | Allowed |
| **Create/Update Faculty** | `POST/PUT /api/faculty` | **403** | **403** | Allowed | Allowed |
| **Delete Faculty Master** | `DELETE /api/faculty/:facultyId` | **403** | **403** | **403** | Allowed |

---

## 3. Faculty Directory Master

### `GET /api/faculty`
List faculty with pagination and search (27 Authoritative Faculty: 25 CSE, 2 ECE).
- **Access**: Public / Authenticated
- **Query Params**: `search`, `department`, `role`, `page`, `limit`

### `GET /api/faculty/:facultyId`
Retrieve faculty details by unique ID (e.g. `FWL-01`).
- **Response Structure**:
```json
{
  "success": true,
  "data": {
    "_id": "673f...",
    "facultyId": "FWL-01",
    "facultyName": "Dr. T. Rajasekaran",
    "designation": "Professor & Head Of Department HOD",
    "department": "Department of Computer Science and Engineering",
    "email": "drtrajasekaran@nec.edu.in",
    "phone": null,
    "roles": ["HOD"],
    "isActive": true
  }
}
```

### `GET /api/faculty/:facultyId/allocations`
Retrieve categorized teaching allocations and independent institutional responsibilities.
- **Access**: Public / Authenticated
- **Query Params**: `category`, `year`, `section`, `courseCode`, `allocationType`
- **Response Structure**:
```json
{
  "success": true,
  "data": {
    "facultyId": "FWL-01",
    "facultyName": "Dr. T. Rajasekaran",
    "designation": "Professor & Head Of Department HOD",
    "department": "Department of Computer Science and Engineering",
    "summary": {
      "teachingHours": 8,
      "responsibilityHours": 0,
      "totalHours": 8,
      "sourceTotalHours": 8,
      "status": "MATCHED",
      "isIncomplete": false,
      "incompleteReason": null
    },
    "teachingLoad": {
      "ugTheory": [
        {
          "category": "UG Theory 1",
          "courseCode": "22CSX01",
          "courseName": "Deep Learning (PSE, Full Autonomy)",
          "allocation": "UG III Year B",
          "hours": 3,
          "allocationType": "UG_THEORY",
          "year": "III Year",
          "section": "B"
        }
      ],
      "labs": [
        {
          "category": "Lab 1",
          "courseCode": "22CSP09",
          "courseName": "Full Stack Development Laboratory",
          "allocation": "UG III Year A",
          "hours": 4,
          "allocationType": "LAB",
          "year": "III Year",
          "section": "A"
        }
      ],
      "pg": [
        {
          "category": "PG",
          "courseCode": "22CPE02",
          "courseName": "Project Phase I",
          "allocation": "PG II Year",
          "hours": 1,
          "allocationType": "PG",
          "year": "II Year",
          "section": null
        }
      ],
      "others": []
    },
    "responsibilities": {
      "academic": [],
      "administrative": [],
      "coordination": [],
      "institutional": []
    },
    "allocations": [...]
  }
}
```

### `POST /api/faculty`
Create new faculty profile with structured workload allocation.

- **Access**: `HOD`, `ADMIN` (RBAC enforced)
  - `FACULTY` and `AC` are rejected with `403 FORBIDDEN`.
  - Unauthenticated requests are rejected with `401 UNAUTHORIZED`.
- **Authoritative Calculations**: Server-authoritative. The frontend must **not** duplicate workload formulas. The backend computes:
  $$\text{calculatedTeachingHours} + \text{calculatedResponsibilityHours} = \text{calculatedTotalHours}$$
- **Automatic ID Generation**: If `facultyId` is omitted, the backend auto-generates the next sequential identifier (e.g. `FWL-28`).

#### Request Headers
```http
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Schema
```typescript
interface CreateFacultyRequest {
  facultyId?: string; // Optional. e.g. "FWL-28". Auto-generated if omitted.
  facultyName: string; // Required. Non-empty string.
  designation: string; // Required. Non-empty string.
  department?: string; // Optional. Defaults to "Department of Computer Science and Engineering"
  email?: string; // Optional. Valid email address.
  phone?: string; // Optional.
  roles?: string[]; // Optional user roles. Defaults to ["FACULTY"]
  sourceTotalHours?: number; // Optional. If omitted, defaults to calculatedTotalHours (status: MATCHED)
  teaching?: {
    ugTheory1?: TeachingItem[];
    ugTheory2?: TeachingItem[];
    lab1?: TeachingItem[];
    lab2?: TeachingItem[];
    pg?: PGTeachingItem[]; // Each course = 1 equivalent hour/week (omitted hours defaults to 1)
    others?: OthersTeachingItem[]; // Hours strictly 1–3 hours/week (reject < 1 or > 3)
  };
  responsibilities?: ResponsibilityItem[]; // Structured data. Hours strictly 1–6 hours/week.
}

interface TeachingItem {
  courseName: string; // Required.
  courseCode?: string; // Optional. e.g. "22CS501"
  allocation?: string; // Optional. e.g. "UG III Year A"
  hours?: number; // Contact hours >= 0
  year?: string; // Optional. Parsed from allocation if omitted
  section?: string; // Optional. Parsed from allocation if omitted
}

interface PGTeachingItem extends TeachingItem {
  hours?: 1; // Fixed: each assigned course = 1 equivalent hour/week (omitted hours defaults to 1)
}

interface OthersTeachingItem extends TeachingItem {
  hours: number; // Required: 1 <= hours <= 3. Hours < 1 or > 3 are rejected.
}

interface ResponsibilityItem {
  role: string; // Required. Must match one of the 38 authoritative master roles.
  hours: number; // Required: 1 <= hours <= 6. Hours < 1 or > 6 are rejected.
  allocation?: string; // Optional. e.g. "UG III Year A" or "Dept Level"
  responsibilityType?: 'Academic' | 'Administrative' | 'Coordination' | 'Institutional'; // Auto-classified if omitted
  year?: string; // Optional. Parsed from allocation if omitted
  section?: string; // Optional. Parsed from allocation if omitted
}
```

#### Authoritative 38 Responsibility Master Roles
Responsibilities must be structured data and match one of these canonical institutional roles:
```
1. AI Affiliation/AICTE Work          20. NAAC/NBA Coordinator
2. Admin Coordinator                  21. NBA Coordinator
3. Alumni & Higher Studies            22. NIRF/IQAC Coordinator
4. CC1 Lab I/C                        23. NPTEL Online Courses (Faculty & Students)
5. CC1 Lab Incharge                   24. One Credit Course
6. CCI Lab Incharge                   25. Overall Academic Coordinator
7. Class Advisor                      26. P&EA Coordinator
8. DCOE                               27. PAC, DAB, BoS Coordinator
9. Dept. Association                  28. PCD Club
10. Dept. CFiR and RSD Coordinator    29. Placement Coordinator
11. Dept. CIPD Coordinator            30. Proctor
12. Dept. Exam Cell I/C               31. Professional Society/Chapter
13. Dept. Infrastructure / ...        32. Startups & Business Incubation / ...
14. Dept. Meeting Minutes             33. Student Achievements
15. Dept. Newsletter/Magazine         34. Student Affairs Coordinator
16. Faculty Achievements              35. Student Exit Survey
17. Industrial Relations Coordinator  36. TECH GURU
18. Institute Social Media / Website  37. Timetable Coordinator
19. MOU/Internship                    38. Timetable I/C
```
*Note: Duplicate responsibilities for the same faculty member are strictly rejected.*

#### Example Request Payload
```json
{
  "facultyName": "Dr. K. Suresh Kumar",
  "designation": "Associate Professor",
  "department": "Department of Computer Science and Engineering",
  "email": "sureshkumar@nec.edu.in",
  "phone": "9876543210",
  "teaching": {
    "ugTheory1": [
      { "courseCode": "22CS501", "courseName": "Compiler Design", "allocation": "UG III Year A", "hours": 3 }
    ],
    "ugTheory2": [
      { "courseCode": "22CS502", "courseName": "Cloud Computing", "allocation": "UG III Year B", "hours": 3 }
    ],
    "lab1": [
      { "courseCode": "22CSP07", "courseName": "Compiler Design Laboratory", "allocation": "UG III Year A", "hours": 4 }
    ],
    "lab2": [
      { "courseCode": "22CSP08", "courseName": "Cloud Computing Laboratory", "allocation": "UG III Year B", "hours": 4 }
    ],
    "pg": [
      { "courseCode": "22CPB05", "courseName": "Advanced Distributed Systems", "allocation": "PG I Year" }
    ],
    "others": [
      { "courseName": "PBL / Mini Project", "allocation": "UG II Year A", "hours": 2 }
    ]
  },
  "responsibilities": [
    { "role": "Class Advisor", "allocation": "UG III Year A", "hours": 2 },
    { "role": "Timetable Coordinator", "allocation": "Dept Level", "hours": 3 }
  ]
}
```

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "_id": "6740a1b2c3d4e5f6a7b8c9d0",
    "facultyId": "FWL-28",
    "facultyName": "Dr. K. Suresh Kumar",
    "designation": "Associate Professor",
    "department": "Department of Computer Science and Engineering",
    "email": "sureshkumar@nec.edu.in",
    "phone": "9876543210",
    "roles": ["FACULTY"],
    "isActive": true,
    "workloadCalculation": {
      "calculatedTeachingHours": 17,
      "calculatedResponsibilityHours": 5,
      "calculatedTotalHours": 22,
      "sourceTotalHours": 22,
      "status": "MATCHED",
      "discrepancyNote": null
    },
    "summary": {
      "teachingHours": 17,
      "responsibilityHours": 5,
      "totalHours": 22,
      "sourceTotalHours": 22,
      "status": "MATCHED",
      "isIncomplete": false,
      "incompleteReason": null
    },
    "teachingLoad": {
      "ugTheory": [ ... ],
      "labs": [ ... ],
      "pg": [ ... ],
      "others": [ ... ]
    },
    "responsibilities": {
      "academic": [ ... ],
      "administrative": [ ... ],
      "coordination": [ ... ],
      "institutional": [ ... ]
    },
    "allocations": [ ... ]
  }
}
```

#### Validation Error Responses (`400 Bad Request`)
Returned with standard error envelope `code: "VALIDATION_ERROR"` and detailed error list:
```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    "facultyName is required and must be a non-empty string",
    "Others contact hours must be between 1 and 3 hours/week (received 4 in Others row 1). Hours above 3 are rejected.",
    "Responsibility hours must be between 1 and 6 hours/week (received 7 in Responsibility row 1). Hours above 6 are rejected.",
    "Duplicate responsibility 'Proctor' rejected. A responsibility cannot be assigned multiple times to the same faculty member.",
    "Invalid responsibility role 'Custom Non-Master Task' in Responsibility row 1. Must match one of the authoritative 38 institutional responsibility roles.",
    "Responsibilities must be structured data and cannot be a free-text string."
  ]
}
```

### `PUT /api/faculty/:facultyId`
Update faculty profile.
- **Access**: HOD, ADMIN

---

## 4. Faculty Workload Master

### `GET /api/workload`
List all 27 faculty workload records.
- **Query Params**:
  - `search`: multi-attribute text search across faculty, courses, responsibilities
  - `status`: `MATCHED`, `REVIEW REQUIRED`, `INCOMPLETE SOURCE DATA`
  - `role`: `HOD`, `ACADEMIC_COORDINATOR`, `CLASS_ADVISOR`, `PROCTOR`, `TEACHING_ONLY`, `RESPONSIBILITIES`
  - `category`: `UG_THEORY`, `LAB`, `PG`, `OTHERS`
  - `facultyId`: filter by specific faculty member
  - `page`, `limit`

### `GET /api/workload/summary`
Dynamic aggregation metrics computed live from MongoDB:
```json
{
  "success": true,
  "data": {
    "totalFaculty": 27,
    "totalTeachingHours": 397,
    "totalResponsibilityHours": 129,
    "totalAllocatedHours": 526,
    "completeCount": 26,
    "incompleteCount": 1,
    "discrepancyCount": 0
  }
}
```

### `GET /api/workload/discrepancies`
Retrieve records requiring arithmetic review (`REVIEW REQUIRED`).

### `GET /api/workload/incomplete`
Retrieve records with incomplete source totals (`INCOMPLETE SOURCE DATA`).
- Contains `Mrs. A. Satheesh Kumar` (`FWL-20`) whose TECH GURU allocation hours are not legible/specified in the source document (`hours: null`, `sourceTotalHours: null`).

### `GET /api/workload/:facultyId`
Retrieve full breakdown of teaching rows and responsibilities for a faculty member.

### `GET /api/workload/:facultyId/allocations`
Alias to `/api/faculty/:facultyId/allocations`. Returns categorized teaching load (UG Theory, Labs, PG, Others) and institutional responsibilities (Academic, Administrative, Coordination, Institutional).

---

## 5. Course Faculty Handlers (AC Input)

### `GET /api/course-faculty-handlers`
List all course-level handler candidates nominated by Academic Coordinators.

### `GET /api/course-faculty-handlers/:courseCode`
Get handlers for a specific course code (e.g. `22CSC14`).

### `POST /api/course-faculty-handlers`
Submit candidate faculty pool for a course.
- **Access**: AC, HOD, ADMIN

### `PUT /api/course-faculty-handlers/:courseCode`
Update candidate handlers.

---

## 6. HOD Faculty Allocations

### `GET /api/hod-allocations`
List final ratified allocations.
- **Query Params**: `academicContextId`, `facultyId`, `courseCode`, `status`

### `GET /api/hod-allocations/validate/:academicContextId`
Validate all curriculum core course allocations for a cohort prior to timetable generation.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "academicContextId": "66f7...",
      "cohort": "III Year Sec A (Semester V)",
      "readyForGeneration": true,
      "totalRequiredCourses": 6,
      "allocatedCount": 6,
      "details": [
        {
          "courseCode": "22CSC14",
          "courseName": "Theory of Computation",
          "facultyId": "FWL-04",
          "facultyName": "Dr. S. Karthik",
          "status": "VALID"
        }
      ]
    }
  }
  ```

### `POST /api/hod-allocations`
Create draft or submitted allocation.
- **Access**: HOD, ADMIN
- Enforces course existence, active context check, course semester matching cohort, and active faculty verification.

### `PATCH /api/hod-allocations/:id/status`
Approve or reject allocation.
- **Access**: HOD, ADMIN (AC forbidden)
- **Body**: `{ "status": "APPROVED" | "REJECTED", "rejectionReason": "..." }`

---

## 7. Timetable Version & Sessions

### `GET /api/timetable/faculty/:facultyId`
Get scheduled sessions for a faculty member.
- **Query Params**: `versionId` (optional)
- **Public default (no `versionId`)**: `PUBLISHED` versions only — unchanged.
- **Internal review (`versionId` given, Phase 5)**: returns exactly that version's
  sessions where this faculty is the primary instructor **or** appears in
  `facultyAssignments[]` (`ADDITIONAL`, `OPTIONAL`, `MATHS_BME`, `ENGLISH`).
  One class session stays one session; it is never split into one row per faculty.
  Unknown `versionId` → `404 VERSION_NOT_FOUND`.
- **Response** adds `timetableVersionId`, `timetableVersion`, `status`,
  `isInternalReview`, `facultyCount` and `roles` alongside `sessionCount`/`sessions`.

### `GET /api/timetable/class/:academicContextId`
Get class timetable grid.
- **Query Params**: `versionId` (optional; defaults strictly to published version)
- **Internal review (`versionId` given, Phase 5)**: serves that **exact** version —
  never a newer one — for `DRAFT`, `GENERATED`, `PENDING_HOD_APPROVAL`, `APPROVED`
  and `PUBLISHED`, after RBAC + context-ownership checks. A version belonging to
  another context returns `409 TIMETABLE_VERSION_CONTEXT_MISMATCH`.
  The response adds `status`, `versionId`, `isInternalReview` and a `summary`
  block (`courseCount`, `sessionCount`, `scheduledPeriods`, `conflictCount`,
  `facultyCount`).
- **Missing Timetable != Missing Data**: When a valid context has no published timetable, returns HTTP 200 with actionable workflow state:
  ```json
  {
    "success": true,
    "academicContextId": "6aba...",
    "isPublished": false,
    "state": "READY_FOR_GENERATION" | "ALLOCATION_INCOMPLETE",
    "nextAction": "GENERATE_TIMETABLE" | "ALLOCATE_FACULTY",
    "message": "...",
    "sessionCount": 0,
    "sessions": [],
    "workflow": { ... }
  }
  ```

### `GET /api/timetable/context-status/:academicContextId`
Evaluates the full academic and timetable lifecycle workflow state for any valid academic context in CSE.
- **Aliases**: `GET /api/timetable/status/:academicContextId`
- **Response**:
  ```json
  {
    "success": true,
    "state": "READY_FOR_GENERATION" | "ALLOCATION_INCOMPLETE" | "TIMETABLE_GENERATED" | "PENDING_HOD_APPROVAL" | "APPROVED" | "PUBLISHED",
    "nextAction": "GENERATE_TIMETABLE" | "ALLOCATE_FACULTY" | "SUBMIT_FOR_APPROVAL" | "HOD_APPROVAL" | "PUBLISH_TIMETABLE" | "VIEW_PUBLISHED",
    "academicContext": { ... },
    "curriculum": { "available": true, "courseCount": 10, "coreCount": 10, "electiveSlotsCount": 0 },
    "allocation": { "complete": true, "requiredCount": 10, "allocatedCount": 10, "missing": [] },
    "timetable": { "exists": false, "isPublished": false }
  }
  ```

### `GET /api/timetable/published/:academicContextId`
Get current published timetable for a class.

### `GET /api/timetable/review-matrix`
Review Matrix endpoint with exact academic context and timetable version isolation.
- **Aliases**: `GET /api/timetable/matrix`
- **Query Params**: `academicContextId`, `timetableVersionId` / `versionId`
- **Explicit `versionId` wins (Phase 5)**: there is no global fallback — the response
  is exactly that context + that version, or `409 TIMETABLE_VERSION_CONTEXT_MISMATCH`.
- **Response**: `academicContext`, `timetableVersion`, `status`, `isInternalReview`,
  `sessionCount`, a `summary` block, and a `sessions` list with canonical `courseName`
  from Course Master and the complete `facultyAssignments[]` per session.
- **Performance**: sessions, then courses, are loaded in two batched queries
  (the previous implementation issued one `Course` lookup per session).

### `GET /api/timetable/design-context/:academicContextId`
Authoritative TC timetable design dataset (Phase 3). Read-only.
- **Access**: `TC`, `HOD`, `ADMIN` (legacy `AC` accepted during migration)
- **Response**: curriculum courses with required periods, HOD-approved faculty, allocation status, elective selection, readiness state, and the current version.

### `POST /api/timetable/generate-from-context`
Generate a timetable from the TC Design Context using the CSP solver (Phase 4).
This is the preferred generation path: the server re-derives the course list, the
HOD-approved faculty and the period counts from HOD allocations, so the client
cannot override them.

- **Access**: `TC`, `ADMIN` (legacy `AC` accepted during migration). `HOD` and `FACULTY` receive **403** — timetable design authority belongs to the TC.
- **Rate limit**: 20 requests per 10 minutes per client
- **Body**:

  | Field | Type | Required | Notes |
  | :--- | :--- | :---: | :--- |
  | `academicContextId` | ObjectId | Yes | Authoritative anchor for the whole run |
  | `timetableVersionId` | ObjectId | No | Reuse a specific working version. Must belong to `academicContextId`. A `PUBLISHED` or `APPROVED` version is rejected with `VERSION_LOCKED`. |
  | `assignmentPlan` | Array | No | TC design intent. Validated against HOD truth; mismatches are rejected, never silently applied. |
  | `generationSeed` | Number | No | Same seed reproduces an identical timetable |
  | `options` | Object | No | Solver tuning (`maxNodes`, `maxBacktracks`, `timeoutMs`) |

- **Success** — `201`:

  ```json
  {
    "success": true,
    "data": {
      "timetableVersionId": "...",
      "status": "GENERATED",
      "sessionsCreated": 27,
      "sessions": [ /* persisted TimetableSession[] */ ],
      "metrics": { "variablesCount": 21, "durationMs": 34, "generationSeed": 4242 },
      "designContext": { "readiness": {}, "electiveSelection": {} }
    }
  }
  ```

- **Errors**:

  | Code | Status | Meaning |
  | :--- | :---: | :--- |
  | `VALIDATION_ERROR` | 400 | Malformed body or invalid ObjectId |
  | `ASSIGNMENT_PLAN_INVALID` | 400 | Plan conflicts with authoritative HOD data |
  | `CONTEXT_NOT_FOUND` | 404 | Unknown academic context |
  | `ALLOCATION_INCOMPLETE` | 409 | HOD has not allocated every required course |
  | `ELECTIVE_SELECTION_REQUIRED` | 409 | Curriculum elective slots are not filled |
  | `VERSION_LOCKED` | 409 | Target version is `PUBLISHED` / `APPROVED` |
  | `TIMETABLE_VERSION_CONTEXT_MISMATCH` | 409 | Version belongs to a different context |
  | `UNSATISFIABLE_CONSTRAINTS` | 409 | No valid timetable exists. `diagnostics.failureReason` names the blocking course. |
  | `DATABASE_UNAVAILABLE` | 503 | Database unreachable; the request was not processed |

> A failed run never leaves a `GENERATED` version behind, and a mutating request
> never reports fabricated success.

### `GET /api/timetable/versions`
List timetable versions.
- **Query Params**: `academicContextId` (scopes the query in the database — the list
  is never globally sorted and filtered client-side), plus legacy `department`,
  `semester`, `academicYear`, `status`.
- **Ordering**: `createdAt` desc, then `version` desc, then `_id` desc. Ordering never
  depends on the human-readable `versionLabel`, so `v1.0` is not assumed to be latest.

### `GET /api/timetable/version/:id`
Single timetable version, shaped for review screens (Phase 5).
- **Response**: `_id`, `academicContextId`, `academicContext`, `status`, `version`,
  `versionLabel`, `generatedBy`, `submittedBy`, `submittedAt`, `approvedBy`,
  `approvedAt`, `publishedAt`, `rejectionReason`, `hardConflicts`,
  `totalScheduledPeriods`, `editable`, `createdAt`, `updatedAt`.
- **Errors**: `404 VERSION_NOT_FOUND` for an unknown version.

### `POST /api/timetable/version`
Create candidate timetable version.

### `PATCH /api/timetable/version/:id/status`
State machine transition:
`NO_TIMETABLE -> GENERATED -> PENDING_HOD_APPROVAL -> APPROVED -> PUBLISHED`
`PUBLISHED -> (terminal)` · `REJECTED -> DRAFT | GENERATED`
- **Access**: Transition to `APPROVED`, `REJECTED` or `PUBLISHED` requires HOD or ADMIN.
  Transition to `DRAFT`, `GENERATED` or `PENDING_HOD_APPROVAL` requires `TC` (legacy
  `AC`) or ADMIN.
- **Body**: `{ "status": "...", "rejectionReason"?: string, "academicContextId"?: ObjectId }`

#### HOD approval, rejection and publication (Phase 6)

This single endpoint is also the complete governance API; no new route was added.
Authority is evaluated **before** the state machine, so a caller without permission
always receives `403` and never a `409` that would imply the edge itself was merely invalid.

| Target | Allowed from | Authority |
| :--- | :--- | :--- |
| `APPROVED` | `PENDING_HOD_APPROVAL` | HOD, ADMIN |
| `REJECTED` | `PENDING_HOD_APPROVAL` | HOD, ADMIN |
| `PUBLISHED` | `APPROVED` | HOD, ADMIN |

- **Unauthenticated** — `401`. **TC / FACULTY** targeting any approval status —
  `403 STATE_TRANSITION_ERROR`. A `TC` may never move a version out of
  `PENDING_HOD_APPROVAL`, even to `GENERATED`.
- **HOD may not design.** Targeting `DRAFT`, `GENERATED` or
  `PENDING_HOD_APPROVAL` is `403 STATE_TRANSITION_ERROR`.
- **Exact version, exact context.** `PUBLISHED` is reachable only from `APPROVED`,
  so an approved revision is never published by accident. When `academicContextId`
  is supplied it must equal the version's own context anchor; otherwise
  `409 TIMETABLE_VERSION_CONTEXT_MISMATCH` and the version is left untouched.
- **Skipped edges** (for example `GENERATED -> PUBLISHED`, or any transition out of
  `PUBLISHED`) are `409 INVALID_TIMETABLE_STATUS_TRANSITION`.
- **Unknown version** — `404 VERSION_NOT_FOUND`.
- **Rejection** — `rejectionReason`, when present, must be a non-empty string of at
  most 500 characters (`400 BAD_REQUEST`). It is stored on the exact
  `TimetableVersion` as `rejectionReason` and returned by `GET /version/:id`.

> **Legacy edges retained.** `ALLOWED_TRANSITIONS` still permits
> `APPROVED -> REJECTED` and `REJECTED -> DRAFT | GENERATED`. These predate Phase 6
> and were deliberately left in place: `REJECTED` is also a member of
> `MUTABLE_VERSION_STATUSES`, which three solver version-resolution fallbacks
> depend on, so removing the edge without reworking that lookup would leave the
> state machine and version resolution disagreeing. Phase 6 does not rely on
> them — the rejection workflow below mandates a **new** version — so tightening
> them is a separate, self-contained follow-up.

#### Governance-version immutability (Phase 6)

`PENDING_HOD_APPROVAL`, `APPROVED`, `PUBLISHED` and `REJECTED` are all frozen
artifacts (`FROZEN_TIMETABLE_STATUSES` in `services/timetableSubmissionService.js`):

| Endpoint | Result |
| :--- | :--- |
| `POST /api/timetable/session` | `409 TIMETABLE_VERSION_NOT_EDITABLE` |
| `DELETE /api/timetable/session/:id` | `409 TIMETABLE_VERSION_NOT_EDITABLE` |
| `POST /api/timetable/generate-from-context` (same version) | `409 VERSION_LOCKED` |

A **rejected** version is closed, not merely read-only: the revision workflow
requires a **new** version, so the rejected record and its sessions are preserved
as history and never edited in place. The generation engine keeps its own narrower
lock because a `REJECTED` version may still be re-driven into `GENERATED` by the
solver. On `REJECTED`, `submittedBy`/`submittedAt` are cleared so the revision
history stays honest.

#### Publication and public visibility

Publishing sets `PUBLISHED`; it does **not** archive or delete the previous
published version. `GET /api/timetable/class/:academicContextId` and
`GET /api/timetable/published/:academicContextId` always serve the **newest**
`PUBLISHED` version for that context, so superseded versions immediately stop
being public while remaining available for internal review by `versionId`. Only
`PUBLISHED` versions are ever public — `GENERATED` and `PENDING_HOD_APPROVAL`
data never appears, and one context's read never returns another context's
sessions.

#### TC submission — `GENERATED -> PENDING_HOD_APPROVAL` (Phase 5)

This endpoint **is** the submission API; there is no separate `/submit-timetable`.
`PATCH .../status` with `{"status":"PENDING_HOD_APPROVAL"}` runs a submission gate
before the version becomes a review artifact. Optional `academicContextId` asserts the
context the TC believes it is submitting.

Gate order and failures:

| # | Check | Failure |
| :--- | :--- | :--- |
| 1 | Version exists | `404 VERSION_NOT_FOUND` |
| 2 | Version anchored to an `AcademicContext` | `409 TIMETABLE_NOT_READY_FOR_SUBMISSION` (`MISSING_ACADEMIC_CONTEXT`) |
| 3 | Caller holds design authority | `403 UNAUTHORIZED_TIMETABLE_SUBMISSION` |
| 4 | Version is `GENERATED` | `409 TIMETABLE_NOT_READY_FOR_SUBMISSION` (`INVALID_STATE` / `ALREADY_SUBMITTED`), `409 TIMETABLE_VERSION_NOT_EDITABLE` (already `APPROVED`/`PUBLISHED`) |
| 5 | Version belongs to the claimed context | `409 TIMETABLE_VERSION_CONTEXT_MISMATCH` |
| 6 | At least one scheduled session | `409 TIMETABLE_NOT_READY_FOR_SUBMISSION` (`sessionCount: 0`) |
| 7 | No orphan sessions (every session belongs to that context **and** version) | `409 TIMETABLE_NOT_READY_FOR_SUBMISSION` (`ORPHAN_SESSIONS`) |
| 8 | HOD allocations unchanged since generation | `409 HOD_ALLOCATION_CHANGED_AFTER_GENERATION` |
| 9 | Existing hard-constraint validator passes | `409 TIMETABLE_VALIDATION_FAILED` |

- **Step 8 details** name each conflict: `courseCode`, `generatedFaculty`,
  `currentApprovedFaculty`. A course whose allocation is *absent* is reported as a
  non-blocking warning (`HOD_ALLOCATION_MISSING`) rather than blocking, so legacy
  contexts keep working during the AC → TC migration.
- **Step 9** reuses `services/timetable/timetableValidator.js`. Data-integrity findings
  (`CLASS_TIME_CONFLICT`, `DUPLICATE_SESSION`, `FACULTY_TIME_CONFLICT`,
  `HOD_FACULTY_MISMATCH`, `INVALID_PERIOD`) block submission. Solver layout heuristics
  (period counts, lab block shape, theory packing) are returned as non-blocking
  `warnings`, because a version may legitimately be hand-assembled by the TC.
- **Success** — `200`: the updated version plus a `submission` block echoing exactly
  what was sent (`sessionCount`, `summary`, `validation.warningCount`), and
  `submittedBy` / `submittedAt` stamped on the version.
- **Migration**: `submittedAt` is a new optional `TimetableVersion` field, default
  `null`. Existing documents are unaffected and need no backfill.

#### Submitted-version immutability (Phase 5)

Once a version is `PENDING_HOD_APPROVAL` it is a frozen review artifact:

| Endpoint | Result |
| :--- | :--- |
| `POST /api/timetable/session` | `409 TIMETABLE_VERSION_NOT_EDITABLE` |
| `DELETE /api/timetable/session/:id` | `409 TIMETABLE_VERSION_NOT_EDITABLE` |
| `POST /api/timetable/generate-from-context` (same version) | `409 VERSION_LOCKED` |

The only sanctioned revision path is
`PENDING_HOD_APPROVAL -> REJECTED -> new version -> GENERATED -> PENDING_HOD_APPROVAL`.
See **Governance-version immutability (Phase 6)** below for the full frozen-status
matrix, and **Publication and public visibility** for what `PUBLISHED` means.

### `POST /api/timetable/solve`
Automatic timetable solver invoking the Constraint Satisfaction & Optimization Problem (CSOP/CSP) engine.
- **Access**: Coordinator (`AC`), `HOD`, `ADMIN`
- **Aliases**: `POST /api/timetable/generate`
- **Request Body**:
  ```json
  {
    "academicContextId": "66f7...",
    "timetableVersionId": "66f7...", // Optional: draft version ID; if omitted, automatically created
    "assignmentPlan": [               // Optional: explicit assignment plan; if omitted, resolves semester core curriculum
      {
        "courseCode": "22CSC14",
        "facultyId": "FWL-04",       // Optional: validated against authoritative HOD allocation
        "requiredPeriods": 4,        // Optional: defaults to course curriculum requirement
        "type": "THEORY"             // Optional: THEORY or LAB
      }
    ],
    "generationSeed": 834291,        // Optional: integer seed for deterministic reproducible generation
    "options": {
      "maxNodes": 5000,              // Optional search limit
      "maxBacktracks": 1200,         // Optional search limit
      "timeoutMs": 10000             // Optional timeout
    }
  }
  ```
- **Success Response (`HTTP 201`)**:
  ```json
  {
    "success": true,
    "data": {
      "timetableVersion": {
        "_id": "...",
        "status": "GENERATED",
        "versionLabel": "v1.0 (Auto-Generated)",
        "totalScheduledPeriods": 35
      },
      "generationSeed": 834291,
      "sessionsCreated": 35,
      "assignments": [
        {
          "timetableVersionId": "...",
          "academicContextId": "...",
          "courseCode": "22CSC14",
          "courseName": "Principles of Compiler Design",
          "facultyId": "FWL-04",
          "facultyName": "Dr. A. Manchula",
          "day": "MON",
          "period": "P1",
          "room": "LH-101",
          "sessionType": "THEORY",
          "duration": 1
        }
      ],
      "metrics": {
        "generationSeed": 834291,
        "variablesCount": 35,
        "nodesExplored": 42,
        "backtracks": 0,
        "forwardCheckFailures": 0,
        "durationMs": 120
      },
      "diagnostics": {
        "status": "SUCCESS",
        "message": "Complete timetable generated satisfying all hard constraints and soft heuristics."
      }
    }
  }
  ```
- **Error Codes**:
  - `400 BAD_REQUEST / INVALID_CONTEXT`: Malformed request or inactive academic context.
  - `401 UNAUTHORIZED`: Missing or invalid Bearer token.
  - `403 FORBIDDEN`: Insufficient role permissions (e.g. `FACULTY`).
  - `404 NOT_FOUND`: Academic context, course, or faculty not found.
  - `409 HOD_ALLOCATION_REQUIRED`: A course lacks an approved HOD Course → Faculty allocation.
  - `409 HOD_ALLOCATION_CONFLICT`: Multiple conflicting active HOD allocations exist for the course.
  - `409 HOD_FACULTY_MISMATCH`: Requested faculty does not match authoritative HOD allocated faculty.
  - `409 COURSE_SEMESTER_MISMATCH`: Course belongs to a different curriculum semester than the selected cohort.
  - `409 UNSATISFIABLE_CONSTRAINTS`: No conflict-free timetable exists within the active constraints.
  - `409 SEARCH_LIMIT_REACHED`: Search nodes or backtracks limit reached before finding complete solution.

### `POST /api/timetable/session`
Create scheduled slot (`day`, `period`, `room`, `courseCode`, `facultyId`).
- Checks for hard conflicts: returns 409 if faculty is already busy at that slot.

---

## 8. Notifications

### `GET /api/notifications`
Get user notifications with unread count.

### `PATCH /api/notifications/:id/read`
Mark individual notification as read.

### `PATCH /api/notifications/read-all`
Mark all notifications read for the user.

---

## 9. Availability, Absences & Substitutes

### `GET /api/availability` & `POST /api/availability`
Record faculty availability or preferences.

### `GET /api/absences` & `POST /api/absences`
Submit and track faculty leave.

### `PATCH /api/absences/:id/status`
HOD approval/rejection of leave.

### `GET /api/substitutes` & `POST /api/substitutes`
Assign substitute faculty to a scheduled timetable session without altering historical workload.
