# CLAUDE.md

## Project

**NEC Faculty Timetable & Workload Management System**  
Institution: Nandha Engineering College (Autonomous), Erode

This repository contains:
- an existing React Native / Expo mobile application used as a **reference/archive**
- a Node.js + Express.js + MongoDB + Mongoose backend
- a newer React web application under `web/`

### Final Product Target

**The final product is WEB APPLICATION ONLY.**

The React Native / Expo application is **not** a current product-development target. Use it only as:
- UI/UX reference
- workflow reference
- feature/reference documentation
- source of existing business-flow ideas when useful

Do **not** spend implementation effort expanding the mobile application unless explicitly requested.

---

## Core Technology Rules

### Web
- React
- JavaScript only
- React Router
- CSS
- Webpack / Babel as already established in the `web/` project

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT authentication
- Role-based access control (RBAC)

### Mandatory conventions

- Use **JavaScript only**.
- Do **not** introduce TypeScript.
- Do **not** create `.ts` or `.tsx` files.
- Do **not** migrate the project to Vite.
- Do **not** replace the existing Webpack/Babel setup without explicit approval.
- Prefer small, maintainable modules over large monolithic files.
- Reuse existing components, services, tokens, and API helpers before creating duplicates.
- Preserve the existing backend API contracts unless a contract change is explicitly required and approved.

---

## Repository Structure

Important top-level areas:

```text
backend/
  src/
    models/
    controllers/
    middleware/
    services/
    validators/
    routes/
    seeds/

web/
  public/
  src/
    components/
    context/
    layouts/
    pages/
    routes/
    services/
    styles/
  tests/

docs/
```

The repository also contains the legacy Expo/React Native mobile application. Treat it as reference material unless explicitly asked to modify it.

---

## Existing Backend Responsibilities

The backend is the authoritative source for:
- authentication
- authorization
- workload calculation
- timetable validation
- timetable conflict detection
- allocation rules
- persistent institutional data
- API-level business rules

Known route groups include:

```text
/api/health
/api/auth
/api/faculty
/api/workload
/api/courses
/api/course-faculty-handlers
/api/academic-contexts
/api/class-advisors
/api/hod-allocations
/api/timetable
/api/notifications
/api/availability
/api/absences
/api/substitutes
```

Important authentication endpoints include:

```text
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/me
```

Frontend authentication uses JWT Bearer authentication.

**Do not duplicate authoritative backend business rules in React merely for convenience.**  
Frontend logic may control presentation and interaction, but the backend remains the source of truth.

---

## Roles

Known application roles:

```text
FACULTY
AC
HOD
ADMIN
```

Role behavior must remain aligned with backend authorization.

The frontend should:
- hide navigation/actions that are not relevant to the current role
- protect routes
- handle unauthorized access explicitly
- never treat frontend route protection as a replacement for backend authorization

An authenticated user with an invalid/unauthorized role for a route should not be treated as an unauthenticated user.

---

## Web Frontend Architecture

The web application is being built as a desktop-first institutional web application.

Current foundational areas include:
- shared UI components
- layouts
- sidebar
- topbar
- page container
- breadcrumbs
- API service layer
- authentication context
- protected routes
- role-aware route groups
- login page

The current web branch already contains Phase 1 foundation work and Phase 2 authentication/protected-route work.

Do not recreate these from scratch. Audit and extend them.

---

## Authentication Rules

The web authentication flow should:

1. collect login credentials
2. call the backend login endpoint
3. receive the authenticated session/token
4. persist the necessary session information
5. restore the session through `/api/auth/me` when appropriate
6. expose the authenticated user through `AuthContext`
7. protect role-specific routes
8. clear the session on logout

Before changing authentication behavior, inspect the real backend response shape.

Do not assume an API response structure when the backend implementation can be inspected.

---

## Current Authentication Implementation to Audit

Known files include:

```text
web/src/context/AuthContext.js
web/src/services/authService.js
web/src/routes/ProtectedRoute.js
web/src/routes/AppRoutes.js
web/src/pages/auth/LoginPage.js
web/src/components/layout/Topbar.js
web/tests/auth.test.js
```

Particular audit points:
- backend login response compatibility
- JWT storage and API token injection
- `/auth/me` session restoration
- logout cleanup
- role matching
- unauthorized-role behavior
- loading state during session restoration
- session-expired handling
- ADMIN default routing
- error handling
- live API authentication tests
- production build compatibility

Known implementation concern from the current review:
- `ProtectedRoute` previously redirected authenticated-but-unauthorized users to their default dashboard. Prefer an explicit access-denied/forbidden state rather than silently redirecting them, unless the existing product design clearly requires another behavior.

Do not change this assumption blindly. Inspect the current code and choose the smallest evidence-based fix.

---

## Existing Role-Based Web Areas

The intended web application contains role-oriented areas such as:

### Faculty
- Faculty Dashboard
- My Timetable
- Weekly Timetable
- Workload
- Notifications
- Profile

### Coordinator / AC
- Coordinator Dashboard
- Course Selection
- Faculty Assignment
- Conflict Detection
- Validation
- Optimization / timetable workflow

### HOD
- HOD Dashboard
- Academic Context
- Faculty Allocation
- Allocation Review
- Timetable Review
- Approval
- Approval Details
- Class Advisor
- Faculty Input
- Notifications
- Profile

Use the existing docs and existing mobile/reference screens as the source for detailed workflows.

Do not invent institutional rules when the repository already documents them.

---

## Design System

The existing reference design uses a dark institutional navy / blue visual language.

Known reference tokens include:

```text
Primary Navy:        #001428
Primary Container:   #0f2942
Secondary Blue:      #0051d5
Accent Blue:         #2563eb

Lab / Tertiary:
#002e1d
#68dba9
#85f8c4

Canvas:
#f8f9ff

Surfaces:
#e5eeff
#eff4ff
#ffffff
```

Reference typography includes:
- Inter
- Outfit
- JetBrains Mono

The web implementation should reuse the existing design tokens and components rather than introducing unrelated visual systems.

---

## Timetable Model

Known timetable structure:
- Monday to Friday
- Periods P1 to P7
- 35 regular weekly slots
- breaks between periods

Known lifecycle:

```text
NO_TIMETABLE
    ↓
GENERATED / DRAFT
    ↓
PENDING_HOD_APPROVAL
    ↓
APPROVED / REJECTED
    ↓
PUBLISHED
```

Do not bypass or redefine this lifecycle in frontend code.

---

## Workload Rules

Workload calculation is backend-authoritative.

Known allocation rule categories include:
- `SINGLE_FACULTY`
- `PRIMARY_PLUS_ADDITIONAL`
- `MINIMUM_TWO`
- `STAFFS_HANDLED`

Special handling exists for institutional course patterns such as labs and other multi-faculty allocations.

Do not reproduce workload formulas independently in frontend pages. Display backend-calculated values and use frontend-only calculations only for presentation-level needs.

---

## UI / UX Principles

Build a professional institutional desktop web application.

Priorities:
1. correctness
2. clarity
3. consistency
4. accessibility
5. maintainability
6. visual polish

Prefer:
- reusable components
- consistent spacing
- clear hierarchy
- responsive desktop layouts
- useful empty/loading/error states
- readable tables
- clear status badges
- sensible confirmation dialogs for destructive actions

Avoid:
- unnecessary animations
- duplicated components
- giant page files
- hard-coded business rules
- fake production data when an API already exists
- placeholder UI that is presented as complete functionality

---

## Data / API Rules

Before creating a new frontend API call:

1. search the backend routes/controllers
2. confirm the endpoint and HTTP method
3. confirm request body/query/params
4. confirm response structure
5. confirm authorization requirements
6. implement the smallest compatible client call

Use the existing API service layer where possible.

Do not silently change backend contracts from the frontend.

---

## Testing Rules

Before declaring a phase complete, run the relevant checks.

At minimum:

```bash
npm install
npm run build
```

Run the available backend/frontend tests relevant to the changed area.

For authentication work, inspect/run:

```text
web/tests/auth.test.js
```

Do not claim tests passed unless they were actually executed and the result is known.

If a test cannot run because a dependency/service is unavailable, report the exact blocker.

---

## Development Workflow

Before making changes:

```bash
git status
git branch --show-current
git log --oneline -5
git remote -v
```

Then inspect the relevant files.

Never assume a feature is missing until:
- the branch is verified
- Git history is checked
- the existing source is inspected

Avoid destructive operations such as:
- reset --hard
- force push
- deleting branches
- deleting working files
- rewriting another developer's work

unless explicitly approved.

---

## Current Web Branch Context

The current working branch is expected to be:

```text
feature/web-frontend-rohith
```

It was created from the existing remote web implementation.

The remote web work includes these commits:

```text
1eebed1  feat(web): add Phase 1 web application foundation
32070c0  feat(web): add authentication context, protected routes, and updated layouts
```

Do not recreate or discard this work.

Before changing it, audit the current state.

---

## Phase / Ownership Rules

### Rohith
Primary owner:
- React web frontend
- web architecture
- shared UI
- layouts/navigation
- authentication frontend integration
- role-aware frontend behavior
- frontend API integration
- final frontend integration
- frontend validation/testing

### Ragul
Primary owner:
- backend
- Express APIs
- MongoDB/Mongoose
- controllers/services/routes
- backend auth/JWT/RBAC
- backend business logic
- backend tests

Do not modify another person's owned area unless:
- the change is required for integration, and
- the reason is documented, and
- the change is coordinated/approved.

---

## Phase Plan

The current overall web migration follows:

```text
Phase 1 — Web Foundation
Phase 2 — Authentication & RBAC
Phase 3 — Faculty Web Portal
Phase 4 — Coordinator Portal
Phase 5 — HOD Portal
Phase 6 — Integration Testing
Phase 7 — Final UI/UX Validation
```

Complete each phase with:
1. implementation
2. validation
3. build/tests
4. review of changed files
5. user approval
6. Git commit
7. Git push
8. remote verification

### Git approval rule

**Never commit/push a completed phase without user approval.**

Never claim that a phase was pushed unless the push was actually performed and verified.

---

## Documentation Rules

Use `docs/` as the primary source for project-specific workflows and institutional requirements.

Existing documentation includes architecture, AC/timetable workflows, faculty workload workflows, HOD implementation, screen maps, and audits.

Read the relevant document before implementing a workflow.

Do not silently replace repository-specific terminology with generic product terminology.

---

## How Claude Should Work

For every substantial task:

### Step 1 — Inspect
- git state
- relevant source files
- relevant backend endpoints
- relevant docs

### Step 2 — Report
State:
- what already exists
- what is missing
- what needs modification
- any risks or contract mismatches

### Step 3 — Implement
Make the smallest coherent set of changes.

### Step 4 — Validate
Run:
- build
- relevant tests
- lint/type/static checks if they already exist

### Step 5 — Review
Check:
- changed files
- API compatibility
- role behavior
- UI consistency
- error states
- regressions

### Step 6 — Handoff
Report:
- files changed
- what was implemented
- tests/build results
- remaining issues
- whether commit/push was intentionally left pending approval

---

## ACTIVE TASK

The current active frontend implementation task is:

docs/ (NEC Timetable Web App Architecture & Specifications)

When working on the web frontend, read and execute this task file.

Do not infer a different frontend task from repository history.

Do not stop at an audit when the active task explicitly requires implementation.

The active task file defines the current frontend recovery scope and Definition of Done.

## Important Guardrails

- Do not clone the repository again when working in the existing checkout.
- Do not create a second replacement web application.
- Do not migrate to TypeScript.
- Do not migrate to Vite.
- Do not develop the mobile application as the final product.
- Do not duplicate backend business logic in React.
- Do not invent APIs.
- Do not claim an endpoint works without checking it.
- Do not claim tests passed without running them.
- Do not overwrite existing developer work merely to simplify the implementation.
- Prefer evidence from the repository over assumptions.

---

## Immediate Next Step

Before starting the next feature phase, Claude should audit the existing Phase 1 and Phase 2 web implementation, especially authentication, route protection, API integration, and build/test health.

Only after the audit is complete should feature work continue.
