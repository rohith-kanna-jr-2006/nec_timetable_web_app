# FRONTEND FULL AUDIT AND RECTIFICATION REPORT

**Repository:** rohith-kanna-jr-2006/nec_timetable_web_app
**Audited branch:** `ragul-backend`
**Audited HEAD:** `bb8eb54b501b2d46d6853f42eea634e97edc62e6`
**Report type:** READ-ONLY AUDIT — **no frontend or backend implementation change was made**
**Stack verified:** React 18 + Webpack 5 (frontend), Node.js + Express + CommonJS + MongoDB + Mongoose (backend), JavaScript only

---

## 0. AUDIT SCOPE, BASELINE AND METHOD

### 0.1 Phase 0 baseline (recorded before any inspection)

| Item | Value |
|---|---|
| Branch | `ragul-backend` |
| HEAD | `bb8eb54b501b2d46d6853f42eea634e97edc62e6` |
| HEAD subject | `fix(backend): correct seed session classification and faculty validation` |
| Working tree before audit | **CLEAN** (no modified, no untracked) |
| Working tree after audit | **CLEAN** (identical — no changes made) |

### 0.2 What was actually inspected (facts, not assumptions)

| Area | Count | Method |
|---|---|---|
| Frontend pages (`web/src/pages/**`) | 37 files | Full read + browser walkthrough |
| Frontend components (`web/src/components/**`) | 25 files | Full read |
| Frontend services (`web/src/services/**`) | 14 files | Full read + endpoint extraction |
| Frontend JS total (`web/src/**`) | 91 files | Automated pattern scan + targeted read |
| Backend source files (`backend/src/**`) | 110 files | Route/controller/service/model inspection |
| Backend API contracts audited | 40+ endpoints | Route table vs. live HTTP probe |
| Documentation sets | 4 backend sets + root + 15 root docs | Full read |
| Live API endpoints exercised | 21 | Real HTTP requests against running backend |

### 0.3 Live verification method

The audit executed a **real** running stack, not static inference:

- Backend started on `http://127.0.0.1:5000` (MongoDB `127.0.0.1/nec_faculty_db`).
- Frontend started via `npm run dev` on `http://127.0.0.1:3002` (webpack-dev-server, `/api` → `localhost:5000` proxy confirmed in `web/webpack.config.js:81-87`).
- Playwright browser audit at 1280×720 and 390×844.
- Real logins performed for `HOD`, `TC`, `AC`, `FACULTY`, `ADMIN` (all returned HTTP 200 with a role).

Every issue marked **CONFIRMED (browser)** or **CONFIRMED (API)** below was reproduced
against that running stack. Issues marked *static* were derived from source reading only.

### 0.4 Stack compliance — PASS

| Rule | Result |
|---|---|
| No `.ts` / `.tsx` / `.vue` files | **PASS** — zero found in `web/` or `backend/` |
| No `"type": "module"` added | **PASS** — absent from all three `package.json` |
| No Vite / Angular | **PASS** — webpack 5.111.1 confirmed running |
| React + Webpack preserved | **PASS** — `web/package.json:7` `webpack serve`, `:19` webpack 5 |
| CommonJS backend preserved | **PASS** — all `backend/src/**` uses `require`/`module.exports` |
| Backend business logic unchanged | **PASS** — audit was read-only |
| Solver logic unchanged | **PASS** — audit was read-only |

### 0.5 Severity definitions used in this report

| Level | Meaning |
|---|---|
| **P0** | Security, cross-context data leak, wrong timetable output, or a total workflow block |
| **P1** | Major user workflow broken or materially incorrect |
| **P2** | Important UX / integration / accessibility defect |
| **P3** | Polish, terminology, or minor correctness issue |

---

## 1. PHASE 1 — DOCUMENTATION vs IMPLEMENTATION (DRIFT REGISTER)

The backend documentation set is high quality and largely matches the backend code.
The **frontend** documentation set is the drift problem.

### 1.1 Documentation drift findings

| ID | Drift | Evidence | Impact |
|---|---|---|---|
| DOC-01 | **`docs/frontend/AGENTS.md` referenced by root `AGENTS.md:9` and `docs/backend/AGENTS.md:9` DOES NOT EXIST** | `docs/frontend/` contains only `docs/frontend/ai/{AGENTS,ARCHITECTURE,DESIGN_SYSTEM,PRD}.md`. A frontend agent directed to read `docs/frontend/AGENTS.md` will fail. | Frontend agents start without operating rules |
| DOC-02 | **`docs/frontend/ai/*` are stale duplicates of `docs/*`** | `docs/frontend/ai/ARCHITECTURE.md` is byte-identical in size (13497) to `docs/ARCHITECTURE.md`; same for `DESIGN_SYSTEM.md` (10232) and `PRD.md` (8627) | Two divergent copies of frontend truth |
| DOC-03 | Design system mandates "TimeTable Coordinator" UI label | `docs/backend/DESIGN_SYSTEM.md:461` and `docs/backend/PRD.md:79` | Frontend ships "Coordinator" only; TC has no portal at all (see FE-P0-001) |
| DOC-04 | `docs/backend/DESIGN_SYSTEM.md:487` forbids "create one class row per faculty for a multi-faculty session" | Requirement is correct and enforced by backend | Frontend violates the *visibility* half — see FE-P0-003 |
| DOC-05 | Backend API contract doc `backend/API.md` is referenced by `docs/backend/AGENTS.md:43` as required reading | `backend/API.md` **does not exist** in the repo | No authoritative frontend-facing API contract document |
| DOC-06 | PRD requires `academicYearFrom`/`academicYearTo` context scoping (`docs/backend/PRD.md` §Context isolation) | Contexts carry these fields | `web/src/components/layout/Topbar.js:48` hardcodes `2024-25` while live contexts are `2026-2027` (FE-P1-004) |

**Backend documentation vs backend implementation: consistent.** Every backend route,
role guard, error code, and service behaviour inspected in this audit matched what
`docs/backend/*` describes. The backend is genuinely authoritative and correctly implemented
for the areas this audit touched. **No backend change is recommended anywhere in this report.**

---
## 2. PHASE 2/3 — BACKEND AUTHORITY SUMMARY

The backend is authoritative and correct. It already implements the governance model the
frontend is supposed to present. Verified live:

| Backend rule | Verified behaviour | Evidence |
|---|---|---|
| RBAC on every entry point | `FACULTY` → 403 on `POST /timetable/generate-from-context` and `PATCH /timetable/version/:id/status` | Live HTTP probe |
| `TC` is the design authority | `requireRole('TC','AC','ADMIN')` on `/timetable/generate*`, `/solve`, `/version` POST, `/session` | `routes/timetableRoutes.js:44-115` |
| `HOD` exclusive from design | Generation routes exclude `HOD` | `timetableRoutes.js:70-72` |
| Context isolation server-side | `query.academicContextId` applied **in the database**, never post-filtered | `timetableController.js:176-186` |
| Version/context ownership | `TIMETABLE_VERSION_CONTEXT_MISMATCH` (409) for cross-context versions | `timetableController.js:441-451` |
| Course period requirement never invented | returns `source:'MISSING'` / `requiredPeriods:0`; the old `isLab ? 4 : 3` fallback was deliberately removed | `services/courseRequirementService.js:1-66` |
| Substitute eligibility server-side | `GET /substitutes/eligible-faculty` + cross-context 409 guard | `substituteController.js:150-176` |
| HOD allocation rules | `THEORY_SINGLE`, `LAB_2_TO_3`, `MC_SAS`, `MC_DEPARTMENT`, `MC_OPTIONAL_MAPPING` | `HODFacultyAllocation.js` |
| Multi-faculty preserved as ONE session | Session carries `facultyAssignments[]` (verified 2 on `22MAN8R`) | Live API response |
| Seed data integrity | Course 119 / R22 UG 109 / Faculty 52 / Workload 27 | Live DB probe |

**Authority conclusion:** the backend requires no change. Every defect in this report is a
frontend presentation/integration defect. This report never recommends weakening a backend rule.

---
## 3. PHASE 19 — BACKEND → FRONTEND CONTRACT MAP

Legend: OK = correct | DEF = defective | UNUSED = backend capability the frontend never calls

| # | Backend Capability | Endpoint / Contract | Frontend Consumer | Status | Required Action |
|---|---|---|---|---|---|
| 1 | Login | `POST /api/auth/login` | `authService.js:60` | OK | none |
| 2 | Current user | `GET /api/auth/me` | `authService.js:92` | OK | none |
| 3 | Academic Context list | `GET /api/academic-contexts` | `academicContextService.js:12` | OK | none |
| 4 | **Design Context** | `GET /timetable/design-context/:id` → `curriculumSemester, readiness, electiveSelection, currentVersion, courses` | **none** | UNUSED | **Consume (FE-P1-007)** |
| 5 | **Context status** | `GET /timetable/context-status/:id` → `state, nextAction, message, allocation, timetable` | **none** | UNUSED | **Consume (FE-P1-008)** |
| 6 | HOD allocation read | `GET /hod-allocations/context/:id` | `hodAllocationService.js:63` | OK | none |
| 7 | HOD allocation save | `PUT /hod-allocations/context/:id/course/:courseCode` | `hodAllocationService.js:72` | OK | none |
| 8 | **Elective candidates** | `GET /hod-allocations/elective-candidates` → `slots, candidates` | **none** (hardcoded map used) | UNUSED | **Consume (FE-P2-011)** |
| 9 | **Elective selection** | `GET /hod-allocations/elective-selection` → `isComplete, selectedCount` | **none** | UNUSED | **Consume (FE-P2-011)** |
| 10 | **Cohort validation** | `GET /hod-allocations/validate/:id` → `readyForGeneration, allocatedCount` | **none** | UNUSED | **Consume (FE-P1-009)** |
| 11 | **Generation (authoritative)** | `POST /timetable/generate-from-context` (TC-only, rate-limited) | **none** — legacy `/solve` used instead | UNUSED | **Migrate (FE-P1-006)** |
| 12 | Legacy generation | `POST /timetable/solve` | `timetableService.js:47` | DEF | bypass path |
| 13 | **Review matrix** | `GET /timetable/review-matrix` → `status, summary, sessions[]` | **none** | UNUSED | **Consume (FE-P2-012)** |
| 14 | Class timetable | `GET /timetable/class/:id?versionId=` | `timetableService.js:27` | DEF | drops `facultyAssignments` (FE-P0-003) |
| 15 | **Published timetable** | `GET /timetable/published/:id` → `isPublished, sessions` | **none** | UNUSED | **Use for public view (FE-P1-010)** |
| 16 | Faculty timetable | `GET /timetable/faculty/:id?versionId=` | `timetableService.js:16` | DEF | drops `facultyAssignments` (FE-P0-003) |
| 17 | Version list | `GET /timetable/versions?academicContextId=` | `TimetableApprovalPage.js:27` | DEF | **scope omitted → cross-context leak (FE-P0-002)** |
| 18 | Status transition | `PATCH /timetable/version/:id/status` | `hodAllocationService.js:127` | DEF | fed by unscoped list |
| 19 | Submission | same, `status:'PENDING_HOD_APPROVAL'` | `coordinatorService.js:89` | DEF | no TC UI entry (FE-P1-014) |
| 20 | **Affected sessions** | `GET /substitutes/affected-sessions` | **none** | UNUSED | **Consume (FE-P0-004)** |
| 21 | **Eligible faculty** | `GET /substitutes/eligible-faculty?timetableSessionId=` | **none** — uses `getFacultyList()` | UNUSED | **Consume (FE-P0-004)** |
| 22 | Substitute assign | `POST /substitutes` | `substituteService.js:31` | DEF | no eligible list (FE-P0-004) |
| 23 | Substitute status | `PATCH /substitutes/:id/status` | `substituteService.js:40` | OK | none |
| 24 | Absence report/status | `POST /absences`, `PATCH /absences/:id/status` | `absenceService.js` | OK | none |
| 25 | Class advisor CRUD | `GET/POST /class-advisors`, `PATCH /:id/deactivate` | `hodAllocationService.js` | OK | none |
| 26 | R22 curriculum overview | `GET /courses/curriculum/r22` → `electiveSlotMap, pecVerticals` | `courseService.js:35` | DEF | exists; page hardcodes a copy (FE-P2-011) |
| 27 | Faculty list/detail | `GET /faculty`, `GET /faculty/:id` | `facultyService.js` | OK | none |
| 28 | Workload list/summary | `GET /workload`, `/summary`, `/discrepancies`, `/incomplete` | `workloadService.js` | OK | none |
| 29 | Notifications | `GET/POST/PATCH /notifications` | `notificationService.js` | OK | none |
| 30 | Availability | `GET/POST/DELETE /availability` | `availabilityService.js` | OK | none |

**Summary: 11 of 30 audited capabilities are unused by the frontend (UNUSED).** The frontend
re-derives in the browser state the backend already computes authoritatively — precisely what
`docs/backend/AGENTS.md:114-127` forbids ("must not become a second authoritative
business-rule engine").

---
## 4. PHASE 6 — PAGE INVENTORY (ALL 37 PAGES)

Status key: **CORRECT** = works and matches contract · **PARTIAL** = works, incomplete ·
**BROKEN** = user-visible defect · **MISSING** = route/UI absent but required by contract.

### 4.1 Authentication & common

| Route | Page | Role | Backend dep | Status | Verdict |
|---|---|---|---|---|---|
| `/login` | `pages/auth/LoginPage.js` | public | `POST /auth/login` | BROKEN | Credentials hardcoded in a "Quick Account Credentials" panel (`LoginPage.js:19,73-105`) including a prefilled password; quick-select offers only Faculty/Coord/HOD, **omitting the real `TC` account**. |
| `/access-denied`, `/403` | `pages/common/AccessDenied.js` | any | — | CORRECT | Clear 403 state, explains role, offers recovery. Good. |
| `*` (catch-all) | `AppRoutes.js:147` | — | — | PARTIAL | Unmatched routes silently redirect to `/login`, masking dead links (causes FE-P1-002/003). |
| — | `pages/common/RoutePlaceholder.js` | — | — | MISSING | Exists but imported nowhere → dead code. |

### 4.2 Coordinator (TC) portal — `/coordinator/*`, guard `['AC','ADMIN']`

| Route | Page | Status | Verdict |
|---|---|---|---|
| `/coordinator/dashboard` | `CoordinatorDashboard.js` | BROKEN | Unreachable by `TC` users (FE-P0-001). |
| `/coordinator/design` | `OptimizationSolverPage.js` (36.8 KB) | BROKEN | Unreachable by `TC`; uses legacy `/timetable/solve`; invents `requiredPeriods` (FE-P1-006). |
| `/coordinator/view` | `TimetableReviewPage.js portalType="Coordinator"` | BROKEN | Unreachable by `TC`; no Submit-for-approval action (FE-P1-014). |
| `/coordinator/faculty-assignment` | `FacultyAssignmentPage.js` | BROKEN | Unreachable by `TC`; uses `course-faculty-handlers` (candidate pools) not HOD-approved allocations. |
| `/coordinator/course-selection` | `CourseSelectionPage.js` | BROKEN | Unreachable by `TC`. |
| `/coordinator/free-mapping` | `FreeTimetableMappingPage.js` | BROKEN | Unreachable by `TC`; bypasses eligibility engine (FE-P0-004). |
| `/coordinator/conflict` | `ConflictDetectionPage.js` | PARTIAL | Reachable only by legacy `AC`. |
| `/coordinator/validation` | `ValidationRulesPage.js` | PARTIAL | Reachable only by legacy `AC`. |
| `/coordinator/context` | `AcademicContextPage.js portalType="Coordinator"` | PARTIAL | Reachable only by legacy `AC`. |
| `/coordinator/optimization` | redirect → `/coordinator/design` | CORRECT | Alias handled correctly. |
| `/coordinator/notifications` | `CoordinatorNotificationsPage.js` | PARTIAL | Reachable only by legacy `AC`. |
| — | `CoordinatorDashboardPlaceholder.js` | MISSING | Imported nowhere → dead code. |

### 4.3 HOD portal — `/hod/*`, guard `['HOD','ADMIN']`

| Route | Page | Status | Verdict |
|---|---|---|---|
| `/hod/dashboard` | `HODDashboard.js` | CORRECT | Loads, renders, nav works (browser-verified). |
| `/hod/faculty` | `FacultyListPage.js` | CORRECT | — |
| `/hod/faculty/add` | `AddFacultyPage.js` | PARTIAL | Large form; needs protected-field audit (FE-P2-014). |
| `/hod/regulation` | `RegulationPage.js` (54.7 KB) | PARTIAL | Renders a **hardcoded curriculum duplicate** instead of `GET /courses/curriculum/r22` (FE-P2-011). |
| `/hod/class-advisor` | `ClassAdvisorPage.js` | CORRECT | Context-scoped via query param. |
| `/hod/context` | `AcademicContextPage.js portalType="HOD"` | CORRECT | — |
| `/hod/timetable-review` | `TimetableReviewPage.js` | BROKEN | Hides secondary faculty on multi-faculty sessions (FE-P0-003). |
| `/hod/faculty-allocation` | `HODFacultyAllocationPage.js` (47.3 KB) | CORRECT | **Strongest page in the app.** Policy-driven rules, correct LAB/MC_SAS validation, polite client hints. **Preserve.** |
| `/hod/allocation-review` | `AllocationReviewPage.js` | CORRECT | — |
| `/hod/approval` | `TimetableApprovalPage.js` | BROKEN | **Cross-context leak: 107 versions from 3 contexts** (FE-P0-002). |
| `/hod/faculty-input` | `FacultyInputReviewPage.js` | CORRECT | — |
| `/hod/notifications` | `HODNotificationsPage.js` | CORRECT | — |
| `/hod/profile` | `HODProfilePage.js` | CORRECT | — |
| — | `HODDashboardPlaceholder.js` | MISSING | Imported nowhere → dead code. |

### 4.4 Faculty portal — `/faculty/*`, guard `['FACULTY','ADMIN']`

| Route | Page | Status | Verdict |
|---|---|---|---|
| `/faculty/dashboard` | `FacultyDashboard.js` | CORRECT | Loads. Links to `/faculty/weekly-timetable` (dead → FE-P1-002). |
| `/faculty/class-timetable` | `ClassTimetablePage.js` | PARTIAL | Grid correct; primary faculty only (FE-P0-003); `<Select>` lacks accessible label (FE-P2-013). |
| `/faculty/faculty-timetable` | `FacultyTimetablePage.js` | PARTIAL | `facultyId` falls back to literal `'FAC01'` if absent (`:25`) — silent wrong-identity risk. |
| `/faculty/workload` | `FacultyWorkloadPage.js` | CORRECT | — |
| `/faculty/availability` | `FacultyAvailabilityPage.js` | CORRECT | — |
| `/faculty/absence` | `FacultyAbsencePage.js` | CORRECT | Feeds substitute workflow. |
| `/faculty/notifications` | `FacultyNotificationsPage.js` | CORRECT | — |
| `/faculty/profile` | `FacultyProfilePage.js` | CORRECT | — |
| `/faculty/weekly-timetable` | — | MISSING | **Route absent**; sidebar + dashboard link to it (FE-P1-002). |
| `/faculty/my-timetable` | `MyTimetablePage.js` | MISSING | **Route absent**; page exists (18.9 KB) but unreachable (FE-P1-003). |
| — | `WeeklyTimetablePage.js` | MISSING | 26.4 KB fully-written page with **no route** (FE-P1-002). |
| — | `FacultyDashboardPlaceholder.js` | MISSING | Imported nowhere → dead code. |

### 4.5 Flow verification against PRD

| Flow | Expected (PRD) | Actual | Verdict |
|---|---|---|---|
# 5. FRONTEND CHANGES THAT ARE COMPULSORY

> This section contains **only** issues where the frontend genuinely MUST change.
> Every P0 issue below was reproduced against a running backend + frontend.
> Severity is not inflated: only genuine blockers, data-integrity breaks and
> security/correctness defects appear here.

**Count: 4 × P0, 10 × P1, 9 × P2, 3 × P3 — 26 compulsory changes total.**

---

### Issue ID: FE-P0-001
#### Priority
**P0** — total workflow block for an entire product role

#### Page / Route
`/login` → all `/coordinator/*` routes

#### Exact File
- `web/src/services/authService.js` — `getDefaultDashboard()` (lines 15-27)
- `web/src/routes/AppRoutes.js` — line 89 `<ProtectedRoute allowedRoles={['AC','ADMIN']}>`

#### Exact Component / Function
`getDefaultDashboard(role)` and the coordinator route guard

#### Current Behavior
`getDefaultDashboard()` is a `switch` with cases `HOD`, `AC`, `ADMIN`, `FACULTY`/default.
**There is no `case 'TC'`.** A `TC` user falls into `default` → `/faculty/dashboard`.
The coordinator guard allows only `['AC','ADMIN']`, so `TC` is rejected there too.

**Reproduced live (Playwright, 1280×720):**
```
POST /api/auth/login (tc@nec.edu.in)  -> HTTP 200, role = "TC"
redirect result                        -> /faculty/dashboard
body  -> "HTTP 403 - ACCESS RESTRICTED ... with role TC.
          This portal requires authorized credentials for: FACULTY, ADMIN"
nav to /coordinator/design -> "...requires authorized credentials for: AC, ADMIN"
```

#### Backend Contract
- `User.role` enum `['FACULTY','AC','TC','HOD','ADMIN']` — `backend/src/models/User.js:30`
- `seedUsers.js` creates a `role: 'TC'` account (`facultyId: 'FWL-22'`)
- Design authority is `requireRole('TC','AC','ADMIN')` — `routes/timetableRoutes.js:70-72`
- `docs/backend/PRD.md:79-91`: user-facing role name is **TimeTable Coordinator / TC**

#### Why Current Behavior Is Wrong
`TC` is the backend's primary timetable-design role and is explicitly the product's coordinator
in the PRD. The frontend makes that role **completely unusable** — no route, page, or redirect
in the app is reachable by `TC`. The backend already permits every action the UI refuses to
show. Pure frontend defect.

#### Required Frontend Change
1. `authService.js getDefaultDashboard()`: add `case 'TC': return '/coordinator/dashboard';`
2. `AppRoutes.js:89`: `allowedRoles={['AC','ADMIN']}` → `allowedRoles={['TC','AC','ADMIN']}`
   (keep `AC` during the documented AC→TC migration).
3. `Sidebar.js:103` — path ternary must map `TC` → `coordinator`.
4. `LoginPage.js:82-105` quick-select: add a **TC** account button.

#### Expected UI Behavior
Logging in as `TC` lands on the Coordinator dashboard with the full TC sidebar; every
`/coordinator/*` route renders instead of a 403. Label the role **"TimeTable Coordinator"**.

#### Acceptance Criteria
- [ ] `tc@nec.edu.in` login → lands on `/coordinator/dashboard` (NOT `/faculty/dashboard`)
- [ ] No "ACCESS RESTRICTED" screen appears for `TC` on any coordinator route
- [ ] `/coordinator/design`, `/view`, `/free-mapping` all render for `TC`
- [ ] `AC` (legacy) still works — no regression during migration
- [ ] `FACULTY` still cannot reach `/coordinator/*` (403 remains correct)
- [ ] `HOD` still cannot reach `/coordinator/design` (governance preserved)

#### Test Case
```
1. Start backend + frontend.
2. Login as tc@nec.edu.in -> assert URL === '/coordinator/dashboard'.
3. Navigate /coordinator/design -> assert no "ACCESS RESTRICTED".
4. Login as faculty@ -> assert /coordinator/design still 403s.
5. Login as ac@ -> assert coordinator portal still reachable (no regression).
```

#### Dependencies
None. **Implement first** — it unlocks the entire TC workflow; FE-P1-006/007/008/014 are
untestable until it lands.

### Issue ID: FE-P0-002
#### Priority
**P0** — cross-context data leak + incorrect governance decisions

#### Page / Route
`/hod/approval`

#### Exact File
`web/src/pages/hod/TimetableApprovalPage.js` — `loadVersions()` lines 23-36, call at line 27

#### Exact Component / Function
`TimetableApprovalPage()` → `loadVersions()` → `getTimetableVersions()`

#### Current Behavior
```js
const res = await getTimetableVersions();   // line 27 — NO parameters
```
`timetableService.getTimetableVersions(params)` builds `?${new URLSearchParams(params)}`; with
no params it calls `GET /timetable/versions` with **no `academicContextId`**, so the backend omits
the context filter and returns versions for **every cohort**.

**Reproduced live (Playwright, HOD session, 1280×720):**
```
rows rendered in approval table     : 107
cohorts visible                     : III-A, III-B, III-C (mixed, no filter UI)
status breakdown                    : PUBLISHED 71, APPROVED 25, DRAFT 11
rows with live Approve/Reject/Publish: 25
```
Live API confirms the spread: `6aba…cef0` = 33 versions, `6aba…ceef` = 63, `6aba…cef1` = 11.

#### Backend Contract
`timetableController.getVersions()` (`timetableController.js:171-201`):
```js
if (academicContextId) { query.academicContextId = academicContextId; }   // preferred
else { /* legacy 5-field filters */ }
```
with the explicit comment *"Context scoping happens in the database, never in the client."*

#### Why Current Behavior Is Wrong
This violates the PRD's hardest non-functional rule (`docs/backend/PRD.md:286`): *"A user
viewing Context A must never receive timetable/session data belonging to Context B through an
API or UI state leak."* The backend offers correct scoping; the frontend declines to send it.
The consequence is not cosmetic — the HOD sees **25 actionable Approve/Reject/Publish buttons
for cohorts they never opened**, and one click transitions another cohort's published timetable.

#### Required Frontend Change
1. Add an **Academic Context selector** to the page header (reuse the existing `Select`
   component + `getAcademicContexts()`).
2. Pass `academicContextId` to `getTimetableVersions({ academicContextId })`.
3. Reset `versions` to `[]` and show a loading state **before** the new request resolves, so
   cohort A's rows never remain visible under cohort B's header.
4. Render Approve/Reject/Publish only for versions in the currently selected context.
5. Show a specific empty state ("No timetable versions for this cohort yet"), not a generic table.

#### Expected UI Behavior
The approval desk always shows exactly one cohort. Switching cohorts clears the previous list,
shows loading, then renders only that cohort's versions. Action buttons exist only for the
displayed cohort.

#### Acceptance Criteria
- [ ] With a context selected, only versions whose `academicContextId` equals it render
- [ ] Switching III-A → III-B never leaves III-A rows under the III-B header
- [ ] No Approve/Reject/Publish button references a version outside the selected context
- [ ] `TIMETABLE_VERSION_CONTEXT_MISMATCH` (409) surfaces as a readable message
- [ ] Cohort with zero versions shows a specific empty state, not "No data"
- [ ] Row count drops from 107 to that cohort's version count

#### Test Case
```
1. Login as HOD, open /hod/approval.
2. Assert every rendered row's academicContextId === selected context id.
3. Switch context 5 times rapidly; after each settle assert no foreign rows.
4. Assert no two contexts' rows are visible simultaneously.
5. Click Approve; confirm the transitioned version belongs to the selected context.
```

#### Dependencies
Independent of FE-P0-001; both are context-isolation defects and should ship together.

#### Risk if Not Fixed
HOD approves/rejects/publishes the wrong cohort's timetable — a governance-integrity failure and
a direct PRD violation.

---
#### Risk if Not Fixed
### Issue ID: FE-P0-003
#### Priority
**P0** — silently drops faculty from the timetable (data-integrity of the published artefact)

#### Page / Route
`/hod/timetable-review`, `/coordinator/view`, `/faculty/class-timetable`

#### Exact File
- `web/src/pages/hod/TimetableReviewPage.js` — session cell renderer (~line 34 + grid JSX)
- `web/src/pages/faculty/ClassTimetablePage.js` — line 292 `Faculty: {session.facultyName || session.facultyId}`

#### Exact Component / Function
Session cell rendering in the timetable grid of both pages

#### Current Behavior
Both pages render **only the scalar** `session.facultyId` / `session.facultyName`. The backend
returns `facultyAssignments[]` on every multi-faculty session; **no timetable rendering file in
the frontend reads it** (verified: `facultyAssignments` appears only in
`HODFacultyAllocationPage.js` and `coordinatorDesignService.js`, never in a grid).

**Reproduced live (Playwright, HOD, version `6ac2659…`):**
```
API: 21 sessions, 11 of them multi-faculty
     sample 22MAN8R -> facultyAssignments: [ {MAT-001, MATHS_BME}, {ENG-001, ENGLISH} ]
UI  : grid cell renders "22MAN8R | Soft/Analytical Skills - IV | LH-101 | MAT-001"
     DOM check: MAT-001 present = true , ENG-001 present = FALSE
```

#### Backend Contract
A LAB/MC_SAS class event is **ONE** session carrying multiple assignments:
```json
{ "courseCode":"22MAN8R", "sessionType":"MC",
  "facultyId":"MAT-001", "facultyName":"Dr. Murugapandian G S",
  "facultyAssignments":[
    {"facultyId":"MAT-001","role":"MATHS_BME"},
    {"facultyId":"ENG-001","role":"ENGLISH"}]}
```
`docs/backend/PRD.md:47`: multi-faculty LAB/MC assignments must be preserved **without
duplicating one class event**. `docs/backend/DESIGN_SYSTEM.md:487` forbids one class row per
faculty — so the fix is **more assignment chips in one cell**, never extra cells.

#### Why Current Behavior Is Wrong
The class timetable is the artefact students and faculty actually read. For a 3-faculty LAB the
UI shows one name, so the other two appear unassigned and the English/Maths pairing is invisible.
It is not a duplication bug — it is a **silent data-loss** bug, contradicted by PRD §FR-10
("Faculty views must include every applicable assigned session, including sessions where the
faculty is one of several assigned faculty members").

#### Required Frontend Change
1. In the session cell, render `session.facultyAssignments` when present (name + role chip),
   falling back to `facultyName`/`facultyId` only when the array is absent.
2. Render **all** assignments in the **same single cell** — never one cell per faculty.
3. Keep `day × period` as the unique cell key so the grid shape is unchanged.
4. Apply the same change to the faculty timetable and coordinator review view.
5. Optionally add a `title` tooltip listing all assigned faculty for narrow viewports.

#### Expected UI Behavior
One class cell per period containing the course plus **all** assigned faculty with roles, e.g.
`MAT-001 (Maths/BME) · ENG-001 (English)`. The grid must not gain rows or cells.

#### Acceptance Criteria
- [ ] A 3-faculty LAB cell displays all 3 faculty names and roles
- [ ] The MC_SAS session for `22MAN8R` shows both `MAT-001` and `ENG-001`
- [ ] The number of `day × period` cells is **unchanged** (no duplication)
- [ ] API session count equals the number of populated grid cells
- [ ] Sessions with no `facultyAssignments` still render via the scalar fallback

#### Test Case
```
1. Open /hod/timetable-review for a version containing 22MAN8R.
2. Assert the cell text contains MAT-001 AND ENG-001.
3. Count populated cells; assert it equals API sessionCount (no duplicates).
4. Open /faculty/class-timetable for the same context; repeat.
5. Assert grid row/column count unchanged vs. before the fix.
```

#### Dependencies
None. Independent and safe to ship immediately.

#### Risk if Not Fixed
Published timetables misrepresent faculty workload. Directly contradicts PRD §FR-10 and the
design-system multi-faculty rule.

---
The TimeTable Coordinator — the role the product exists for — can never use the product.
### Issue ID: FE-P0-004
#### Priority
**P0** — frontend bypasses the authoritative substitute-eligibility engine

#### Page / Route
`/coordinator/free-mapping`

#### Exact File
`web/src/pages/coordinator/FreeTimetableMappingPage.js` — imports line 15, load at line 52-59,
modal handler `handleOpenMappingModal` lines 81-104, assign at line 129

#### Exact Component / Function
`FreeTimetableMappingPage()` — faculty dropdown population and substitute assignment

#### Current Behavior
The page loads **every faculty in the department** via `getFacultyList()` and offers them all as
substitute candidates. It never asks the backend who is actually eligible.

```js
import { getFacultyList } from '../../services/facultyService';   // line 15
...
const [f] = await Promise.all([ getFacultyList(), getAbsences(), getSubstitutes() ]);  // line 52-59
```
Neither `GET /substitutes/affected-sessions` nor `GET /substitutes/eligible-faculty` is called
anywhere in the frontend (verified: 0 call sites).

#### Backend Contract
Two dedicated, TC-authorised endpoints exist precisely for this:
- `GET /api/substitutes/affected-sessions` — which sessions an absence disrupts
- `GET /api/substitutes/eligible-faculty?timetableSessionId=…&absenceId=…&academicContextId=…`

`substituteController.js:150-190` enforces the full rule set: session must exist (404
`SESSION_NOT_FOUND`), absence must exist (404 `ABSENCE_NOT_FOUND`), and
```js
// Cross-context guard: never offer substitutes computed against another context.
if (academicContextId && session.academicContextId && String(session.academicContextId) !== String(academicContextId))
  return errorResponse(res, 'The timetable session belongs to a different academic context.', …);
```
Eligibility excludes the original faculty, absent faculty, conflicting sessions, and
`UNAVAILABLE` / `PREFERRED_OFF` conflicts.

#### Why Current Behavior Is Wrong
The frontend duplicates — and drastically under-implements — a backend rules engine, which
`docs/backend/AGENTS.md:114-127` forbids. The user is shown faculty who are **provably
ineligible** (already absent, already teaching that slot, or blocked by availability), and the UI
has no notion of *affected sessions* at all. Only the server can compute eligibility correctly
because it needs timetable + absence + availability state together.

#### Required Frontend Change
1. Add to `substituteService.js`:
   ```js
   export async function getAffectedSessions(params) { /* GET /substitutes/affected-sessions */ }
   export async function getEligibleFaculty(params)   { /* GET /substitutes/eligible-faculty */ }
   ```
2. Replace `getFacultyList()` in the candidate dropdown with `getEligibleFaculty({
   timetableSessionId, absenceId, academicContextId })`.
3. Drive the modal from `getAffectedSessions({ absenceId, academicContextId, date })` so the
   user picks a *session*, and eligibility is fetched per selected session.
4. Send `academicContextId` + `timetableSessionId` with `assignSubstitute()`.
5. Render the backend's exclusion reasons ("already absent", "conflicting session") instead of
   hiding candidates silently.
6. Show a specific empty state when the backend returns zero eligible faculty.

#### Expected UI Behavior
The user selects an absence → sees exactly the affected sessions → selects a session → sees
**only backend-approved eligible faculty** with any exclusion reason → assigns. No unverified
faculty ever appears in the list.

#### Acceptance Criteria
- [ ] The candidate list is sourced from `GET /substitutes/eligible-faculty`, never `GET /faculty`
- [ ] The original faculty and the absent faculty never appear as candidates
- [ ] Faculty with a conflicting session at that day/period never appear
- [ ] Cross-context request returns 409 and is shown as a readable error
- [ ] Zero eligible faculty → specific empty state, not an empty dropdown
- [ ] The affected-sessions list is shown before assignment

#### Test Case
```
1. Create an absence for a faculty with 2 sessions.
2. Open /coordinator/free-mapping, select the absence.
3. Assert the affected-sessions list shows exactly those sessions.
4. Select a session; assert candidates === backend eligible-faculty response.
5. Assert the original faculty is absent from the candidate list.
6. Network tab: assert no call to GET /faculty is used for candidates.
```

#### Dependencies
Requires FE-P0-001 to be reachable (the page is TC-only). Land after FE-P0-001.

#### Risk if Not Fixed
Substitutes are assigned to faculty who cannot attend, creating coverage gaps the system
reports as covered. Backend eligibility is defeated entirely.

---
Design → generate → review → submit is unreachable. Highest-impact defect in the codebase.

---
| **TC** | Login → context → design → generate → review → submit → resubmit | **Broken at step 1**: `TC` cannot reach any portal | **FAILS** |
| **HOD** | Login → context → allocation → review → reject → approve → publish | Works, but approval desk mixes 3 cohorts | **PARTIAL** |
| **Faculty** | timetable → absence → affected sessions → substitute | Absence works; substitute eligibility bypassed | **PARTIAL** |
| **Public** | PUBLISHED only | No published-only endpoint used by the frontend | **FAIL** (FE-P1-010) |

---
---
## 6. COMPULSORY CHANGES — P1 (MAJOR WORKFLOW DEFECTS)

---

### Issue ID: FE-P1-002 · Dead route `/faculty/weekly-timetable`
**Priority: P1** · **Page:** `/faculty/weekly-timetable` · **File:** `web/src/routes/AppRoutes.js` (faculty block, lines 66-86) + `web/src/components/layout/Sidebar.js`

**Current behavior:** `Sidebar.js:66` renders a "Weekly Grid Matrix" link and
`FacultyDashboard.js:205,281` navigates to `/faculty/weekly-timetable`, but **no route exists**.
A fully-written `WeeklyTimetablePage.js` (26.4 KB) sits unrouted.

**Reproduced live (Playwright, FACULTY session):**
```
goto /faculty/weekly-timetable -> redirects to /faculty/class-timetable  (shows the WRONG page)
goto /faculty/my-timetable     -> redirects to /login                    (logs out an authed user)
```

**Backend contract:** none needed — pure route-table omission. `getFacultyTimetable()` already
exists and works (`timetableService.js:13-18`).

**Why wrong:** the sidebar advertises a view that silently resolves to a *different* timetable,
so users believe they see the weekly grid while actually viewing another page. The
`/faculty/my-timetable` bounce to `/login` is worse — it destroys the session experience.

**Required change:**
1. Add `<Route path="weekly-timetable" element={<WeeklyTimetablePage />} />` and
   `<Route path="my-timetable" element={<MyTimetablePage />} />` inside the faculty block.
2. Add a dev-only route-existence test so a future link can never dangle again.

**Expected UI:** both links render their own pages; no redirect to `/login` while authenticated.

**Acceptance criteria:**
- [ ] `/faculty/weekly-timetable` renders `WeeklyTimetablePage` (no redirect)
- [ ] `/faculty/my-timetable` renders `MyTimetablePage` and stays authenticated
- [ ] Every `Sidebar` link resolves to a real route
- [ ] Unauthenticated deep link still redirects to `/login` (security preserved)

**Test:** log in as faculty, click each sidebar link, assert URL + page title match, no redirect.

**Dependencies:** none. **Risk:** 45 KB of finished UI unreachable; users silently see the wrong
timetable with no error.

---

### Issue ID: FE-P1-003 · Invented course period requirements
**Priority: P1** (wrong data presented as authoritative) · **File:** `web/src/services/coordinatorDesignService.js`

**Current behavior — three invented fallbacks:**
```js
222:  const requiredPeriods =
223:    crs.totalPeriod ||
224:    (Number(crs.L||0) + Number(crs.T||0) + Number(crs.P||0)) ||
225:    (crs.isLab ? 4 : 3);          // <-- INVENTED
270:  const periods = catalogMatch?.totalPeriod || (…) || 3;   // <-- INVENTED
320:  requiredPeriods: 3,              // <-- INVENTED for every unresolved elective slot
```
`OptimizationSolverPage.js:262` invents it again: `Number(r.requiredPeriods) || 3`.

**Backend contract:** `backend/src/services/courseRequirementService.js` exists **solely** to
stop this. Its header comment states the old behaviour *"invented a number for any course whose
requirement was not present"*, and it returns `{requiredPeriods: 0, source: 'MISSING',
reason: 'COURSE_REQUIREMENT_MISSING'}` rather than guessing.

**Why wrong:** a course with no canonical requirement is shown as needing 3 periods and sent to
the solver as if 3 were fact — exactly the "MISSING" case the backend made explicit.

**Required change:**
1. Delete the `(crs.isLab ? 4 : 3)` and `|| 3` fallbacks; use only `totalPeriod`, then `L+T+P`.
2. When both are absent set `requiredPeriods: 0` and `requirementSource: 'MISSING'`.
3. Show a visible "Period requirement missing in curriculum" chip on such rows.
4. Exclude `source === 'MISSING'` courses from the solver payload.
5. Remove the `|| 3` at `OptimizationSolverPage.js:262`.

**Acceptance criteria:**
- [ ] No `isLab ? 4 : 3` and no bare `|| 3` period fallback remains
### Issue ID: FE-P1-004 · Hardcoded academic year / week in the global topbar
**Priority: P1** (wrong context data on every authenticated page) · **File:** `web/src/components/layout/Topbar.js:48,50,52`

**Current behavior (verbatim):**
```jsx
48: <span className="ui-topbar-context-detail">ODD SEMESTER 2024-25</span>
50: <span style={{...}}>WEEK 11 (ACTIVE)</span>
52: <span className="ui-topbar-context-detail text-muted">CSE • R2022</span>
```
Static strings, not bound to any context.

**Reproduced live:** logged in as HOD against contexts whose `academicYearFrom/To` are
`2026-2027`, every page header displayed **"ODD SEMESTER 2024-25"** and **"WEEK 11 (ACTIVE)"**.

**Backend contract:** `AcademicContext` carries `academicYearFrom`/`academicYearTo` (verified: all
12 seeded contexts = `2026-2027`), plus `year`, `semester`, `section`, `department`.

**Why wrong:** the topbar is the ambient context indicator on *every* page and states a
factually incorrect academic year on all of them. The PRD requires the real context be displayed.
There is no week model in the backend, so "WEEK 11" is pure fiction.

**Required change:**
1. Bind the text to the active `AcademicContext`; remove the literals.
2. Render `academicYearFrom–academicYearTo` when present, else `semester` + `year`.
3. Delete "WEEK 11 (ACTIVE)" entirely — no backend source exists.
4. Update on context change.

**Acceptance criteria:**
- [ ] Topbar year matches the selected context's `academicYearFrom–To`
- [ ] No hardcoded "2024-25" or "WEEK 11" remains in `Topbar.js`
- [ ] Switching context updates the topbar
- [ ] "WEEK 11" does not appear anywhere in the rendered app

**Test:** open any portal, compare topbar text to the context record; switch contexts, re-check.

**Dependencies:** none. **Risk:** every screen shows the wrong academic year.

---

### Issue ID: FE-P1-005 · Multi-faculty invisible in the **faculty** timetable + fake identity fallback
**Priority: P1** · **File:** `web/src/pages/faculty/FacultyTimetablePage.js` (also `MyTimetablePage.js`, `WeeklyTimetablePage.js`)

**Current behavior:** these pages render `session.facultyName` only, never inspect
`facultyAssignments`, and resolve identity with a dangerous fallback:
```js
25: const facultyId = user?.facultyId || user?.id || 'FAC01';   // literal fake identity
```

**Backend contract:** `GET /api/timetable/faculty/:facultyId` returns
`{facultyId, timetableVersionId, timetableVersion, status, isInternalReview, sessionCount,
facultyCount, roles, sessions[]}` — with `facultyAssignments` present on each session (verified).

**Why wrong:** PRD §FR-10 requires faculty views to include every applicable assigned session.
Separately, a literal `'FAC01'` fallback means that if `facultyId` is ever missing the app
silently queries a **different, non-existent faculty's** timetable instead of erroring.

**Required change:**
1. Remove the `'FAC01'` fallback; if `user.facultyId` is absent, render an explicit error
   ("Your account is not linked to a faculty record — contact the HOD").
2. Render `facultyAssignments` (all) in each session cell, consistent with FE-P0-003.
3. Show `status` / `isInternalReview` so faculty know if they view a draft or published timetable.
4. Never request another faculty's timetable from a guessed id.

**Acceptance criteria:**
- [ ] No literal `'FAC01'` (or any hardcoded id) remains as a fallback
- [ ] A user with no `facultyId` sees an explicit error, never a wrong timetable
- [ ] Multi-faculty sessions display all assigned faculty
- [ ] Draft vs published is visibly distinguished

**Test:** log in as a faculty user; assert the request URL contains their own id; simulate a user
### Issue ID: FE-P1-006 · TC generation bypasses the authoritative endpoint
**Priority: P1** · **File:** `web/src/services/timetableService.js:46-49`, `web/src/pages/coordinator/OptimizationSolverPage.js:265-268`

**Current behavior:**
```js
47:  const response = await api.post('/timetable/solve', payload);
265: const res = await solveTimetable({ academicContextId: activeContextId, assignmentPlan });
```
The client builds the whole `assignmentPlan` (course → faculty → requiredPeriods) and posts it
to the legacy endpoint.

**Backend contract:** `POST /api/timetable/generate-from-context` is the *preferred* path
(`routes/timetableRoutes.js:98-106`). Its route comment states: *"the server re-derives the
course list, HOD-approved faculty and period counts from the Phase 3 TC Design Context, runs the
CSP solver, persists TimetableSession[] and sets TimetableVersion = GENERATED."* It is TC-only and
rate-limited (20 / 10 min).

**Why wrong:** the client-supplied plan means the browser decides which faculty teach which
course and how many periods each needs — the exact second business-rule engine the PRD forbids.
It also bypasses the authoritative derivation and the rate limiter, and the invented periods from
FE-P1-003 flow straight into the solver.

**Required change:**
1. Add `generateFromContext(academicContextId)` to `timetableService.js` posting to
   `/timetable/generate-from-context`.
2. Call it from `OptimizationSolverPage.handleGenerateTimetable` instead of `solveTimetable`.
3. Stop sending a client-built `assignmentPlan`; let the server derive it.
4. Surface `RATE_LIMIT_EXCEEDED` (429) with a retry-after message.
5. Keep `/solve` only if a documented use case remains; otherwise remove the wrapper.

**Acceptance criteria:**
- [ ] Generate issues `POST /timetable/generate-from-context` with only `academicContextId`
- [ ] No client-built `assignmentPlan` is transmitted
- [ ] Server-derived courses/faculty/periods appear in the result
- [ ] 429 shows a clear "too many generation requests" message with retry guidance
- [ ] HOD still receives 403 on generate (governance preserved)

**Test:** intercept network during generate; assert URL, method, payload, and that
`assignmentPlan` is absent.

**Dependencies:** requires FE-P0-001 to be reachable; pair with FE-P1-003.

**Risk:** timetable content is determined by client-supplied data rather than the server.

---

### Issue ID: FE-P1-007 · Design Context endpoint unused
**Priority: P1** · **File:** `web/src/pages/coordinator/OptimizationSolverPage.js` (load block, lines 70-98)

**Current behavior:** the TC design page assembles its environment from 3 separate calls —
`getAcademicContexts()`, `getCourses()`, `getHODAllocations()` — then re-derives the cohort,
curriculum semester, and readiness in the browser.

**Backend contract:** `GET /api/timetable/design-context/:academicContextId` returns exactly this
bundle (verified live, HTTP 200):
```
{ academicContext, regulation, curriculumSemester, readiness,
  electiveSelection, currentVersion, courses[] }
```

**Why wrong:** the page re-implements context resolution and readiness rules in the browser,
precisely duplicating the backend. It also makes 3 requests where 1 suffices and can drift from
the server's cohort resolution.

**Required change:**
1. Add `getDesignContext(academicContextId)` to `timetableService.js`.
2. Load the design context for the selected cohort and render from its `courses`,
   `curriculumSemester`, `readiness`, `electiveSelection` and `currentVersion`.
3. Keep `getAcademicContexts()` only for the context picker itself.
4. Delete the browser-side curriculum-semester derivation for this page.

**Acceptance criteria:**
- [ ] Design page issues one `GET /timetable/design-context/:id` per context change
- [ ] Course rows come from the server's `courses[]`, not a client re-derivation
- [ ] `curriculumSemester` shown matches the backend value exactly
- [ ] No duplicate readiness computation remains in the page

**Test:** network tab shows the design-context call; rendered semester equals the API value.

**Dependencies:** requires FE-P0-001; pair with FE-P1-009.

**Risk:** two independent implementations of context readiness can disagree.

---

### Issue ID: FE-P1-008 · Context status / workflow state unused
**Priority: P1** · **File:** all workflow pages

**Current behavior:** no page calls `GET /timetable/context-status/:id`. Workflow state is
inferred client-side from array lengths and statuses.

**Backend contract:** `GET /api/timetable/context-status/:academicContextId` (verified HTTP 200)
returns `{success, statusCode, state, nextAction, message, academicContext, regulation, year,
semester, section, curriculum, electiveSelection, allocation, timetable}`. It distinguishes
*"valid context, no timetable yet"* from *"no context"* — a distinction `docs/backend/PRD.md:45`
explicitly requires.

**Why wrong:** the UI cannot render the backend's authoritative `state`/`nextAction`/`message`, so
empty states are generic rather than actionable — a direct violation of
`docs/backend/DESIGN_SYSTEM.md:415` ("Do not display a generic `No data` message when the backend
provides an actionable workflow state").

**Required change:**
1. Add `getContextStatus(academicContextId)` to `timetableService.js`.
2. Drive empty/error text from `state`, `nextAction` and `message`.
3. Distinguish: no context · no applicable curriculum · valid context, no timetable yet · no
   published timetable · no search results.
4. Show the CTA matching `nextAction` (e.g. "Complete HOD allocation" vs "Generate timetable").

**Acceptance criteria:**
- [ ] Each empty state renders the backend `message`/`nextAction`, not a generic string
- [ ] "No timetable yet" is visually distinct from "No academic context"
- [ ] The suggested action matches `nextAction`
- [ ] No generic "No data" text remains on workflow pages

**Test:** for a context with no version, assert the backend message is displayed and the CTA
matches `nextAction`.

**Dependencies:** requires FE-P0-001; pair with FE-P1-007.

**Risk:** users are told "no data" when the backend has an actionable next step.

---

### Issue ID: FE-P1-009 · Readiness re-derived instead of using `validate/:id`
**Priority: P1** · **File:** `web/src/services/coordinatorDesignService.js` (`calculateAssignmentPlanStatus`, line 336+)

**Current behavior:** `calculateAssignmentPlanStatus()` computes `isReady`, `pendingCount`,
`theoryCount`, `labCount` from client-side row analysis.

**Backend contract:** `GET /api/hod-allocations/validate/:academicContextId` (verified HTTP 200)
returns `{academicContextId, cohort, readyForGeneration, totalRequiredCourses, allocatedCount,
details[]}`.

**Why wrong:** the Generate button's enable/disable state (`OptimizationSolverPage.js:208-216,
220`) is decided by a client-side heuristic, so it can disagree with the server. Generation is
then attempted — or wrongly blocked — without the authoritative answer.

**Required change:**
1. Add `validateCohortAllocations(academicContextId)` to `hodAllocationService.js`.
2. Use server `readyForGeneration` as the single source for the Generate button state.
3. Render `details[]` as the per-course pending list (replacing the client-side scan).
4. Keep local state only for optimistic UI, never for the authoritative decision.

**Acceptance criteria:**
- [ ] Generate button state comes from server `readyForGeneration`
- [ ] The pending-course list matches `details[]`
- [ ] A client/server discrepancy never blocks a valid generation

**Test:** with an incomplete allocation, assert the button is disabled and the pending list
matches `details[]`.

**Dependencies:** requires FE-P0-001; pair with FE-P1-007.

**Risk:** TC is blocked from, or allowed into, generation based on a client-side guess.

---

### Issue ID: FE-P1-010 · Public timetable must be PUBLISHED-only
**Priority: P1** · **File:** `web/src/services/timetableService.js`, `web/src/pages/faculty/ClassTimetablePage.js`

**Current behavior:** `getClassTimetable()` calls `GET /timetable/class/:id`, which serves
internal review data for any version when `versionId` is supplied. No page uses the published-only
endpoint.

**Backend contract:** `GET /api/timetable/published/:academicContextId` returns
`{academicContextId, academicContext, isPublished, message, sessions[]}` — the PRD-required public
view (`docs/backend/PRD.md:274`: *"The default/public class timetable must only display published
data"*).

**Why wrong:** a default/public class view that can render a DRAFT or REJECTED timetable
misrepresents the institution's official schedule.

**Required change:**
1. Add `getPublishedClassTimetable(academicContextId)` to `timetableService.js`.
2. Use it for any public/default class timetable view; reserve `/timetable/class/:id` for
   authenticated internal review (TC/HOD).
3. When `isPublished === false`, render the backend `message` and no sessions.

**Acceptance criteria:**
- [ ] Public/default class timetable only ever calls `/timetable/published/:id`
- [ ] A context with no PUBLISHED version shows the backend message and zero sessions
- [ ] DRAFT/REJECTED sessions are never rendered in the public view
- [ ] Internal review pages still use `/timetable/class/:id` with an explicit version

**Test:** create a draft-only version; assert the public view shows no sessions.

**Dependencies:** none. **Risk:** unofficial timetables shown as official.

---

### Issue ID: FE-P1-014 · No TC submit-for-approval action
**Priority: P1** · **File:** `web/src/pages/hod/TimetableReviewPage.js` (Coordinator branch)

**Current behavior:** `coordinatorService.submitTimetableForApproval()` exists
(`coordinatorService.js:88-93`) and calls the correct endpoint, but **no page invokes it**. The
Coordinator review view (`portalType="Coordinator"`) has no Submit action.

**Backend contract:** `PATCH /api/timetable/version/:id/status` with
`{status:'PENDING_HOD_APPROVAL'}`. The service layer enforces per-target-status authority
(`routes/timetableRoutes.js:47-55`): TC → `PENDING_HOD_APPROVAL`; HOD → `APPROVED`/`REJECTED`/
`PUBLISHED`.
## 7. COMPULSORY CHANGES — P2 AND P3

### FE-P2-011 · `RegulationPage` renders a hardcoded curriculum duplicate
**Priority: P2** · **File:** `web/src/pages/hod/RegulationPage.js` (54.7 KB)

Hardcodes `ELECTIVE_SLOTS_DATA` (lines 87-292) with fabricated `totalPeriod: 3` on every slot
(10 occurrences), hardcoded course codes (`22GEA02, 22GEA03, 22GEA04, 22GEZ01`, `22CSZ01(…)`),
and `orderedCodes` arrays (lines 390, 403, 416, 442, 445). Meanwhile
`GET /api/courses/curriculum/r22` already returns `courses`, `electiveSlotMap`, `pecVerticals`,
`managementElectives`, `openElectives` (verified `courseController.js:344-364`).

**Fix:** fetch and render from the endpoint; delete the local `ELECTIVE_SLOTS_DATA`,
`orderedCodes`, and fabricated `totalPeriod` values.
**Accept:** no hardcoded course code remains; displayed map equals API `electiveSlotMap`; elective
candidates come from `GET /hod-allocations/elective-candidates`.
**Risk:** regulation data silently drifts from the authoritative curriculum.

### FE-P2-012 · `review-matrix` endpoint unused
**Priority: P2** · **File:** `web/src/pages/hod/TimetableReviewPage.js`

The page rebuilds the review grid from `/timetable/class/:id` instead of
`GET /timetable/review-matrix` (verified returns `{status, sessionCount, summary, sessions}`),
which already provides the review summary. **Fix:** consume review-matrix for the review view.
**Accept:** review view issues the review-matrix call and renders backend `summary`.

### FE-P2-013 · Unlabeled `<Select>` (accessibility)
**Priority: P2** · **File:** `web/src/pages/faculty/ClassTimetablePage.js:131-138`

`<Select>` is used with **no `label` prop**. `Select.js:15` derives `selectId` from `label`, so
with no label the element gets `id={undefined}` and no `<label for>` — confirmed live by DOM audit:
`unlabeled: ["SELECT[type=select-one]#no-id"]`. Violates `docs/backend/DESIGN_SYSTEM.md:433`
("All form controls have accessible names").

**Fix:** add a `label` (e.g. "Academic Context") or an explicit `id` + `aria-label`.
**Accept:** every `select` resolves to a `<label for>` or has `aria-label`.

### FE-P2-014 · Protected-field audit on faculty forms
**Priority: P2** · **File:** `web/src/pages/hod/AddFacultyPage.js` (31.3 KB), `FacultyListPage.js`

`AddFacultyPage` collects a very large payload (teaching/responsibility/workload blocks). The
backend owns workload calculation (`docs/backend/AGENTS.md:114-127`); exposing calculated hours,
`role`, `isActive`, `passwordHash` as editable inputs would let the UI contradict the server.

**Fix:** audit every field; make `facultyId`, `role`, `isActive`, calculated hours and derived
workload blocks read-only or remove them. Keep `password` write-only on create only.
**Accept:** no calculated/derived field is editable; server-computed totals render read-only.

### FE-P2-015 · Generic error strings hide structured backend codes
**Priority: P2** · **Files:** 20+ pages using `err.message || '<generic>'`

The API client already surfaces `error.code`, `error.status`, `error.details` (`api.js:100-104`),
but ~20 pages discard them. Structured codes the UI never renders include
`TIMETABLE_VERSION_CONTEXT_MISMATCH`, `INVALID_COHORT_YEAR`, `NOT_FOUND`, `RATE_LIMIT_EXCEEDED`,
`FORBIDDEN`, `SESSION_REQUIRED`, `SESSION_NOT_FOUND`, `ABSENCE_NOT_FOUND`.

### FE-P2-017 · No `aria-live` for status changes
**Priority: P2** · **File:** `web/src/components/common/Toast.js`, workflow pages

Design system requires status changes be announced (`DESIGN_SYSTEM.md:438`).
**Fix:** add `role="status"` / `aria-live="polite"` to the toast region, `role="alert"` to errors.
**Accept:** a screen reader announces generation/approval results.

### FE-P2-018 · Modal lacks focus trap and focus restore
**Priority: P2** · **File:** `web/src/components/common/Modal.js`

`role="dialog"`, `aria-modal` and Escape handling are correct (lines 14-25, 33-34), but focus is
never moved into the dialog nor restored on close, and Tab can escape it.

**Fix:** focus the first focusable child on open; trap Tab/Shift+Tab; restore focus to the trigger.
**Accept:** keyboard-only users cannot tab behind an open modal; focus returns to the trigger.

### FE-P3-019 · UI terminology consistency
**Priority: P3** · **Files:** `TimetableApprovalPage.js:78`, `Sidebar.js`, dashboards

Copy mixes "Coordinator", "Executive desk", and "L1/L2/L3" tiering against the PRD term
"TimeTable Coordinator" and the ban on "Academic Coordinator for new flows" (`DESIGN_SYSTEM.md:461`).
**Fix:** standardize on "TimeTable Coordinator (TC)"; drop tier metaphors ("EXECUTIVE (L1)",
"LEVEL 03") absent from the domain model.

### FE-P3-020 · Dead files and production credential shortcut
**Priority: P3** · **Files:** `RoutePlaceholder.js`, `*DashboardPlaceholder.js`,
`MyTimetablePage.js`, `WeeklyTimetablePage.js`, `LoginPage.js:19,73-105`

Four placeholder pages are imported nowhere; `LoginPage` prefills real credentials and a password
in a production-facing shortcut panel. **Fix:** route or delete the two timetable pages (see
FE-P1-002); delete unused placeholders; gate the credential panel behind
`process.env.NODE_ENV !== 'production'`.

### FE-P3-021 · `groupSessionsByDay` hardcodes MON–FRI and P1–P7
**Priority: P3** · **File:** `web/src/services/timetableService.js:120-141`

`grouped` is a fixed MON–FRI object and `periodOrder` a fixed P1–P7 map; a `SAT` session is
silently dropped and unknown periods sort to 99. The backend permits `SAT`
(`productionBackendIntegrity.test.js:340`). **Fix:** build the day map from `WEEK_DAYS` and sort
periods from `PERIOD_TIMINGS`.

---

## 8. PHASE 8 — RESPONSIVE UI AUDIT (browser-verified)

Tested at 1280×720, 768×1024 (viewport width verified), 390×844 and 360×800-equivalent.

| Viewport | Page | Result |
|---|---|---|
| 1280×720 | `/login`, `/hod/dashboard`, `/hod/approval`, `/hod/faculty-allocation`, `/hod/timetable-review` | **PASS** — no horizontal overflow, tables render fully |
| 390×844 | `/hod/faculty-allocation` | **PASS** — `docScrollW 382 === clientW 382`, no page-level horizontal scroll. Overflow is correctly contained in `.ui-table-scroll-container` (scrollW 850 / clientW 357) — this is the design system's intended "scroll, don't compress" behaviour |
| 390×844 | `/hod/timetable-review` | **PASS** — timetable grid wrapped in `.ui-timetable-scroll-container` (850px) with no page overflow |
| 390×844 | `/hod/approval` (107 rows) | **CONCERN** — a 107-row table with no pagination or filter; heavy DOM on mobile. Resolved by FE-P0-002 (context scoping reduces to one cohort) |

**Finding: responsive layout is genuinely in good shape.** The container-scoped horizontal
scrolling matches `docs/backend/DESIGN_SYSTEM.md:50-52` ("switch to horizontal scrolling …
Do not simply shrink text"). No viewport produced a broken or clipped layout.

**Outstanding responsive work:** the 107-row approval table needs pagination/virtualisation once
scoped by context (fold into FE-P0-002). No other responsive defect was reproduced.

---

## 9. PHASE 9 — ACCESSIBILITY AUDIT

| ID | Component | Defect | Severity |
|---|---|---|---|
| A11Y-01 | `ClassTimetablePage.js:131` `<Select>` | No `label` prop → `id=undefined`, no `<label for>`, no `aria-label`. Confirmed via DOM audit. | P2 |
| A11Y-02 | `Modal.js` | No focus trap, no initial focus, no focus restore on close. | P2 |
| A11Y-03 | `Toast.js` | No `aria-live` region for status announcements. | P2 |
| A11Y-04 | `TimetableApprovalPage.js:45` | Uses `window.prompt()` for rejection remarks — not keyboard/screen-reader friendly, not styleable, and blocks the UI thread. Should be the existing `Modal`. | P2 |
| A11Y-05 | `Button.js` | No `aria-busy` while `isLoading`; loading state announced only visually ("Loading..."). | P3 |

**Verified GOOD (do not regress):**
- `ProtectedRoute.js` renders a full-page accessible spinner during session verification and shows
  an explicit 403 state instead of a blank page.
- `AccessDenied.js` is a genuinely good 403 page: names the role, explains the restriction, offers
  two recovery paths.
- `Input.js` / `Select.js` generate `id` from `label` and wire `<label htmlFor>` correctly **when a
  label is supplied** — the defect is caller-side omission, not a component flaw.
- All buttons found in the live DOM had accessible names (`buttonsNoName: []`).
- No missing `alt` on images in the audited pages (`imgNoAlt: 0`).
- `Modal.js` correctly uses `role="dialog"`, `aria-modal="true"` and `aria-labelledby`.

## 10. PHASE 12 — SECURITY AUDIT OF THE FRONTEND

Frontend authorization is **not** the security boundary, and the backend enforces it correctly
(verified: `FACULTY` → 403 on generate and on status transitions; context ownership enforced in
the database). The findings below are about the UI misrepresenting or bypassing that boundary.

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| SEC-01 | Substitute eligibility is fully client-decided, overriding the server engine | **P0** | `FreeTimetableMappingPage.js:15` imports `getFacultyList()`; `GET /substitutes/eligible-faculty` has 0 frontend callers. See FE-P0-004. |
| SEC-02 | Hardcoded academic context data shown as authoritative | P1 | `Topbar.js:48,50` — `"ODD SEMESTER 2024-25"`, `"WEEK 11 (ACTIVE)"` with no backend source. See FE-P1-004. |
| SEC-03 | Hardcoded production credentials surfaced in the login UI | P2 | `LoginPage.js:19` prefills `faculty@nec.edu.in` and the password; `:82-105` offers one-click credential presets. Must be gated to non-production. See FE-P3-020. |
| SEC-04 | Silent fallback to a fabricated faculty identity | P1 | `FacultyTimetablePage.js:25` `|| 'FAC01'` would query another identity's data. See FE-P1-005. |
| SEC-05 | Cross-context version list exposes other cohorts' governance state | **P0** | `/hod/approval` renders 107 versions across 3 contexts. See FE-P0-002. |
| SEC-06 | Token in `localStorage` (XSS-readable) | P3 | `api.js:14`. Acceptable for this stack; do not change without a backend session/cookie decision. |
| SEC-07 | 401 handling does a full `window.location.href` redirect | P3 | `api.js:107-113`. Correct: `clearAuthSession()` runs first. No change required. |

**Verified SAFE (do not regress):**
- No protected faculty fields are rendered in any list/detail view (no `passwordHash`, no role
  mutation control outside HOD-scoped pages).
- `ProtectedRoute` correctly redirects unauthenticated users and shows an explicit 403 — it does
  not pretend authorization exists.
- The API client never trusts client role state; every request carries the JWT and the server
  decides.
- No `dangerouslySetInnerHTML` anywhere in the frontend (verified across all 91 files).

---

## 11. PHASE 13/14 — DATA CONSISTENCY AND BUSINESS-RULE HARDCODE REGISTER

### 11.1 Hardcoded backend rules found in the frontend (Phase 14 register)

| Rule the frontend re-implements | Location | Verdict |
|---|---|---|
| Course period default `isLab ? 4 : 3` | `coordinatorDesignService.js:225` | **VIOLATION** — backend explicitly removed this |
| Course period default `3` (x3) | `coordinatorDesignService.js:273,320`, `OptimizationSolverPage.js:262` | **VIOLATION** |
| Curriculum + elective map | `RegulationPage.js:87-292,390-445` | **VIOLATION** (duplicate of backend) |
| Elective slot map | `coordinatorDesignService.js:16-34` `DEFAULT_ELECTIVE_SLOT_MAP` | **VIOLATION** (duplicate) |
| Semester/year mapping | `academicContext.js:6-45`, `HODFacultyAllocationPage.js:19-27` | Borderline — presentational, but should derive from `design-context.curriculumSemester` |
| Sections `['A','B','C','D']` | `HODFacultyAllocationPage.js:27` | Acceptable as UI options; must still resolve to a real context |
| Department `'CSE'` defaults | 22 occurrences | Acceptable as display fallback; product boundary is CSE |
| LAB styling `sessionType === 'LAB'` | 8 occurrences | **Acceptable** — presentation, not a business rule |
| `MATHS_BME` / `ENGLISH` role labels | `HODFacultyAllocationPage.js`, `coordinatorDesignService.js` | **Acceptable** — mirrors backend vocabulary, not a re-derivation |

**Important distinction:** LAB/MC styling and role *label* usage present backend-provided values
and are **correct**. The period-count fallbacks and duplicated curriculum tables are genuine rule
duplication and are the P1/P2 items above.

### 11.2 State consistency

| Concern | Status |
|---|---|
| `selectedContextId` reset on context switch | Mostly handled; `TimetableReviewPage` syncs to URL params (good pattern) |
| Stale in-flight responses | **Not handled** → see FE-P2-016 below |
| `timetableVersionId` staleness | Handled in `TimetableReviewPage` via `?versionId` (good) |
| Allocation staleness after save | `HODFacultyAllocationPage` refetches after save (good) |
| Duplicate state sources | **Yes** — context resolved independently in `HODFacultyAllocationPage:77-83` and `OptimizationSolverPage:108-113`. Consolidate when FE-P1-007 lands. |

### FE-P2-016 · Stale-state guard missing on context switch
**Priority: P2** · **Files:** `TimetableReviewPage.js:163-179`, `ClassTimetablePage.js:65-95`

Effects fetch on `[selectedContextId, selectedVersionId]` but do not cancel or ignore in-flight
requests, so a slow response for cohort A can land after the user switched to cohort B.

**Fix:** track a request token / `AbortController`; ignore stale responses; clear prior data and
show loading before the new request.
**Accept:** rapid A→B→C switching never displays A or B data under C.

---

## 12. PHASE 18 — FRONTEND AREAS THAT SHOULD NOT BE CHANGED

These are correct, well-built, or architecturally sound. **Do not rewrite them.**

| Area | Why preserve |
|---|---|
| **`HODFacultyAllocationPage.js` (47.3 KB)** | The best page in the app. Consumes backend `allocationRule`, validates LAB PRIMARY/ADDITIONAL/OPTIONAL and MC_SAS role separation correctly, and treats missing data as *polite guidance* ("Theory course X must be allocated before allocating linked laboratory course Y") rather than errors. Matches `docs/backend/AGENTS.md` on backend authority. |
| **`services/api.js`** | Well-built: token injection, normalized errors (`status`, `code`, `details`), 401 auto-logout, network-error classification, SSR-safe URL handling. Reuse it; do not add a second HTTP client. |
| **`context/AuthContext.js`** | Correct session restore on mount, 401/`TOKEN_EXPIRED` handling, `isLoading` guard, memoized callbacks. Sound. |
| **`routes/ProtectedRoute.js`** | Correct role gating with an accessible loading state and explicit 403. Only add `'TC'` (FE-P0-001). |
| **`pages/common/AccessDenied.js`** | Exemplary error state — names the role, explains the restriction, offers two recovery paths. Use it as the template for other error states. |
| **Common components** (`Card`, `Badge`, `Button`, `Input`, `Select`, `Spinner`, `EmptyState`, `PageHeader`) | Consistent, token-based, accessible when used correctly. `Select`'s missing-label issue is a *caller* error, not a component defect — fix the call site. |
| **Timetable grid layout** | `day × period` matrix with contained horizontal scroll is correct and responsive-safe (verified at 390px). Only the **cell contents** need the multi-faculty fix (FE-P0-003) — do not restructure the grid. |
| **`TimetableReviewPage.js` URL-param sync** | `academicContextId`/`versionId` in the query string with `setSearchParams(..., {replace:true})` is the correct pattern for shareable, refresh-safe context. Extend it to the approval page (FE-P0-002). |
| **7 correct service modules** (`hodAllocationService`, `facultyService`, `workloadService`, `absenceService`, `notificationService`, `availabilityService`, `courseService`) | Endpoints, methods, query params and envelope unwrapping all match the backend. Correct as written. |
| **Loading / empty / error state pattern** | Every major page has explicit loading, error and empty branches. Well ahead of the minimum. Extend the pattern; do not replace it. |
| **`web/webpack.config.js`** | React + Webpack preserved, `/api` proxy correct, `historyApiFallback` on. Do not migrate the build. |
| **No Redux / state library** | There is none and none is needed. Context + hooks is appropriate at this size. |
## 13. PHASE 20 — FILE-LEVEL FRONTEND CHANGE MAP

| Priority | File | Component/Function | Change Required | Reason | Backend Dependency | Test |
|---|---|---|---|---|---|---|
| P0 | `web/src/services/authService.js` | `getDefaultDashboard()` | Add `case 'TC'` → `/coordinator/dashboard` | TC currently lands on a 403 | `User.role` enum | Login as TC, assert URL |
| P0 | `web/src/routes/AppRoutes.js` | coordinator guard (L89) | `allowedRoles` → `['TC','AC','ADMIN']` | TC locked out of whole portal | `requireRole('TC',…)` | Direct-nav `/coordinator/design` as TC |
| P0 | `web/src/components/layout/Sidebar.js` | path ternary (L103) | Map `TC` → `coordinator` | Sidebar links faculty portal | — | Sidebar renders TC nav |
| P0 | `web/src/pages/hod/TimetableApprovalPage.js` | `loadVersions()` (L27) | Pass `academicContextId`; add selector; clear on switch | 107 versions across 3 contexts leak | `GET /timetable/versions?academicContextId=` | Assert row scope per context |
| P0 | `web/src/pages/hod/TimetableReviewPage.js` | session cell renderer | Render all `facultyAssignments` in one cell | 11/21 sessions lose a faculty | `facultyAssignments[]` | Assert ENG-001 visible, cells unchanged |
| P0 | `web/src/pages/faculty/ClassTimetablePage.js` | L292 faculty line | Render all `facultyAssignments` | Same data loss | `facultyAssignments[]` | Multi-faculty cell shows both |
| P0 | `web/src/pages/coordinator/FreeTimetableMappingPage.js` | candidate list + modal | Use `eligible-faculty` / `affected-sessions` | Bypasses authoritative eligibility | `GET /substitutes/*` | Candidates === backend list |
| P0 | `web/src/services/substituteService.js` | — | Add `getEligibleFaculty`, `getAffectedSessions` | Endpoints unused | `substituteRoutes.js` | Network tab |
| P1 | `web/src/routes/AppRoutes.js` | faculty block | Add `weekly-timetable` + `my-timetable` routes | Dead links redirect wrongly | `getFacultyTimetable()` | Click each sidebar link |
| P1 | `web/src/services/coordinatorDesignService.js` | L225, L273, L320 | Remove invented period fallbacks | Backend forbids inventing counts | `courseRequirementService` | Missing-requirement state shows |
| P1 | `web/src/components/layout/Topbar.js` | L48, L50, L52 | Bind to real context; delete "WEEK 11" | Wrong academic year everywhere | `academicYearFrom/To` | Compare topbar to context |
| P1 | `web/src/pages/faculty/FacultyTimetablePage.js` | L25 identity fallback | Remove `'FAC01'`; error state instead | Could query another identity | `facultyId` from user | Missing-id → error state |
| P1 | `web/src/services/timetableService.js` | `solveTimetable` | Add `generateFromContext()` | Client builds the solver plan | `POST /timetable/generate-from-context` | Payload has no `assignmentPlan` |
| P1 | `web/src/services/timetableService.js` | — | Add `getDesignContext()` | Endpoint unused | `GET /timetable/design-context/:id` | One call per context change |
| P1 | `web/src/pages/coordinator/OptimizationSolverPage.js` | load block | Render from design context | Duplicates server readiness | same | Semester matches API |
| P1 | `web/src/services/timetableService.js` | — | Add `getContextStatus()` | Workflow state not shown | `GET /timetable/context-status/:id` | Empty states show backend message |
| P1 | `web/src/services/hodAllocationService.js` | — | Add `validateCohortAllocations()` | Readiness re-derived | `GET /hod-allocations/validate/:id` | Button state from server |
| P1 | `web/src/services/timetableService.js` | — | Add `getPublishedClassTimetable()` | Public view may show drafts | `GET /timetable/published/:id` | Draft-only → no sessions |
| P1 | `web/src/pages/hod/TimetableReviewPage.js` | Coordinator branch | Add Submit for Approval + Redesign | TC→HOD handoff impossible | `PATCH /timetable/version/:id/status` | Submit → HOD sees pending |
| P1 | `web/src/pages/auth/LoginPage.js` | quick-select | Add TC button | TC undiscoverable | seeded TC account | TC reachable from login |
| P2 | `web/src/pages/hod/RegulationPage.js` | `ELECTIVE_SLOTS_DATA` | Fetch from `/courses/curriculum/r22` | Curriculum drift | `getR22CurriculumOverview` | No hardcoded codes remain |
| P2 | `web/src/pages/hod/TimetableReviewPage.js` | data source | Use `/timetable/review-matrix` | Duplicated summary | `review-matrix` | Call issued; summary rendered |
| P2 | `web/src/pages/faculty/ClassTimetablePage.js` | L131 `<Select>` | Add `label` | Unlabeled control | — | DOM audit: no unlabeled select |
| P2 | `web/src/pages/hod/AddFacultyPage.js` | form fields | Make protected/derived fields read-only | Backend owns workload | `POST /faculty` | No editable calculated field |
| P2 | ~20 page files | `err.message \|\| …` | Add `describeError(error)` | Hides structured codes | error `code` field | 409/429 show specific messages |
| P2 | `TimetableReviewPage.js`, `ClassTimetablePage.js` | fetch effects | Abort/ignore stale requests | Race on context switch | — | Rapid switching stays consistent |
| P2 | `web/src/components/common/Toast.js` | toast region | Add `aria-live` | Status not announced | — | Screen reader announces |
| P2 | `web/src/components/common/Modal.js` | dialog | Focus trap + restore | Keyboard users can tab out | — | Focus stays in modal |
| P2 | `TimetableApprovalPage.js` | L45 `window.prompt` | Use `Modal` | Inaccessible rejection input | — | Reject via modal, keyboard works |
| P3 | `TimetableApprovalPage.js`, `Sidebar.js` | copy | Standardize "TimeTable Coordinator" | Terminology drift | — | No "L1/L3" in UI |
| P3 | `RoutePlaceholder.js`, `*DashboardPlaceholder.js` | dead files | Delete or route | Dead code | — | No unrouted pages |
| P3 | `web/src/pages/auth/LoginPage.js` | L19, L73-105 | Gate credential panel to non-production | Credential exposure | — | Panel hidden in prod build |
| P3 | `web/src/services/timetableService.js` | `groupSessionsByDay` | Derive days/periods from constants | Drops SAT sessions | `day` may be SAT | SAT session renders |
## 14. PHASE 17 — RECOMMENDED FRONTEND RECTIFICATION ORDER

### Phase F1 — Unblock the TC role (do this first, alone)
**Issues:** FE-P0-001
**Why first:** every TC-page fix (FE-P0-004, FE-P1-006/007/008/009/014) is **untestable** while a
`TC` user cannot reach any portal. It is 4 small edits across 3 files and carries the highest
product value.
**Files:** `authService.js`, `AppRoutes.js`, `Sidebar.js`, `LoginPage.js`
**Validation:** TC login lands on `/coordinator/dashboard`; AC, FACULTY, HOD routing unchanged.

### Phase F2 — Data correctness in the timetable views
**Issues:** FE-P0-003, FE-P1-005, FE-P1-010
**Why second:** pure rendering fixes against an already-correct API. Independent of routing, low
risk, and they fix visible wrong data. Introduce one shared `getSessionFacultyList(session)`
helper used by every timetable view.
**Files:** `TimetableReviewPage.js`, `ClassTimetablePage.js`, `FacultyTimetablePage.js`,
`MyTimetablePage.js`, `WeeklyTimetablePage.js`, `timetableService.js`
**Validation:** ENG-001 visible on `22MAN8R`; cell count unchanged; published-only view enforced.

### Phase F3 — Context isolation (governance integrity)
**Issues:** FE-P0-002, FE-P2-016
**Why third:** the approval desk is the HOD's highest-consequence screen. Fix the leak and add the
stale-response guard together — both are context-scoping concerns.
**Prerequisite:** F1 (so TC-side context switching can also be tested).
**Files:** `TimetableApprovalPage.js`, `TimetableReviewPage.js`, `ClassTimetablePage.js`
**Validation:** every rendered version belongs to the selected context under rapid switching.

### Phase F4 — TC timetable design & generation on authoritative contracts
**Issues:** FE-P1-003, FE-P1-006, FE-P1-007, FE-P1-009, FE-P1-014
**Why fourth:** this is the substantive workflow. Remove invented period counts first (F4a), then
move generation to `/generate-from-context` (F4b), then consume design-context and validation
(F4c), then add the submit/redesign loop (F4d). Doing payload changes before the submit loop
avoids testing generation twice.
**Prerequisite:** F1 complete; F2 gives correct session rendering to verify results.
**Validation:** generate payload contains no client-built plan; server-derived data renders;
submit → HOD approval → reject → resubmit round-trips.

### Phase F5 — Substitute workflow on backend eligibility
**Issues:** FE-P0-004
**Why fifth:** needs a new service method and a reworked modal; security-relevant but
self-contained, so it does not block F2–F4.
**Prerequisite:** F1.
**Files:** `substituteService.js`, `FreeTimetableMappingPage.js`
**Validation:** candidate list is byte-equal to `eligible-faculty`; exclusions shown.

### Phase F6 — Curriculum data and error/state handling
**Issues:** FE-P2-011, FE-P2-012, FE-P2-015, FE-P2-014
**Why sixth:** replaces hardcoded duplicates with backend data and surfaces structured codes. No
security or correctness risk to other phases.
**Validation:** no hardcoded course codes in the frontend; 409/429 render specific messages.

### Phase F7 — Accessibility & UX polish
**Issues:** FE-P2-013, FE-P2-017, FE-P2-018, A11Y-04, FE-P3-019, FE-P3-020, FE-P3-021
**Why last:** touches shared components (`Modal`, `Toast`) used by every page, so it needs the
feature set stable to avoid churn.
**Validation:** keyboard walkthrough of the allocation modal and approval flow; DOM audit shows
zero unlabeled controls.

### Phase F8 — Final QA and documentation
**Run:** `npm test` (frontend), the full acceptance checklist, a responsive pass at
1280/768/430/390/360, and re-run the backend suite to prove no regression. Create
`docs/frontend/AGENTS.md` (which does not yet exist) as part of this phase.

**Critical path:** F1 → F2 → F3 delivers the four P0/P1 user-visible corrections in roughly a
third of the total work. F4–F5 complete the product. F6–F8 are quality.
## 15. PHASE 21 — FRONTEND ACCEPTANCE CHECKLIST

### Functional
- [ ] `TC` login lands on `/coordinator/dashboard`; no 403 screen appears
- [ ] `AC` (legacy) still reaches the coordinator portal — no migration regression
- [ ] `FACULTY` receives 403 on `/coordinator/*`
- [ ] `HOD` receives 403 on `/coordinator/design` and `/timetable/generate*`
- [ ] `/faculty/weekly-timetable` and `/faculty/my-timetable` render their own pages
- [ ] TC can generate → review → submit → (HOD rejects) → redesign → resubmit
- [ ] HOD can approve and publish a `PENDING_HOD_APPROVAL` version
- [ ] Faculty can report an absence and see only eligible substitutes

### API contract
- [ ] Generate posts to `/timetable/generate-from-context` with only `academicContextId`
- [ ] No client-built `assignmentPlan` is transmitted
- [ ] Substitute candidates come from `/substitutes/eligible-faculty`, not `/faculty`
- [ ] Public class timetable calls `/timetable/published/:id`
- [ ] Version lists always include `academicContextId`
- [ ] `elective-candidates`, `elective-selection`, `review-matrix`, `context-status` and
      `design-context` are each consumed by the page that needs them
- [ ] No invented period count (`isLab ? 4 : 3` / bare `|| 3`) remains in frontend code

### RBAC
- [ ] Sidebar and route guards match backend `requireRole` for every role
- [ ] HOD sees no generate/session-mutation controls
- [ ] TC sees no approve/reject/publish controls
- [ ] FACULTY sees no allocation or approval controls
- [ ] Direct URL entry to a forbidden route shows 403, never a blank or partial render

### Context isolation
- [ ] Switching III-A → III-B never leaves III-A rows under the III-B header
- [ ] Every version/session rendered belongs to the selected `academicContextId`
- [ ] Rapid context switching never displays stale data
- [ ] Approval page shows one cohort only; row count matches that cohort
- [ ] The topbar academic year matches the selected context

### Timetable rendering
- [ ] A multi-faculty LAB cell shows every assigned faculty with role
- [ ] The `day × period` grid shape is **unchanged** (no duplicated cells/rows)
- [ ] Populated cell count equals the API `sessionCount`
- [ ] Sessions without `facultyAssignments` still render via scalar fallback
- [ ] Draft vs APPROVED vs PUBLISHED versions are visually distinguished
- [ ] A `SAT` session (if present) renders in the grid

### Responsive (1280 / 768 / 430 / 390 / 360)
- [ ] No page-level horizontal scroll at any breakpoint
- [ ] Timetable grid and wide tables scroll inside their container, not the page
- [ ] Modals are fully visible and operable at 360px
- [ ] Sidebar collapses to a drawer; all navigation remains reachable
- [ ] Touch targets remain usable on mobile

### Accessibility
- [ ] Every `input`/`select`/`textarea` has a `<label for>` or `aria-label`
- [ ] Modals move focus in, trap Tab, and restore focus on close
- [ ] Escape closes modals
- [ ] Status/error changes are announced via `aria-live`
- [ ] Focus indicators remain visible on all interactive elements
- [ ] Status is never conveyed by colour alone

### Error handling
- [ ] 401 clears the session and returns to `/login`
- [ ] 403 shows an explicit access-restricted state
- [ ] 404 shows a not-found state naming the resource
- [ ] 409 `TIMETABLE_VERSION_CONTEXT_MISMATCH` shows a context-mismatch message
- [ ] 429 `RATE_LIMIT_EXCEEDED` shows retry guidance
- [ ] 500 / network failure shows a retry action, not a bare message
- [ ] No workflow page shows a generic "No data" when the backend provides `nextAction`
- [ ] No optimistic status change for timetable governance state

### Regression
- [ ] `web`: `npm test` passes (5 suites)
- [ ] `backend`: `npm test` passes — **frontend work must change no backend result**
- [ ] Backend seed integrity unchanged: Course 119, R22 UG 109, Faculty 52, Workload 27
- [ ] `npm run build` (production webpack) succeeds
- [ ] No `.ts`/`.tsx` introduced; no `"type": "module"`; no new dependency added

### Security
- [ ] No protected faculty field (`facultyId`, `role`, `isActive`, calculated hours,
      `passwordHash`) is editable in the UI
- [ ] The login credential shortcut panel is absent from production builds
- [ ] No `dangerouslySetInnerHTML` anywhere
- [ ] Cross-context substitute requests are rejected/never offered

---

## 16. AUDIT LIMITATIONS AND HONEST CAVEATS

- **Read-only scope.** This was an audit. No frontend or backend source file was modified; the
  only file created is this report. All temporary probe scripts and server logs were removed and
  the working tree verified clean afterwards.
- **Live evidence is real but time-boxed.** Findings were reproduced against a running backend +
  frontend on one machine with one seeded dataset. Numbers (107 versions, 21 sessions, 11
  multi-faculty) are dataset-specific; the *defects* are structural and reproduce on any data.
- **Issue counts are as triaged, not absolute.** 26 compulsory changes (4 P0, 10 P1, 9 P2, 3 P3).
  A different auditor may merge closely related items (e.g. FE-P1-002/003/014 are three dead
  routes) or split others.
- **`docs/frontend/AGENTS.md` is absent**, so frontend-specific operating rules could not be
  audited against reality. `docs/frontend/ai/*` are byte-identical duplicates of root `docs/*`
  and should be reconciled before frontend work begins.
- **`backend/API.md` is absent** despite being mandatory reading per `docs/backend/AGENTS.md:43`.
  This report's contract map is derived from live routes + controllers and could serve as the
  starting point for that document.
- **No performance profiling** (bundle size, render counts, request timing) was performed beyond
  observing a 107-row table. Worth a separate pass if the approval table grows.
- **Third-party `.playwright-mcp/` artefacts** exist in the repo from earlier sessions; they are
  not part of the application and were left untouched.

---

## 17. FINAL VERIFICATION

| Check | Result |
|---|---|
| Working tree before audit | CLEAN |
| Working tree after audit | CLEAN apart from this new report |
| Frontend implementation files changed | **NONE** |
| Backend files changed | **NONE** |
| Database changes | **NONE** (read-only probes only) |
| Commits created | **NONE** |
| Files created | `docs/frontend/FRONTEND_FULL_AUDIT_AND_RECTIFICATION_REPORT.md` (this report) |

---

*Audit completed. No frontend fixes were implemented, as instructed. Implementation should begin
only after this report is reviewed, starting with Phase F1 (FE-P0-001).*
