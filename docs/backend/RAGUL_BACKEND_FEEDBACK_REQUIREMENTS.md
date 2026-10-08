# NEC Timetable Web App — Backend Feedback & Engineering Requirements

## Target Developer

**Backend Developer:** Ragul  
**Primary Branch:** `ragul-backend`  
**Integration Target:** `main` only after backend + frontend integration testing is complete.

## Purpose

This document consolidates the second-round engineering feedback for the NEC Faculty Timetable & Workload Management System and converts the feedback into **backend-specific implementation requirements, validation rules, workflow expectations, API responsibilities, security requirements, and phase-wise work items**.

The backend is the authoritative layer for business rules, authorization, data integrity, academic-context isolation, timetable generation constraints, and approval/publication workflow.

The frontend may provide usability restrictions and visual guidance, but **frontend behavior must never be treated as the final enforcement mechanism**.

---

# 1. Core Engineering Principles

## 1.1 Backend authority

All business-critical constraints must be enforced server-side.

The backend must remain authoritative for:

- Authentication and RBAC
- Faculty workload limits
- Course allocation limits
- Institutional responsibility limits
- Academic-year isolation
- Academic-context validity
- Course/elective requirements
- Timetable generation constraints
- Faculty-period conflict detection
- HOD approval workflow
- Rejection feedback workflow
- Locking and publication
- Faculty data-scope security

Do not weaken server-side validation to make a frontend workflow appear successful.

## 1.2 Frontend must not replace backend rules

The frontend may hide or disable a faculty option after a workload limit is reached, but the backend must independently reject an invalid assignment.

The frontend may remove a faculty-selection dropdown, but the backend must still enforce authenticated faculty scope.

The frontend may display generation readiness, but the backend must re-derive the actual courses, faculty, requirements, and periods before generation.

## 1.3 Preserve existing architecture

Before changing models, controllers, routes, services, or solver behavior:

1. Inspect the existing implementation.
2. Identify current data flow and contracts.
3. Extend existing mechanisms where possible.
4. Avoid duplicate business logic.
5. Avoid rebuilding an already-working subsystem unless the current design cannot satisfy the requirement.

Do not remove existing backend APIs merely because a frontend navigation item is removed.

---

# 2. Authentication & RBAC — TC Login

## Requirement

The development quick-login toolbar must expose:

- Faculty
- TC
- HOD

The existing **`Coord (AC)`** quick-login preset must be converted to **TC**.

## Important distinction

Removing the **AC quick-login preset** does **not** mean deleting the entire AC role from the application unless an independent requirement explicitly requests that.

The specific requirement is that the quick-access development login must use:

`Faculty | TC | HOD`

## Backend responsibilities

Verify all of the following:

- A valid TC test user exists.
- TC credentials are valid.
- Authentication returns the expected TC role.
- JWT/session claims contain the expected role.
- TC is authorized for the TC portal.
- TC is not incorrectly authenticated as AC.
- Existing Faculty and HOD authentication remains functional.
- RBAC middleware permits TC operations required by the timetable workflow.

## Failure condition

Changing only the visible button label from `Coord (AC)` to `TC` is not sufficient if the backend still authenticates the user as AC.

---

# 3. Faculty Workload Constraints

## 3.1 UG Theory

A faculty member can be allocated a maximum of:

**2 theory courses**

When the limit is exceeded, the backend must reject the request.

The frontend may hide the faculty from the next dropdown, but the backend must still enforce the limit.

## 3.2 UG Laboratory

A faculty member can be allocated a maximum of:

**2 lab courses**

The backend must reject a third lab allocation.

## 3.3 PG / Honours / PG-level course handling

A faculty member can handle:

**1 subject maximum**

Once assigned, the backend must prevent a second PG-level subject assignment where the rule applies.

## 3.4 Validation expectations

The backend should expose deterministic validation results so the frontend can explain why a faculty member is unavailable.

Example conceptual error categories:

- THEORY_LOAD_LIMIT_EXCEEDED
- LAB_LOAD_LIMIT_EXCEEDED
- PG_LOAD_LIMIT_EXCEEDED
- FACULTY_ALREADY_ASSIGNED
- FACULTY_NOT_ELIGIBLE

Use the project's existing error-code conventions if they already exist; do not introduce a parallel error schema unnecessarily.

---

# 4. Other Academic Activities

Other academic activities may include:

- Project-based learning
- Mini projects
- Specialized tutorials
- Seminar sessions
- Similar non-course academic duties

Required weekly range:

**1 to 3 hours/week**

The backend must validate that an assignment outside the allowed range is rejected.

Do not rely only on UI min/max controls.

---

# 5. Institutional Responsibilities — 38 Master Roles

The system must use the authoritative institutional responsibility master list.

Examples include:

## Academic

- Class Advisor
- Proctor
- Overall Academic Coordinator
- Student Affairs Coordinator
- One Credit Course
- NPTEL Online Courses (Faculty & Students)
- Student Exit Survey

## Administrative

- Admin Coordinator
- DCOE
- Dept. Exam Cell I/C
- CC1 Lab Incharge
- CC2 Lab Incharge
- CC3 Lab Incharge
- AI Affiliation/AICTE Work
- Dept. Infrastructure / Maintenance / Furniture
- Dept. Meeting Minutes

## Coordination

- Timetable Coordinator
- Timetable I/C
- NBA Coordinator
- NAAC/NBA Coordinator
- NIRF/IQAC Coordinator
- Dept. CIPD Coordinator
- Dept. CFiR and RSD Coordinator
- PAC, DAB, BoS Coordinator
- P&EA Coordinator
- Placement Coordinator
- Industrial Relations Coordinator
- MOU/Internship

## Institutional

- TECH GURU
- Dept. Association
- Dept. Newsletter/Magazine
- Institute Social Media and Website Updation
- Faculty Achievements
- Student Achievements
- Alumni & Higher Studies
- PCD Club
- Professional Society/Chapter
- Startups & Business Incubation / Entrepreneur

## Responsibility workload constraint

Institutional responsibility contact hours must be constrained to:

**1 to 6 hours/week**

## Duplicate prevention

The backend must prevent duplicate role assignments for the same faculty member where the same responsibility would otherwise be assigned more than once.

Validation must occur server-side.

---

# 6. Academic Context & Academic-Year Isolation

## Core requirement

Assignments and timetable drafts must be explicitly bound to the selected academic year/context.

Example:

`Academic Year 2026-27`

must not automatically affect:

- 2025-26
- 2027-28
- other academic contexts
- other semesters/sections outside the selected context

## Backend requirements

Every allocation/generation workflow must resolve through the correct academic context.

The backend must prevent:

- Global allocation leakage
- Cross-academic-year assignment leakage
- Using historical allocations in a new academic year without explicit context
- Using the wrong semester/section context
- Generating a timetable from unrelated context data

## Expected model relationship

Conceptually:

`Academic Context -> Curriculum/Courses -> HOD Faculty Allocation -> TC Design -> Generated Timetable`

All dependent records must remain scoped to the selected academic context.

---

# 7. Other Courses / Non-Course Requirements

## HOD authority

The HOD defines other-course/non-course requirements based on:

- Academic year
- Semester
- Academic context

## TC authority

After HOD defines the requirement, the Timetable Coordinator receives operational authority to assign appropriate faculty.

The backend must preserve this authority separation.

Expected flow:

`HOD defines requirement`
→
`TC assigns faculty`
→
`Backend validates`
→
`Requirement becomes schedulable`

The TC must not be allowed to create or redefine HOD-governed requirements when the workflow does not permit it.

---

# 8. Elective Course Management

Elective object courses and specialization modules are determined by the Department HOD.

Backend must ensure:

- Elective definition is context-scoped.
- Elective requirements do not silently become global.
- TC can operate on approved HOD-defined elective requirements.
- Generation only includes valid requirements belonging to the selected academic context.

---

# 9. Timetable Assignment & Generation

## 9.1 Authoritative generation

The timetable generation request must use the authoritative academic context.

Expected conceptual flow:

`POST /api/timetable/generate-from-context`

Request:

```json
{
  "academicContextId": "<context-id>"
}
```

The server must re-derive:

- Courses
- Faculty allocations
- Required periods
- Lab requirements
- Context constraints
- Faculty availability
- Existing conflicting timetable sessions

The frontend must not be trusted to send a fabricated assignment plan or period count.

## 9.2 Do not use frontend-derived scheduling truth

Do not make backend behavior depend on client-calculated:

- `isLab ? 4 : 3`
- guessed period counts
- client-generated assignment plans
- client-side workload totals
- UI-only readiness flags

The backend is the final scheduling authority.

---

# 10. Required Period Audit

Before generation, validate that each course's required periods/week match the applicable curriculum/regulation requirement.

Backend should detect:

- Missing required periods
- Excess required periods
- Invalid course requirement definitions
- Requirement/context mismatches

Generation should not silently manufacture periods to compensate for invalid data.

---

# 11. Theory Scheduling Rules

The timetable solver must avoid undesirable repeated blocks.

## No continuous over-repetition

Do not allow a subject to occupy excessive continuous periods unless the applicable regulation explicitly requires it.

## Half-day distribution

Avoid placing identical subjects across inappropriate consecutive morning/afternoon/evening blocks.

The solver should distribute theory periods logically.

## Block allocation prevention

Prevent a single theory subject from unnecessarily consuming:

- 3 continuous periods
- 4 continuous periods
- a whole morning
- a whole afternoon
- a whole evening

unless explicitly required by the relevant academic rule.

---

# 12. Laboratory Scheduling Rules

## 12.1 Lab block duration

A lab requires:

**4 continuous periods**

Treat the four periods as one scheduling block.

## 12.2 Conflict analysis

Before placing a lab block, verify:

- All assigned faculty are available.
- The exact periods are not already occupied by the same faculty elsewhere.
- Parallel classes do not create faculty conflicts.
- Existing timetable sessions do not create collisions.
- The selected classroom/lab constraints are respected by the current model.

## 12.3 Multi-faculty lab sessions

Where the existing allocation model supports:

- PRIMARY
- ADDITIONAL
- OPTIONAL

faculty assignment, the timetable should preserve the multi-faculty assignment within one lab session instead of splitting the same lab into independent timetable sessions.

The solver must validate availability for all assigned faculty.

---

# 13. Lab Afternoon Distribution Rule

## More than one lab

If:

`labCount > 1`

then:

**at least one lab must be scheduled fully in the afternoon.**

## Exactly one lab

If:

`labCount == 1`

the lab may be scheduled in morning or afternoon.

Default preference:

**Morning**

The backend solver must enforce the final rule; the frontend should only display the resulting schedule.

---

# 14. Faculty Double-Booking Prevention

The solver must analyze schedules across parallel classes.

A faculty member must not be assigned to two classes in the same period.

This applies to:

- Theory
- Labs
- Other course requirements
- Institutional duties where those duties are represented in the timetable

The conflict check must operate against authoritative persisted schedule data.

---

# 15. Dual Timetable Output

The generated timetable must support both:

## Output 1 — Class Advisor / Class Timetable

A comprehensive class-specific timetable for the designated class.

## Output 2 — Individual Faculty / Proctor / Non-Class-Advisor Timetable

Faculty-centric schedules mapped to:

- Faculty
- Proctors
- Non-class-advisor faculty

The same underlying timetable allocation must remain internally consistent across these views.

Do not generate two contradictory datasets for the same timetable run.

---

# 16. HOD Approval & Revision Workflow

## 16.1 Submission

After the TC generates a timetable:

`TC generates`
→
`TC submits`
→
`HOD review`

## 16.2 Approval

When HOD approves:

- Timetable becomes locked.
- Timetable becomes officially publishable/published according to the existing publication model.
- Unauthorized edits must be prevented after locking.

## 16.3 Rejection

When HOD rejects:

- HOD must be able to provide a specific suggestion/feedback text.
- The rejection reason must be persisted.
- The workflow must return the timetable to the TC for correction.
- TC must be able to revise and resubmit.

Conceptual lifecycle:

```text
DRAFT
  ↓
GENERATED
  ↓
PENDING_HOD_APPROVAL
  ├──→ APPROVED → LOCKED/PUBLISHED
  └──→ REJECTED → TC_REVISION → RESUBMITTED
```

Use the project's existing lifecycle state names where they already exist; do not introduce duplicate status systems unnecessarily.

---

# 17. Publication Safety

Do not expose a timetable as officially published merely because it has been generated.

The backend must distinguish at minimum between:

- Generated
- Pending HOD approval
- Approved
- Published/locked

Public or faculty-facing consumers must receive only the state permitted by the current publication rules.

---

# 18. Faculty Data-Scope Security

The feedback requests removal of cross-faculty and class multi-select controls from the standard Faculty Weekly Matrix UI.

This is a UX change, but the backend must provide the actual security boundary.

For authenticated Faculty users:

1. Identify the faculty from the authenticated identity.
2. Scope timetable queries to the authenticated faculty.
3. Reject unauthorized cross-faculty lookups.
4. Do not rely on hidden UI controls as an authorization mechanism.

A user must not gain cross-faculty timetable access by manually modifying an API request.

---

# 19. Simplified Faculty Creation Backend

The HOD "Add New Faculty" screen will collect only essential profile data:

1. Faculty Name with title
2. Date of Birth
3. Designation
4. Optional 10-digit phone number

## Backend responsibilities

The backend should:

- Validate required profile fields.
- Validate optional phone format if supplied.
- Automatically generate the institutional Faculty ID.
- Default the institutional clearance/system role to `FACULTY`.
- Avoid requiring course/lab/workload mapping during initial faculty creation.
- Keep detailed workload/responsibility allocation in its dedicated workflow.

Example institutional ID:

`FWL-28`

The frontend must not be the source of truth for the generated Faculty ID.

---

# 20. Navigation Cleanup — Backend Interpretation

The feedback requests removal of redundant UI navigation entries, including:

- Class Timetable
- Faculty Timetable
- Faculty & Course Allocation / validation navigation from the TC operational dashboard

These are primarily frontend information-architecture requirements.

Backend action:

**Do not delete APIs, controllers, services, models, or database structures merely because a navigation link disappears.**

Only deprecate backend interfaces if an explicit backend requirement is later approved.

---

# 21. API Design Expectations

Backend endpoints should remain context-aware and role-aware.

Any allocation or timetable operation should resolve:

- Authenticated user
- User role
- Academic context
- Department
- Year
- Semester
- Section
- Relevant course/requirement
- Faculty assignments
- Applicable workload/solver policies

Do not construct business decisions solely from course title/name strings.

Use the existing metadata/allocation-policy approach where available.

---

# 22. Data Integrity Requirements

The backend must prevent inconsistent states such as:

- Allocation referencing a course outside the selected curriculum context
- Allocation referencing an invalid faculty
- Faculty assigned beyond workload limits
- Duplicate institutional responsibility
- Timetable generated for the wrong academic year
- Faculty double-booking
- Lab block split into invalid individual periods
- Published timetable remaining editable
- Rejected timetable remaining incorrectly published
- Unapproved timetable being exposed as official

---

# 23. Backend Phase Plan

## B1 — Authentication, TC Identity & RBAC

Tasks:

- Convert quick-login backend/test identity from AC preset to TC identity where applicable.
- Verify TC test credentials.
- Verify JWT role claims.
- Verify TC portal authorization.
- Preserve Faculty/HOD authentication.
- Preserve server-side RBAC.

## B2 — Faculty Workload & Institutional Roles

Tasks:

- UG theory max 2
- UG lab max 2
- PG max 1
- Other academic activity 1–3 hours
- Institutional role master
- Institutional responsibility 1–6 hours
- Duplicate assignment prevention

## B3 — Academic Context & Academic-Year Isolation

Tasks:

- Validate context ownership
- Scope allocations by academic context
- Scope timetable drafts by academic year
- Prevent cross-year leakage
- Validate year/semester/section consistency

## B4 — Course, Elective & Requirement Management

Tasks:

- HOD-defined Other Course requirements
- HOD-defined electives
- Context-aware specialization requirements
- TC operational assignment of approved requirements

## B5 — TC Allocation & Validation APIs

Tasks:

- Faculty allocation validation
- Workload validation
- Context validation
- Requirement validation
- Policy enforcement
- Structured error responses

## B6 — Timetable Solver & Generation

Tasks:

- Required-period validation
- Theory distribution rules
- Lab 4-period blocks
- Faculty conflict checking
- Multi-lab afternoon rule
- Single-lab morning default
- Academic-year-aware generation
- Multi-faculty lab support

## B7 — Timetable Output & Lifecycle

Tasks:

- Class timetable output
- Faculty/proctor output
- Persist generated sessions
- Context lifecycle
- Generation status

## B8 — HOD Approval / Revision / Publication

Tasks:

- TC submission
- HOD approval
- HOD rejection
- Feedback persistence
- TC revision cycle
- Locking
- Publication

## B9 — Security, Integrity & Test Validation

Tasks:

- Faculty scope security
- RBAC regression
- API authorization
- Data integrity tests
- Solver tests
- Approval lifecycle tests
- End-to-end workflow tests
- Regression suite

---

# 24. What the Backend Developer Must NOT Do

Do not:

- Move backend business rules into frontend-only logic.
- Trust frontend workload limits.
- Trust client-provided period counts as authoritative.
- Generate timetables from arbitrary frontend assignment plans.
- Apply assignments globally across academic years.
- Let TC bypass HOD authority where the workflow defines HOD control.
- Allow unapproved data to become officially published.
- Allow cross-faculty timetable access through API manipulation.
- Delete backend APIs because frontend navigation was simplified.
- Delete the entire AC role solely because the quick-login preset was changed.
- Introduce a second, conflicting academic-context mapping system.
- Introduce duplicate lifecycle/status models where existing ones already satisfy the requirement.
- Weaken validation merely to accommodate an inconsistent frontend state.

---

# 25. Recommended Validation Order

For every phase, use:

```text
Inspect existing implementation
        ↓
Identify impacted models/controllers/services/routes/tests
        ↓
Implement the minimum required backend change
        ↓
Run focused tests
        ↓
Run related integration tests
        ↓
Run complete backend test suite
        ↓
Verify API contract
        ↓
Verify frontend integration
```

Do not mark a phase complete merely because a UI button or endpoint responds successfully.

---

# 26. Completion Criteria

Backend work is complete only when:

- TC login works with the correct role.
- Faculty/HOD login still works.
- Workload limits are enforced server-side.
- Institutional role constraints are enforced.
- Academic-year/context isolation is enforced.
- HOD-defined requirements remain HOD-controlled.
- TC assignment authority is correctly scoped.
- Solver constraints are enforced.
- Lab blocks are valid.
- Faculty conflicts are prevented.
- Timetable outputs are internally consistent.
- HOD approval/rejection workflow is functional.
- Rejection feedback reaches the TC workflow.
- Approved timetable becomes locked/published according to the existing model.
- Faculty data-scope security is enforced.
- Existing regression tests remain green.
- New tests cover each newly enforced rule.

---

# 27. Frontend / Backend Boundary Summary

## Frontend owns

- UI layout
- Navigation visibility
- Dropdown visibility
- Quick-login controls
- Form presentation
- Validation messages
- Loading/error states
- Generation controls
- Approval/rejection screens
- Timetable rendering

## Backend owns

- Authentication
- Authorization
- Role enforcement
- Workload limits
- Academic-context isolation
- Course/elective authority
- Allocation validation
- Solver constraints
- Conflict detection
- Timetable persistence
- Approval lifecycle
- Publication/locking
- Data security
- Integrity

---

# 28. Integration Rule

The backend implementation should remain independently valid even if the frontend is bypassed.

Every business rule in this document must therefore be enforceable through backend APIs and/or services without depending on React UI behavior.

Final integration path:

```text
Backend implementation
        +
Frontend implementation
        ↓
Integrated branch testing
        ↓
Full regression validation
        ↓
Approved merge to main
```

---

# 29. Final Instruction for This Feedback Cycle

Treat this document as the **backend engineering checklist for the second-round feedback**.

Before coding any item:

1. Inspect the current repository implementation.
2. Map the requirement to the existing model/controller/service/route/test.
3. Identify whether the requirement is already implemented.
4. Do not duplicate existing functionality.
5. Implement only the required backend-side behavior.
6. Add or update tests for every enforced business rule.
7. Report any requirement that conflicts with the current approved architecture instead of silently changing the architecture.

## Source

This document is derived from the second-round UI/UX and SRS feedback report supplied for the NEC Timetable Web App. Requirements are preserved as engineering constraints and separated into backend responsibilities where applicable.
