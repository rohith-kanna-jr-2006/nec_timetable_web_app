# Architecture: NEC Timetable Web Application — Frontend

> Revision: 2026-10-03
>
> This document defines the frontend structure, data flow, ownership boundaries, and intentional architecture decisions.

## 01 System overview

The frontend is a React web client that communicates with the backend API.

```text
Browser
  |
  v
React Web Application
  |
  +--> Authentication / route protection
  |
  +--> Role-based pages
  |      |
  |      +--> HOD Portal
  |      +--> Time Table Coordinator / AC Portal
  |      +--> Faculty Portal
  |
  +--> API / service layer
          |
          v
      Node.js / Express Backend
          |
          v
        MongoDB
```

The frontend never accesses MongoDB directly.

The frontend never performs authoritative timetable business logic.

> `AC` may remain the backend's internal role identifier. The user-facing frontend role name is `Time Table Coordinator` / `TC`.

## 02 Tech stack

| Layer | Choice | Intentional decision |
| --- | --- | --- |
| Frontend | React | Existing web application stack |
| Language | JavaScript | Project constraint; do not introduce TypeScript |
| Bundler | Existing Webpack setup | Preserve current architecture; do not migrate to Vite |
| Routing | Existing React Router setup | Use existing route structure |
| Styling | Existing project CSS / styling system | Preserve established visual language |
| API | Existing frontend service/API layer | Keep backend interaction centralized |
| Auth | Existing JWT-based backend authentication | Frontend consumes auth contract; it does not replace it |
| Database | MongoDB via backend only | No direct client database access |
| Browser validation | Playwright MCP | Required for UI/integration validation where browser testing is applicable |

### Hard constraints

```text
JavaScript only
No .ts
No .tsx
No TypeScript migration
No Vite
No Angular
No replacement of the existing Webpack architecture
```

## 03 Project structure

Use the current repository structure rather than inventing a new one.

Expected high-level structure:

```text
/
├── AGENTS.md
├── CLAUDE.md
├── docs/
│   ├── PRD.md
│   ├── DESIGN_SYSTEM.md
│   └── ARCHITECTURE.md
├── web/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   ├── contexts/
│   │   ├── layouts/
│   │   ├── routes/
│   │   ├── constants/
│   │   └── styles/
│   ├── public/
│   └── package.json
├── backend/
└── ...
```

Exact subfolders may differ; verify the repository before adding files.

### Where new frontend code belongs

- Page-level behavior → existing `web/src/pages/...`.
- Reusable UI → existing `web/src/components/...`.
- API interaction → existing `web/src/services/...` or established API client pattern.
- Page-local state → local component/page state unless the existing architecture already provides a suitable context.
- Shared design rules → existing style/token system.
- Browser tests → existing Playwright MCP/browser workflow.

Do not invent parallel frontend folders that duplicate existing responsibilities.

## 04 Roles and ownership

### HOD

Frontend surfaces:
- academic context selection
- authoritative HOD faculty allocation
- timetable review
- approval
- rejection with remarks
- publication where backend allows it

### Time Table Coordinator (TC)

Frontend surfaces:
- academic context/cohort selection
- HOD-approved allocation visibility
- timetable design/generation workflow
- generated timetable review
- submission/handover to HOD

The frontend must not allow TC UI actions to override HOD-approved faculty authority.

### Faculty

Frontend surfaces existing faculty views and faculty-specific workflows.

### Ownership boundary

Frontend owns:

```text
React pages
React components
React Router
UI/UX
forms
frontend state
API integration
loading/error/empty/business-state presentation
responsive behavior
accessibility
frontend tests
browser validation
visual consistency
production build
frontend documentation
```

Backend owns:

```text
Node.js / Express
MongoDB / Mongoose
schemas
migrations
seeds
authoritative API business rules
faculty eligibility authority
workload calculations
timetable generation
optimization
conflict detection
TimetableVersion lifecycle enforcement
approval/publish enforcement
backend-heavy tests
```

Do not move backend-owned responsibilities into React to compensate for an API limitation.

## 05 Academic context data flow

```text
User chooses:
Year
  ↓
Semester / Academic Term
  ↓
Section / Cohort / Class
  ↓
Backend resolves Academic Context
  ↓
Frontend receives:
- Academic Context
- Regulation
- Applicable curriculum
- Allocation state
- Timetable state
```

The frontend must render backend responses. It must not fabricate academic context IDs, courses, faculty assignments, or workflow states.

## 06 Faculty Allocation data flow

```text
HOD Faculty Allocation Page
        |
        v
GET /api/hod/faculty-allocation/context/:academicContextId
        |
        v
Backend returns:
- courses
- applicable curriculum
- allocation policy
- faculty slots
- existing assignments
- allocation status
        |
        v
React renders the correct row:
- Theory
- LAB
- MC
        |
        v
PUT /api/hod/faculty-allocation/context/:academicContextId/course/:courseCode
        |
        v
Backend validates + persists
        |
        v
Frontend updates from API response
```

The UI must update from the authoritative response, not from a guessed local representation of business state.

## 07 LAB / MC frontend architecture

### LAB

Backend contract conceptually provides:

```text
allocationRule = LAB_2_TO_3

PRIMARY
  required
  theory-linked

ADDITIONAL
  required
  manual

OPTIONAL
  optional
  manual
```

Frontend responsibilities:
- render the semantic slots;
- show primary as linked/locked when the backend marks it authoritative;
- require Additional Faculty before save;
- allow Optional 3rd Faculty to remain empty;
- prevent duplicate selection where practical;
- display actionable validation.

Frontend validation is UX support, not authoritative business validation.

### MC

Backend provides an allocation policy.

Frontend maps policy to presentation:

```text
MC_OPTIONAL_MAPPING
    ↓
InductionAllocationFields

MC_DEPARTMENT
    ↓
IndianConstitutionAllocationFields

MC_SAS
    ↓
SasAllocationFields
```

Do not use course-name string matching as the business-rule engine.

## 08 Business/data boundaries

### Frontend may do

- selection state
- form drafts
- loading state
- modal/dropdown state
- immediate client-side validation
- presentation of backend business states
- formatting
- accessibility behavior
- responsive layout

### Frontend must not do

- MongoDB queries
- timetable solving
- authoritative conflict calculation
- final faculty eligibility authority
- workload calculation as source of truth
- elective activation as an independent rule
- hidden HOD allocation fallback
- independent approval/publish decisions
- fabrication of timetable sessions

### Backend remains authoritative for

```text
Course applicability
Faculty eligibility
HOD allocation
Elective activation
Timetable generation
Conflict detection
Version lifecycle
Approval
Publication
Workload business rules
```

## 09 Workflow state architecture

The frontend must distinguish backend-provided workflow states rather than collapsing them into generic empty/success states.

### Academic-data states

```text
CONTEXT_NOT_FOUND
CURRICULUM_UNAVAILABLE
ALLOCATION_INCOMPLETE
READY_FOR_GENERATION
TIMETABLE_NOT_GENERATED
```

### Timetable-version states

```text
GENERATED
PENDING_HOD_APPROVAL
APPROVED
REJECTED
PUBLISHED
```

### Lifecycle

```text
Coordinator generates
      ↓
GENERATED
      ↓
TC sends to HOD
      ↓
PENDING_HOD_APPROVAL
      ├──────────────→ REJECTED
      │                  + rejectionReason
      │
      └──────────────→ APPROVED
                           ↓
                        PUBLISHED
```

The actual allowed transitions remain backend-authoritative. The frontend only displays and invokes actions permitted by the backend/current role.

A valid Academic Context with no timetable is not equivalent to missing data.

Example:

```text
Academic Context exists
+
Curriculum loaded
+
HOD allocation complete
+
No TimetableVersion yet

=> READY_FOR_GENERATION
```

The UI should expose the next useful action instead of rendering only:

```text
No data found
```

## 10 Existing HOD Faculty Allocation architecture

The current HOD screen is a table-oriented page.

```text
FacultyAllocationPage
│
├── AcademicContextSelector
├── AllocationSummary
└── FacultyAllocationTable
      ├── TheoryAllocationRow
      ├── LabAllocationRow
      └── McAllocationRow
            ├── SasAllocationFields
            ├── IndianConstitutionAllocationFields
            └── InductionAllocationFields
```

This is an incremental extension of the current page.

Do not create a parallel allocation page.

## 11 Multi-faculty timetable implication

One LAB class session may have multiple assigned faculty:

```text
One LAB class session
  |
  +--> Faculty A
  +--> Faculty B
  +--> Faculty C (optional)
```

The Class Timetable should show one class session.

Faculty Timetable views may show that same session for every assigned faculty.

The frontend must not duplicate one LAB class into multiple class timetable sessions merely because multiple faculty are assigned.

The frontend must render the backend session representation as intended.

## 12 Review / approval / publication boundaries

### Review scope

The selected timetable review must remain scoped to:

```text
academicContextId
+
Timetable Version identity
```

The frontend must preserve the relationship between the selected context and version.

### Shared review page

Coordinator and HOD review may use the existing shared timetable review page with role-specific actions rather than duplicating the page.

### HOD handover boundary

The Time Table Coordinator owns submission of a generated timetable to HOD.

The HOD owns review, approval, rejection, and publication according to backend state.

### Approval

Frontend shows backend-provided version state and actions allowed to the current role.

### Publication

Frontend does not infer that a generated/approved version is public.

Published status is backend-authoritative.

### Public/class view

When an API exposes only PUBLISHED data by default, frontend must not invent a draft fallback.

## 13 API integration rules

Use the existing frontend service/API layer.

Before implementing against an API:
- inspect actual backend route definitions;
- inspect actual service/controller response shapes;
- verify request and response field names;
- verify authentication requirements;
- verify structured error responses.

Do not duplicate backend business rules in React.

## 14 Testing architecture

### Unit/component

Test where practical:
- allocation field rendering
- validation states
- role-specific visibility
- loading/error/empty states
- responsive layout behavior

### Integration

Verify real API contracts for:
- Academic Context
- Faculty Allocation
- Timetable views
- Review Matrix
- Approval / Publish

### Browser

Playwright MCP is required for relevant UI/integration validation.

Required responsive validation widths:

```text
360
390
430
768
1024
1280
1366
1600
1920
```

At least one browser flow should validate:

```text
valid context + no timetable yet
```

and confirm the UI shows an actionable business state rather than a dead-end.

For approval workflows, validate actual state transitions when suitable test data exists.

## 15 Scalability / future considerations

The frontend should remain data-driven enough to support additional valid Academic Contexts and future allocation policies without duplicating pages.

Expected future variation may include:
- more sections/cohorts
- different active elective selections
- additional allocation policies
- additional session types
- additional backend workflow statuses

Do not create abstractions for unsupported future features unless the current architecture already needs them.

## 16 When the agent must stop and ask

Stop and ask instead of guessing when:
- the backend response contract contradicts the product PRD;
- a requested feature requires moving authoritative business logic into the frontend;
- a new dependency is needed;
- a new route/page is proposed where an existing route can support the requirement;
- a change requires TypeScript, Vite, or an architecture migration;
- a new allocation rule is not documented by the backend;
- workload semantics for multi-faculty sessions are unclear;
- two valid interpretations would produce different UI/business behavior.

## 17 Intentional decisions

Do not "fix" these unless the project owner explicitly changes the architecture:

1. JavaScript-only frontend.
2. Existing Webpack architecture.
3. Backend-authoritative business rules.
4. Current HOD page visual baseline.
5. Whole-CSE / multi-cohort support.
6. Missing timetable as a workflow state.
7. No hidden faculty fallback.
8. Shared timetable review where role-specific actions can be supported by the same page.
