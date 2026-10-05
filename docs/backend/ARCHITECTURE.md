# Architecture: NEC Timetable Web Application

## 01. System overview

```text
                           ┌──────────────────────────────┐
                           │ React Web Application        │
                           │ JavaScript + existing       │
                           │ Webpack setup                │
                           └──────────────┬───────────────┘
                                          │ HTTPS / JSON
                                          ▼
                           ┌──────────────────────────────┐
                           │ Express API                  │
                           │ Routes + Controllers         │
                           └──────────────┬───────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              ▼                           ▼                           ▼
     ┌─────────────────┐        ┌──────────────────┐        ┌─────────────────┐
     │ Auth / RBAC     │        │ Domain Services  │        │ Timetable       │
     │ JWT / roles     │        │ allocations /    │        │ Engine / Solver │
     │                 │        │ workflow         │        │ constraints     │
     └─────────────────┘        └────────┬─────────┘        └────────┬────────┘
                                         │                           │
                                         └─────────────┬─────────────┘
                                                       ▼
                                           ┌─────────────────────┐
                                           │ MongoDB / Mongoose  │
                                           │ canonical state     │
                                           └─────────────────────┘
```

Core boundaries:

```text
Frontend → HTTP API only
API → services/domain logic
Services → models/persistence + timetable engine
Public timetable → PUBLISHED data only
Backend → authority for business rules and workflow state
```

---

## 02. Technology constraints

### Frontend

- React
- JavaScript only
- existing Webpack setup
- existing routing/state/component architecture

### Backend

- Node.js
- Express.js
- JavaScript only
- CommonJS
- MongoDB
- Mongoose
- JWT + bcryptjs

Do not introduce TypeScript, `.ts`, `.tsx`, Vite, Angular, a second backend framework, or a replacement ODM without explicit approval.

---

## 03. Repository structure

Use the repository's actual folders as the source of truth. The conceptual structure is:

```text
project/
├── docs/
│   ├── PRD.md
│   ├── DESIGN_SYSTEM.md
│   ├── ARCHITECTURE.md
│   └── AGENTS.md
│
├── web/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── ...
│   └── package.json
│
└── backend/
    ├── src/
    │   ├── controllers/
    │   ├── routes/
    │   ├── services/
    │   ├── models/
    │   ├── middleware/
    │   ├── validators/
    │   └── utils/
    ├── tests/
    └── package.json
```

Do not reorganize existing code merely for stylistic consistency.

---

## 04. Domain model boundaries

The main workflow entities are:

```text
AcademicContext
    ↓
Curriculum / Course applicability
    ↓
HOD Faculty Allocation
    ↓
TimetableVersion
    ↓
TimetableSession[]
    ↓
Review / Approval / Publication
```

### Academic Context

The primary isolation boundary for class/cohort-specific data.

Every context-sensitive operation must use `academicContextId`.

### Course

Canonical curriculum identity. Session and activity semantics are represented in separate fields rather than by changing the course name.

### Faculty Allocation

The HOD-controlled mapping between a Course and one or more Faculty assignments according to the course's allocation policy.

### TimetableVersion

Represents one generated/reviewed/published timetable artifact for one Academic Context.

### TimetableSession

Represents one class event at one day/period/room position. Multi-faculty assignment is represented inside the same session.

---

## 05. HOD allocation architecture

```text
AcademicContext + Course + Faculty Assignment(s)
```

Theory:

```text
Course → 1 Faculty
```

LAB:

```text
Course
 ├── PRIMARY
 ├── ADDITIONAL
 └── OPTIONAL
```

MC SAS:

```text
Course
 ├── MATHS_BME
 └── ENGLISH
```

MC Indian Constitution:

```text
Course → department-eligible faculty
```

MC Induction:

```text
optional faculty / optional mapping
```

Allocation rules are metadata/policy driven. Controllers and components must not infer these rules from course-name text.

---

## 06. Timetable session semantics

A class slot is one class event:

```text
TimetableSession
  ├── academicContextId
  ├── timetableVersionId
  ├── course identity
  ├── sessionType
  ├── day
  ├── period
  ├── room
  └── facultyAssignments[]
```

Example:

```text
ONE LAB SESSION
  ├── PRIMARY faculty
  └── ADDITIONAL faculty
```

The class timetable must not duplicate that event per faculty.

Faculty timetable views may project the same session into multiple faculty calendars.

---

## 07. Frontend data flow

### Academic Context / TC design context

```text
TC page
  ↓
frontend API service
  ↓
GET /api/timetable/design-context/:academicContextId
  ↓
server resolves canonical context + curriculum + allocation state
  ↓
frontend renders readiness, courses, allocations, current version
```

The page must not reproduce server-side allocation or eligibility logic.

### Generation

```text
TC action
  ↓
POST /api/timetable/generate-from-context
  ↓
server validates exact Academic Context / assignment state
  ↓
constraint builder
  ↓
solver
  ↓
TimetableVersion + TimetableSession[]
  ↓
frontend receives exact version/status/summary
```

### Review / submission

```text
Generated version
  ↓
GET review endpoint with exact context + version
  ↓
TC reviews
  ↓
PATCH /api/timetable/version/:id/status
  ↓
PENDING_HOD_APPROVAL
```

### HOD governance

```text
PENDING_HOD_APPROVAL
        ├── approve → APPROVED → publish → PUBLISHED
        └── reject  → REJECTED → new revision/version
```

---

## 08. Backend service boundaries

```text
Controller
   ↓
Service
   ├── validation / business state
   ├── model queries
   └── timetable engine where required
```

Use the following placement rules:

| Responsibility | Layer |
|---|---|
| HTTP request/response | Controller |
| Route registration | Route |
| Business rule | Service/domain layer |
| Schema/index/persistence definition | Model |
| Cross-cutting auth | Middleware |
| Input validation | Validator/service according to existing pattern |
| Solver/constraints | Existing timetable engine/service area |
| Pure helper | Utility |

Do not put complex timetable rules directly in controllers or React components.

---

## 09. Frontend boundaries

Recommended responsibility split:

```text
Page
 ↓
Feature components
 ↓
Hooks / local state
 ↓
API service
 ↓
HTTP client
```

Frontend may own:

- layout
- navigation
- local form state
- presentation
- client-side convenience validation
- loading/error/empty rendering

Frontend must not own:

- final faculty eligibility
- final course applicability
- allocation policy
- approval authority
- publication authority
- version integrity
- solver constraints

---

## 10. Workflow state architecture

Distinguish data state from timetable state.

```text
CONTEXT_NOT_FOUND
CURRICULUM_UNAVAILABLE
ALLOCATION_INCOMPLETE
ELECTIVE_SELECTION_REQUIRED
READY_FOR_GENERATION
TIMETABLE_NOT_GENERATED
PENDING_HOD_APPROVAL
APPROVED
PUBLISHED
```

A valid context with no timetable is not an error equivalent to a missing context.

The UI should use these states to select the appropriate next action.

---

## 10a. Academic year range (Phase 8)

The canonical representation of an academic year is an explicit pair:

```text
academicYearFrom = 2026
academicYearTo   = 2027
```

`AcademicContext.academicYear` (e.g. `'2026-27'`) is retained only as a **derived compatibility mirror**, so existing consumers keep working. It is never the source of truth.

Rules:

- A `pre('validate')` hook resolves the canonical pair. A legacy `academicYear` string is parsed into the range; when a range is present the mirror is regenerated from it.
- Only the canonical `YYYY-YY` format is accepted. Anything else (`2026/27`, `2026`, `2026–27`) is rejected rather than guessed, because a wrong guess would corrupt the identity of a context.
- `academicYearFrom < academicYearTo` is enforced. `from == to`, `from > to`, and a missing side are all invalid.
- Context identity is `academicYearFrom + academicYearTo + semester + department + year + section`, so `2026-27 / III-A` and `2027-28 / III-A` are distinct contexts.

Helpers live in `src/utils/academicYearRange.js` (`parseAcademicYear`, `formatAcademicYear`, `isValidRange`, `resolveAcademicYearRange`) and the backfill is `src/migrations/migrateAcademicYearRange.js`, which is idempotent and non-destructive.

## 10b. Absence and substitute mapping (Phase 7)

The substitute workflow is backend-authoritative end to end:

```text
FacultyAbsence
      |
      v
resolve exact TimetableSession  (substituteMappingService)
      |
      v
eligible substitute faculty for that exact slot
      |
      v
SubstituteAllocation (persisted)
```

**Deterministic session resolution.** `resolveAffectedSessions` derives the timetable weekday from the absence date in UTC, then matches `TimetableSession` on `day` + `period` + faculty, where faculty is matched either as the session `facultyId` or anywhere inside `facultyAssignments`. Resolution is always scoped to an `academicContextId` and, when supplied, a `timetableVersionId`. It never selects a first match, a first class, or a default faculty. When more than one session matches, the service reports `AMBIGUOUS_AFFECTED_SESSION` / `ambiguity = MULTIPLE_MATCHING_SESSIONS` rather than guessing.

**Eligibility is computed server-side.** `findEligibleSubstitutes` returns only faculty that pass every constraint for that one slot: active record, not the original faculty, not absent on the date, no other session at that day/period, not `UNAVAILABLE`/`PREFERRED_OFF`, and no conflicting `PENDING`/`ACCEPTED` mapping. The faculty master is never handed to the client for client-side filtering.

**Authority split.** TC holds operational substitute-mapping authority. HOD retains administrative authority and ADMIN retains override authority. FACULTY can neither create nor confirm a mapping. This grant is deliberately narrow: it does not give TC HOD faculty-allocation authority.

**Immutability.** Substitute data is stored only on `SubstituteAllocation`. `TimetableSession` is never mutated to carry substitute state, so `academicContextId`, `timetableVersionId`, `courseCode`, `sessionType`, `day`, `period`, `room` and `facultyAssignments` keep their meaning and historical workload is unaffected.

**Context and version anchoring.** `FacultyAbsence.academicContextId` and `SubstituteAllocation.academicContextId` / `.timetableVersionId` / `.day` are optional additions so that pre-Phase-7 records remain valid without a migration. Every mapping written by the service persists them, which is what makes cross-context and cross-version mapping detectable.

---

## 10c. Class Advisor scoping (Phase 8)

A class advisor is scoped to an **exact AcademicContext**, never to a display string such as `III-A` or `2026-27`.

```text
2026-27 / III-A -> Faculty X   (AcademicContext #a)
2027-28 / III-A -> Faculty Y   (AcademicContext #b)
```

These are different contexts, so both assignments are active at the same time and neither overwrites the other. Reassigning within one context deactivates only that context's previous advisor; assignments in other academic years are untouched.

Invariants:

- At most one **ACTIVE** advisor per `academicContextId`, enforced both in the service (deactivate-then-create) and by the partial unique index `active_advisor_per_context_idx`. `INACTIVE` history is unconstrained and is retained.
- `GET /api/class-advisors` requires authentication.
- Write authority is unchanged: HOD assigns, ADMIN overrides. TC and FACULTY are refused.

---

## 10d. Faculty master and DOB-derived credentials (Phase 9)

Faculty Master identity, teaching allocation and institutional responsibility are three separate concerns:

```text
Faculty Master   -> Faculty document (identity; never holds a credential)
Teaching         -> FacultyWorkload document
Responsibility   -> FacultyWorkload.responsibilities
Login account    -> User document (holds only a bcrypt hash)
```

`Faculty` and `User` are **separate records linked by `facultyId`**, not by email. Login accounts use role-based addresses (`hod@...`), so email is not a reliable join key.

### Date of birth

`Faculty.dateOfBirth` is date-only domain data. It is stored at **UTC midnight** and read back through UTC getters, so the calendar day cannot drift with the server timezone. It is optional: legacy records simply have no DOB and none is ever invented.

Accepted input is a real calendar date (`YYYY-MM-DD` or a `Date`). Malformed values, impossible dates such as `2003-02-31`, and future dates are rejected rather than silently coerced.

### Credential flow

When a `dateOfBirth` is supplied at creation, the backend derives the initial credential as `DDMMYYYY`, hashes it with the project's existing `bcryptjs` mechanism, and stores **only the hash** on a linked `User`:

```text
dateOfBirth -> DDMMYYYY -> bcrypt hash -> User.passwordHash
```

The plaintext value exists only transiently in memory. It is never persisted, logged, or returned by any endpoint. When no `dateOfBirth` is supplied no account is created, which preserves the pre-Phase-9 creation workflow exactly.

Editing faculty information never writes a credential, so an existing `passwordHash` is always preserved and a DOB change never resets a password.

### Faculty edit whitelist

`PUT /api/faculty/:facultyId` accepts **only** `facultyName`, `email`, `dateOfBirth`, `designation`, `phone`. Every other field is rejected with `PROTECTED_FIELD` (400) rather than silently dropped, so an attempted privilege escalation is visible to the caller. The previous implementation passed the raw request body into `findOneAndUpdate`, which allowed `role`, `department`, `facultyId`, `isActive` and arbitrary fields to be mass-assigned.

Editing `email` does **not** rewrite the login account: a PII edit must not silently change credential identity or break an existing login.

## 10e. Elective Object (EO) selection (Phase 10)

The EO decision is **HOD-authoritative** and **AcademicContext-scoped**:

```text
Course catalog (EO)  -> candidate (regulation + slot eligible)
       ^
       | HOD selects (POST /api/hod-allocations)
       v
HODFacultyAllocation (per academicContextId)  -> ACTIVE elective
       ^
       | TC reads only
       v
TC design context -> timetable generation
```

The backend distinguishes five states that must not be conflated:

| State | Meaning |
| --- | --- |
| Elective catalog | An EO course exists in `Course` (`category`/`electiveType` = PEC/OEC/Management Elective). |
| Elective candidate | That course is applicable to the context's regulation **and** its semester's slot types. |
| HOD selection | An `HODFacultyAllocation` exists for that exact `academicContextId`. |
| Active elective | A selection that exists and is not `REJECTED`. |
| Timetable eligibility | Active electives surfaced in the TC design context for generation. |

A catalog entry is never automatically active. Only an HOD allocation activates an elective. Context A's selection never becomes active in Context B.

### Regulation handling

Regulation is a **data-derived** concept, not a hardcoded constant:

- `Course.regulation` carries the regulation (`R22`, `R22-PG`).
- The regulation applying to a context is derived from the `AcademicContext.programme`.
- `getSupportedRegulations()` reports only regulations the `Course` collection genuinely holds. **R17 / R26 are never fabricated**, even though the frontend may wish for them.
- `contextStatusService.regulation` is derived rather than hardcoded to `R22`.

A candidate must belong to the cohort's regulation; otherwise the selection is refused with `ELECTIVE_COURSE_WRONG_REGULATION`. Slot-type eligibility (PEC / OEC / Management Elective per `R22_ELECTIVE_SLOT_MAP`) was already enforced by `createAllocation` and remains unchanged.

### Note on `Course.academicYear`

`Course.academicYear` / `curriculumYear` (`"2024-25 onwards"`) express **R22 curriculum applicability** and are unrelated to `AcademicContext.academicYearFrom`/`academicYearTo`, which express an **academic-year range** (Phase 8). These are different concepts and are deliberately not migrated into each other.

## 10f. Course period requirements and workload integrity (Phase 11)

### Canonical requirement chain

There is exactly **one** canonical definition of a course's weekly period requirement:

```text
Course.totalPeriod            (preferred)
   or Course.L + T + P        (fallback sum)
   -> MISSING                 (nothing is invented)
   -> tcDesignContextService.requiredPeriods
   -> constraintBuilder totalPeriod / labBlockSize
   -> solver
   -> TimetableSession count
   -> validateTimetable (allocated === requiredPeriods)
```

`courseRequirementService.resolveCourseRequirement` reports the origin as `TOTAL_PERIOD`, `LTP_SUM` or `MISSING`.

**The historical hidden fallback is removed as a *hidden* path.** The former `|| (isLab ? 4 : 3)` silently invented a period count for any course without a requirement. Generation behaviour is deliberately unchanged for every course that has canonical data, but a requirement-less course now reports `requiredPeriodsSource: 'LEGACY_FALLBACK'` and `requiredPeriodsAuthoritative: false` so the curriculum gap is visible instead of indistinguishable from real data. `validateSessionCounts` reports such courses under `incompleteRequirements`.

`totalPeriod`, `L/T/P` and `contactHours` are compatibility fields on `Course`; `totalPeriod` is canonical, `L/T/P` is its fallback decomposition. **Contact hours are not assumed equal to timetable periods** — no conversion rule is invented.

### Session count semantics

One `period` is one timetable slot. A multi-faculty LAB or MC_SAS is **one class event per slot**: several faculty share the same class session. `validateSessionCounts` counts class `TimetableSession` documents and never multiplies by `facultyCount`, so a 3-faculty LAB with 3 slots is 3 class sessions, not 9. Faculty projections legitimately show the session in several faculty timetables; that does not create extra class events or extra class workload.

### Workload source of truth

```text
Course requirement + HOD allocation (FacultyWorkload.teaching / .responsibilities)
        -> backend calculation
        -> FacultyWorkload.calculated*Hours
```

- `calculateTeachingHours` sums `teaching.{ugTheory1,ugTheory2,lab1,lab2,pg,others}[].hours`.
- `calculateResponsibilityHours` sums `responsibilities[].hours`.
- `calculatedTotalHours` = teaching + responsibilities.

Workload is **HOD-allocation driven**, not session driven: a workload record reflects the allocation a HOD approved. `courseRequirementService.deriveWorkloadTotals` reproduces the same arithmetic for verification.

`calculatedTeachingHours`, `calculatedResponsibilityHours`, `calculatedTotalHours`, `teaching` and `responsibilities` are **backend-authoritative** and are rejected when supplied by a client (`WORKLOAD_FIELD_PROTECTED`, 400). `sourceTotalHours` remains accepted as reference data.

**Ambiguity reported, not guessed:** the repository defines no multiplier distinguishing `PRIMARY` / `ADDITIONAL` / `OPTIONAL` within a multi-faculty LAB, nor between `MATHS_BME` and `ENGLISH` within `MC_SAS`. No such multiplier was invented. Each faculty assignment is stored on the session and counted once in that faculty's own projection; the class event count remains one per slot.

## 10g. Seed integrity and test isolation (Phase 12)

### Canonical seed vs demo/test fixture

```text
Canonical master seed          Demo / test fixture
-----------------------------  ---------------------------------
regulation + courses           temporary timetable versions
faculty                        temporary sessions
AcademicContexts               temporary HOD allocations
baseline HOD allocations       temporary users / workload rows
```

`npm run seed` remains the canonical entry point and keeps its refresh semantics, but it no longer erases whole collections. Every seed resets only the rows it owns:

| Seed | Previous | Now |
| --- | --- | --- |
| `seedUsers` | `User.deleteMany({})` | deletes only the emails it defines |
| `seedWorkload` | `FacultyWorkload.deleteMany({})` | deletes only its master faculty ids |
| `seedHandlers` | `CourseFacultyHandler.deleteMany({})` | deletes only its own course codes |
| `seedAcademicContext` | already upsert-scoped | unchanged |
| `seedTimetable` | already scoped to its own version + 2 documented legacy codes | unchanged |

A global `deleteMany({})` during seeding was itself a contamination source: it destroyed unrelated accounts and workload rows belonging to other suites. `seedTimetable` never resets timetable history — it replaces sessions only for the exact version it owns.

### Suites that mutate shared cohorts

`tests/helpers/testIsolation.js` provides `snapshotSharedContext()` / `restoreSharedContext()`. A suite that needs controlled state for a canonical cohort snapshots its allocations, versions and sessions first, then restores them **verbatim with their original `_id`** during cleanup.

Two suites required this:

- `timetableSolver.test.js` wiped every III-A allocation and replaced them with a hardcoded list, never restoring the originals.
- `wholeCseDepartmentWorkflow.test.js` wiped II-B / II-C versions, sessions and allocations.

### Known leak fixed in `backend.test.js`

Test 17 created an **empty** timetable version and then submitted it. The Phase 5 submission guard correctly refuses a version with zero sessions, so the suite threw a fatal error **before its cleanup ran**, leaking one allocation + one version per failed run — the source of the duplicate `22CSC14` allocations that broke `coordinatorTimetableFlow`. The fixture now seeds a session, so the lifecycle transition succeeds and cleanup completes.

### Fixture ownership

Fixtures are namespaced (`P12…`, `P10…`, `P11…`, `P8…`, `P9…`, `P7…`) and removed by exact id or unique prefix. **No cleanup targets shared data by broad real-world attributes** such as `section = A` or `department = CSE`. III-A remains a valid regression fixture but is never the deletion target for generic tests.

### Test order independence

`timetableSolver` → `tcTimetableGeneration` → `tcTimetableReviewSubmission` and the reverse order both produce identical results (67/0, 40/0, 118/0), and `npm test` passes with exit code 0.

## 11. Version governance

The normal workflow is:

```text
GENERATED
   ↓
PENDING_HOD_APPROVAL
   ↓
APPROVED
   ↓
PUBLISHED
```

Rejection creates a historical branch:

```text
PENDING_HOD_APPROVAL → REJECTED
                         ↓
                    new version/revision
```

The exact current backend transition contract remains the source of truth. Agents must not independently invent another state machine in the frontend.

Submitted/approved/published versions may be frozen for mutation according to backend governance rules.

---

## 12. Security boundaries

Every protected server entry point must verify, as applicable:

```text
JWT
RBAC
Academic Context access
course applicability
faculty eligibility
version/context consistency
input validity
```

Never trust client-supplied values for:

```text
approval state
published state
faculty eligibility
allocation policy
context ownership
server-derived required/source fields
```

Public/default timetable endpoints show published data only.

---

## 13. Context and query discipline

Context-sensitive queries should explicitly include:

```text
academicContextId
```

Version-sensitive queries should explicitly include:

```text
timetableVersionId
```

Avoid global "latest timetable" lookups when the requested workflow is bound to a specific context/version.

Use existing indexes, bounded queries, pagination, and batching where applicable.

---

## 14. Elective flow

Keep these concepts separate:

```text
Elective slot
Elective catalog
Elective selection
Active course
```

The scheduling context contains only active selected courses. An entire catalog must not be scheduled merely because catalog rows exist.

---

## 15. Whole-CSE design rule

The architecture must work for:

```text
multiple years
multiple semesters/terms
multiple sections/cohorts
multiple faculty
multiple timetable versions
```

Production code must not contain logic whose only purpose is to support one section such as III-A.

Hardcoded context values are acceptable only inside isolated test fixtures.

---

## 16. Test architecture

Tests must not rely on shared mutable database state unless the suite explicitly documents and controls that dependency.

Preferred test structure:

```text
create owned fixture
  ↓
run operation
  ↓
assert exact API/state
  ↓
assert persistence
  ↓
cleanup owned fixture
```

Destructive resets belong only in isolated test environments.

Browser workflows should use the actual frontend/API boundary. Playwright MCP may be used when UI behavior is part of acceptance.

---

## 17. Performance architecture

Avoid:

- N+1 course/faculty requests
- repeated context resolution within one request
- unbounded timetable session reads
- duplicated solver executions
- global collection scans when indexes can scope the query

Do not add queues or new infrastructure only for theoretical future scale.

---

## 18. Intentional decisions

Agents must not change these without explicit approval or a verified defect:

1. JavaScript-only project.
2. React + existing Webpack frontend remains.
3. Node/Express/MongoDB/Mongoose backend remains.
4. Existing timetable engine is preserved.
5. Academic Context is the main isolation boundary.
6. HOD allocation is authoritative.
7. No silent faculty fallback.
8. Elective catalog entries are not automatically active courses.
9. One multi-faculty class slot remains one TimetableSession.
10. Public/default timetable is PUBLISHED only.
11. Published history is not overwritten.
12. III-A is a test context, not the department boundary.
13. Existing valid API contracts should be preserved where practical.
14. Destructive seed/reset behavior must not be introduced into ordinary production workflows.

---

## 19. Ownership

### Frontend owner

Owns:

- React pages/components
- routing/navigation
- client state
- responsive UI
- accessibility
- frontend API integration
- browser validation

### Backend owner

Owns:

- Node/Express API
- MongoDB/Mongoose
- auth/RBAC
- domain rules
- HOD allocation
- timetable generation/solver
- conflict detection
- versioning
- approval/publication
- backend tests/integration

Shared changes must preserve the API contract and should be coordinated explicitly.

---

## 20. When an agent must stop

Stop before coding when the task would require:

- a breaking API contract without approval
- a new framework
- a new external service
- a new database collection without documented domain need
- changing authorization semantics
- replacing the solver strategy
- changing an existing business formula without the source rule
- deleting/rebuilding timetable history
- changing an intentional architecture decision above

When possible, state the exact conflict and propose the smallest compatible change.
