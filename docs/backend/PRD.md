# PRD: NEC Timetable Web Application

## 01. Product definition

| Field | Definition |
|---|---|
| Product | NEC Timetable Web Application |
| Purpose | Manage curriculum, HOD faculty allocation, timetable design, generation, review, approval, publication, and faculty/class timetable views |
| Users | HOD, TimeTable Coordinator (TC), Faculty, Admin |
| Department boundary | Entire CSE department, across valid academic contexts |
| Academic model | Academic Context = canonical year + semester/term + section/cohort identity |
| Regulation | R22 CSE curriculum from the project's authoritative curriculum data |
| Web stack | React + JavaScript + existing Webpack setup |
| Backend stack | Node.js + Express.js + JavaScript + MongoDB + Mongoose |
| Status | Active development / production hardening |

This is a full-stack web application. The UI, API, database, timetable engine, and governance workflow are one product. The backend is the authority for domain rules and persisted state; the frontend presents and operates those rules through documented APIs.

III-A is a regression/test context, not the production boundary.

---

## 02. Problem

The college needs one timetable workflow that connects:

```text
Curriculum
  ↓
Academic Context
  ↓
HOD Course → Faculty Allocation
  ↓
TC Timetable Design / Generation
  ↓
Timetable Review
  ↓
HOD Approval / Rejection
  ↓
Publication
  ↓
Class + Faculty Timetable Views
```

The application must distinguish a valid academic context from the absence of a timetable. A context can exist, have valid curriculum and faculty allocation, and still have no generated timetable.

The system must also preserve multi-faculty LAB/MC assignments without duplicating one class event into multiple class timetable rows.

---

## 03. Product goals

1. Provide a context-scoped timetable workflow for every valid CSE Academic Context.
2. Make HOD faculty allocation authoritative and server-validated.
3. Give the TC a controlled design, generation, review, and submission workflow.
4. Give the HOD controlled approval, rejection, and publication authority.
5. Keep published timetable history intact and prevent unauthorized mutation of frozen versions.
6. Keep public/default timetable views limited to published data.
7. Keep the UI responsive across desktop, tablet, and mobile breakpoints.
8. Make workflow state and validation errors understandable to users.

---

## 04. Target users and responsibilities

### HOD

The HOD can:

- manage/confirm faculty data where permitted by the system
- allocate course → faculty for an Academic Context
- review TC-generated timetable versions
- approve or reject a submitted version
- publish an approved version
- inspect validation and conflict information

### TimeTable Coordinator (TC)

The user-facing role name is **TimeTable Coordinator** and the abbreviation is **TC**.

The TC can:

- select an Academic Context
- view curriculum-applicable courses
- consume HOD-approved faculty assignments
- design or generate the timetable
- review the exact generated version
- submit the version for HOD approval
- inspect conflicts and validation results

The TC cannot approve, reject, or publish.

Legacy `AC` compatibility may exist in backend code for older sessions or migration safety, but new UI labels and new product flows use **TimeTable Coordinator / TC**.

### Faculty

Faculty can:

- view timetable information relevant to their assignments
- see all sessions assigned to them, including multi-faculty LAB/MC sessions
- use published timetable information according to their access level

### Admin

Admin retains the application's existing administrative/override responsibilities. New UI work must not silently broaden Admin authority.

---

## 05 Core domain rules

### Academic Context

Every context-sensitive timetable query and mutation must be bound to `academicContextId`.

Every version-sensitive query and mutation must be bound to `timetableVersionId` where applicable.

A missing TimetableVersion does not mean the Academic Context is missing.

### HOD faculty allocation

Theory:

```text
1 faculty
```

LAB:

```text
PRIMARY      required / theory-linked
ADDITIONAL   required
OPTIONAL     optional
```

Allowed LAB faculty count: 2–3.

MC SAS:

```text
MATHS_BME    required
ENGLISH      required
```

Exactly two semantic roles are required, and one faculty member cannot occupy both roles.

MC Indian Constitution uses faculty eligible for the Academic Context's department.

MC Induction supports optional faculty assignment and optional timetable mapping.

These are domain rules. The frontend must not become the source of truth for them.

### Multi-faculty timetable semantics

One class slot is one `TimetableSession`.

For LAB/MC with multiple faculty:

```text
ONE class session
    └── facultyAssignments[]
```

Faculty calendars may project that session into each assigned faculty's view, but the class timetable must retain one class event.

### Electives

An elective catalog entry is not automatically an active timetable course. The active course set must come from explicit valid elective selection.

### No hidden faculty fallback

The application must never silently choose a workload faculty, first available faculty, random faculty, historical faculty, or another-context faculty when a required HOD assignment is missing.

---

## 06 Timetable workflow

### TC workflow

```text
Select Academic Context
        ↓
Load design context
        ↓
Check curriculum / allocation / elective readiness
        ↓
Design or generate timetable
        ↓
Create TimetableVersion
        ↓
Review exact version
        ↓
Submit for HOD approval
        ↓
PENDING_HOD_APPROVAL
```

### HOD workflow

```text
Open submitted TimetableVersion
        ↓
Review exact context + version
        ├── Reject → REJECTED
        │             ↓
        │        new revision/version
        │
        └── Approve → APPROVED
                        ↓
                      Publish
                        ↓
                    PUBLISHED
```

### Version semantics

The normal governance path is:

```text
GENERATED → PENDING_HOD_APPROVAL → APPROVED → PUBLISHED
                         │
                         └────────────→ REJECTED
```

Rejected versions remain historical. Revision should use a new editable version according to the current backend contract.

Public/default timetable access is published-only.

---

## 07 Functional requirements

### FR-01 Authentication and RBAC

Protected workflows require authenticated users. Server-side RBAC must enforce permissions even when the UI hides unavailable actions.

### FR-02 Academic Context selection

The UI must resolve Academic Contexts from backend data. Do not hardcode III-A or assume a fixed section.

### FR-03 HOD allocation

The HOD allocation screen must display server-provided course policy, faculty eligibility, and current assignments. The client may validate obvious form input for usability but the server remains authoritative.

### FR-04 TC design context

The TC timetable workspace must load the exact context and show:

- applicable courses
- allocation state
- required periods
- elective selection state
- HOD-approved faculty assignments
- readiness state
- current version information when available

### FR-05 Timetable generation

Generation must use validated backend data and create a version scoped to the selected Academic Context.

### FR-06 Review

The TC review UI must render the exact `timetableVersionId` that was generated. It must not silently switch to another version or another context.

### FR-07 Submission

The TC can submit only a valid generated version according to the backend submission rules. The UI must show actionable structured errors such as stale HOD allocation, validation failure, context mismatch, or frozen version.

### FR-08 HOD approval/rejection/publication

The HOD UI must expose actions according to backend status and role. Invalid state transitions must be rejected server-side.

### FR-09 Public timetable

The default/public class timetable must only display published data.

### FR-10 Faculty timetable

Faculty views must include every applicable assigned session, including sessions where the faculty is one of several assigned faculty members.

---

## 08 Non-functional requirements

### Context isolation

A user viewing Context A must never receive timetable/session data belonging to Context B through an API or UI state leak.

### Responsive behavior

The product must remain usable at the supported mobile, tablet, and desktop breakpoints defined in `DESIGN_SYSTEM.md`.

### Accessibility

Keyboard operation, visible focus, semantic labels, readable contrast, and accessible error/status communication are required for core workflows.

### Performance

Avoid unnecessary repeated API calls, N+1 frontend fetch patterns, unbounded timetable loads, and redundant solver/generation requests.

### Maintainability

Use existing routes, services, components, hooks, and helpers before adding duplicates.

---

## 09 Out of scope

Do not introduce as part of ordinary feature work:

- TypeScript migration
- Vite or Angular migration
- a replacement timetable engine
- a new backend framework
- a new database model without a documented domain need
- generic multi-tenant architecture
- unrelated mobile application work
- payment/billing functionality
- destructive production data resets

---

## 10 Success criteria

| Criterion | Done when |
|---|---|
| Whole-CSE support | Multiple valid Academic Contexts work through the same data-driven flow |
| HOD allocation | Required rules are enforced by the server and correctly represented in UI |
| LAB semantics | 2–3 faculty assignments remain one class session |
| SAS | MATHS_BME + ENGLISH roles remain correct through generation, approval, and publication |
| Electives | Only selected active elective courses enter timetable generation |
| TC workflow | Design → generate → review → submit works for an exact context/version |
| HOD workflow | Review → approve/reject → publish obeys role and status permissions |
| Public visibility | Only PUBLISHED versions appear through default/public timetable APIs |
| Context isolation | No cross-context timetable leakage |
| Responsive UI | Core pages are usable at all documented breakpoints |
| Testing | Actual affected tests and browser/integration checks are executed and reported |
| Completion claims | No PASS/Done claim is made from source inspection alone |

---

## 11 Definition of done

A product feature is done only when:

```text
[ ] Product requirement implemented
[ ] Correct user role owns the action
[ ] Backend remains authoritative
[ ] UI uses documented API contracts
[ ] Academic Context/version isolation verified
[ ] Responsive states verified
[ ] Loading / empty / error / success states handled
[ ] Relevant automated tests executed
[ ] Browser validation executed when UI behavior changed
[ ] No critical regression introduced
[ ] Documentation updated when the contract or structure changes
[ ] Exact evidence reported
```
