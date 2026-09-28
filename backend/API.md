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

### `POST /api/hod-allocations`
Create draft or submitted allocation.
- **Access**: AC (drafts only), HOD (can create directly as approved)

### `PATCH /api/hod-allocations/:id/status`
Approve or reject allocation.
- **Access**: HOD, ADMIN (AC forbidden)
- **Body**: `{ "status": "APPROVED" | "REJECTED", "rejectionReason": "..." }`

---

## 7. Timetable Version & Sessions

### `GET /api/timetable/faculty/:facultyId`
Get scheduled sessions for a faculty member.
- **Query Params**: `versionId` (optional)

### `GET /api/timetable/class/:academicContextId`
Get class timetable grid.

### `GET /api/timetable/published/:academicContextId`
Get current published timetable for a class.

### `GET /api/timetable/versions`
List timetable versions.

### `POST /api/timetable/version`
Create candidate timetable version.

### `PATCH /api/timetable/version/:id/status`
State machine transition:
`NO_TIMETABLE -> GENERATED -> PENDING_HOD_APPROVAL -> APPROVED -> PUBLISHED`
- **Access**: Transition to `APPROVED` or `PUBLISHED` requires HOD or ADMIN.

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
