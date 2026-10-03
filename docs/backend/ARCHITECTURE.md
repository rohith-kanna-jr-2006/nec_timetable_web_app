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
