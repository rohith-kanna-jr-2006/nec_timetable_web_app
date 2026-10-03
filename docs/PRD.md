# PRD: NEC Timetable Web Application — Frontend

> Revision: 2026-10-03
>
> This document defines frontend product scope, users, supported workflow states, and the definition of done. It is intentionally product-focused; implementation details belong in `docs/ARCHITECTURE.md`, visual rules belong in `docs/DESIGN_SYSTEM.md`, and agent operating rules belong in `AGENTS.md`.

## 01 Product overview

| Field | Value |
| --- | --- |
| Product name | NEC Timetable Web Application |
| Frontend owner | Rohith — Frontend / UI / UX / Web Integration |
| Primary platform | Web application |
| Frontend stack | React + JavaScript + existing Webpack setup |
| Backend integration | Node.js / Express REST APIs |
| Database | MongoDB through the backend only |
| Product scope | CSE department timetable, faculty allocation, timetable generation/design, review, approval, publication and timetable viewing |
| Stage | Active implementation / integration |

### Description

NEC Timetable Web Application is a role-based web application for the CSE department timetable workflow. The frontend serves HOD, Time Table Coordinator (TC), and Faculty users through the existing role-based portals and consumes authoritative backend APIs for academic context, curriculum, faculty allocation, timetable generation, review, approval, publication, and timetable views.

The product is **department-wide and multi-cohort**. The frontend must work for any valid Year + Semester/Academic Term + Section/Cohort returned by the backend. A timetable that has not yet been generated is a valid workflow state, not proof that academic data is missing.

## 02 Problem

Timetable work depends on coordinated decisions about academic context, curriculum, faculty assignment, timetable generation, review, approval, and publication. The frontend must make these states understandable and actionable without inventing business data or turning a valid workflow state into a generic empty-data screen.

The Coordinator must work from the HOD-approved faculty allocation and submit generated timetable versions to the HOD. The HOD must be able to review, approve, reject with remarks, and publish according to backend authority.

## 03 Goal

Provide a reliable, responsive CSE timetable frontend where each role can perform only the workflow allowed to that role, where selected academic context/version data remains isolated, and where the UI always reflects authoritative backend state.

## 04 Target users

### Primary users

**HOD**
- Selects Academic Context.
- Makes or reviews authoritative Course → Faculty decisions.
- Assigns Class Advisor.
- Reviews timetable versions.
- Approves, rejects with remarks, and publishes according to backend authority.
- Needs clear unresolved states such as `REQUIRES HOD DECISION`.

**Time Table Coordinator (TC)**
- Uses HOD-approved faculty allocation as the timetable-design basis.
- Selects Year / Semester / Section or Class.
- Designs/generates timetables through existing backend APIs.
- Reviews generated timetable versions.
- Submits a generated timetable to HOD for review.
- Must not override HOD faculty-allocation authority through the frontend.

> The backend may retain its existing internal `AC` role identifier. The user-facing frontend terminology is `Time Table Coordinator` / `TC`.

**Faculty**
- Views the relevant class timetable.
- Views their own Faculty Timetable.
- Uses faculty-specific availability, absence, notification, and related existing features.

### Not for

- Direct database administration.
- Direct MongoDB access from the browser.
- Client-side timetable solving or optimization.
- Replacing backend business rules with browser-only logic.
- Building a native/mobile product in this frontend codebase.

## 05 Core features

| # | Feature | What the user can do | Done when |
| --- | --- | --- | --- |
| 1 | Authentication & RBAC | Sign in and enter the portal permitted for the user's role | Protected routes, role boundaries and authenticated API behavior are consistent |
| 2 | Academic Context selection | Select a supported Year, Semester/Academic Term, Section/Cohort | Correct context-dependent data loads without cross-context leakage |
| 3 | HOD Faculty Allocation | Review/edit Course → Faculty allocation where HOD authority permits | Theory remains one faculty; LAB and MC show correct rule-driven controls and states |
| 4 | Class Advisor | View/manage the HOD-controlled Class Advisor flow | Existing backend contract is surfaced accurately |
| 5 | Coordinator timetable design | Load applicable courses/faculty and generate/design timetable through backend | No manual day/period solver logic is implemented in the UI |
| 6 | Timetable Review Matrix | Review the selected Academic Context + Timetable Version | Review does not mix data from another context/version |
| 7 | Handover / Approval / Publication | TC submits generated timetable; HOD reviews, approves or rejects, then publishes when allowed | Version lifecycle is represented and acted on according to backend state |
| 8 | Faculty timetable views | View Class Timetable and Faculty Timetable | Multi-faculty sessions render correctly without duplicate class sessions |
| 9 | Responsive UI | Use critical product flows on desktop, tablet and mobile widths | Critical screens pass required responsive interaction validation |
| 10 | Actionable workflow states | Understand missing data vs incomplete allocation vs not-yet-generated vs approval states | No valid context ends in a misleading generic `No data found` dead-end |

### Workflow states

The frontend must accurately represent backend-provided states as applicable, including:

```text
CONTEXT_NOT_FOUND
CURRICULUM_UNAVAILABLE
ALLOCATION_INCOMPLETE
READY_FOR_GENERATION
TIMETABLE_NOT_GENERATED
GENERATED
PENDING_HOD_APPROVAL
APPROVED
REJECTED
PUBLISHED
```

The frontend must not invent additional business states.

### Key role flows

**HOD flow**

```text
Login
  ↓
HOD Portal
  ↓
Select Academic Context
  ↓
Review / manage authoritative Faculty Allocation
  ↓
Review generated Timetable Version
  ↓
Approve
   OR
Reject + Remarks
  ↓
Publish when APPROVED and backend-authorized
```

**Time Table Coordinator flow**

```text
Login
  ↓
Time Table Coordinator Portal
  ↓
Select Year / Semester / Section / Class
  ↓
Load HOD-approved allocation
  ↓
Design / Generate Timetable
  ↓
Review generated version
  ↓
Send to HOD
```

## 06 Success metrics

These are product acceptance targets rather than business KPIs.

| Metric | Target | Measured by |
| --- | --- | --- |
| Supported-context navigation | 100% of tested valid backend-supported contexts resolve to a meaningful UI state | Browser/API integration validation |
| Critical workflow completion | 100% of acceptance journeys that have valid test data reach the intended next workflow stage without a UI dead-end | Playwright MCP / E2E |
| Invalid business input handling | 100% of tested invalid LAB/MC allocation cases show actionable validation | Frontend tests + browser validation |
| Responsive critical screens | 100% of mandatory target viewports pass required visual/interaction checks | Playwright MCP |
| Build | Production build passes | Actual project build command |

## 07 Out of scope

Do not build these as frontend responsibilities:

- MongoDB access or database logic in React.
- A new timetable-generation engine in the browser.
- A new optimization algorithm.
- A new authentication architecture.
- TypeScript migration.
- Vite migration.
- Angular migration.
- A second Faculty Allocation page.
- Hardcoded faculty/course fallback logic.
- Replacing HOD authority with workload-master/historical/random/first-faculty selection.
- A mobile/native application in this web project.
- A visual redesign that replaces the established product shell without a product-level decision.
- Synthetic duplicate class timetable sessions created only because a LAB has multiple assigned faculty.

## 08 Open questions

The agent must not invent answers where the backend contract is not established.

- Exact backend endpoint/response shape for any new field that does not yet exist must be verified from the backend before implementation.
- Final workload-credit semantics for multi-faculty LAB/MC sessions are backend/business-rule decisions, not frontend assumptions.
- Any new allocation policy beyond the currently specified LAB and MC rules must be confirmed before adding UI behavior.
- If a requested workflow conflicts with an authoritative backend lifecycle rule, inspect the backend contract before changing frontend assumptions.
