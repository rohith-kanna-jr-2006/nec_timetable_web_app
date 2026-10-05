# PLAYWRIGHT TEST HANDOFF FOR RAGUL

**From:** Rohith Kanna (Frontend Developer)
**To:** Ragul (Backend & E2E Validation)
**Date:** October 2026
**Context:** Comprehensive Playwright test scenario specification for validating frontend rectification changes against a running stack (`localhost:5000` backend + `localhost:3002` webpack dev server).

---

## 1. Overview of Key Changes

The frontend has been updated across 26 specific findings. The following routes and pages have changed functional behavior and should be verified with automated Playwright browser tests:

- `/login` → Quick preset added for `TC`; credentials panel gated to non-production.
- `/coordinator/*` → Role guard accepts `TC`; TC landing redirects to `/coordinator/dashboard`.
- `/coordinator/design` (`OptimizationSolverPage.js`) → Uses authoritative `GET /timetable/design-context/:id` and `POST /timetable/generate-from-context`.
- `/coordinator/free-mapping` (`FreeTimetableMappingPage.js`) → Uses `GET /substitutes/affected-sessions` and `GET /substitutes/eligible-faculty`.
- `/hod/approval` (`TimetableApprovalPage.js`) → Context selector limits rows to selected cohort; accessible rejection modal replaces `window.prompt`.
- `/hod/timetable-review` (`TimetableReviewPage.js`) → Multi-faculty chips rendered in single cell; TC "Submit to HOD" action enabled.
- `/faculty/class-timetable` (`ClassTimetablePage.js`) → Uses `GET /timetable/published/:id`; multi-faculty chips rendered in single cell.
- `/faculty/weekly-timetable` (`WeeklyTimetablePage.js`) → Route activated; multi-faculty chips rendered in single cell.
- `/faculty/my-timetable` (`MyTimetablePage.js`) → Route activated; multi-faculty co-teaching cards rendered.
- `/hod/regulation` (`RegulationPage.js`) → Dynamic curriculum overview from `GET /courses/curriculum/r22`.

---

## 2. Test Scenarios by Role

### Scenario 1: TimeTable Coordinator (TC) Workflow (FE-P0-001, FE-P1-006, FE-P1-007, FE-P1-009, FE-P1-014)

1. **Login:**
   - Navigate to `http://localhost:3002/login`.
   - Click the "TimeTable Coordinator (TC)" preset button (or enter `tc@nec.edu.in` / `Password123!`).
   - Click "Sign In".
   - **Assert:** URL resolves to `http://localhost:3002/coordinator/dashboard`.
   - **Assert:** No `HTTP 403 - ACCESS RESTRICTED` screen appears.
   - **Assert:** Sidebar displays "TimeTable Coordinator (TC)" badge and full TC navigation roster.

2. **Timetable Design & Generation:**
   - Navigate to `/coordinator/design`.
   - Select Year: `III Year`, Semester: `Semester V`, Section: `Section A`.
   - **Assert:** Network tab captures `GET /api/timetable/design-context/:academicContextId` and `GET /api/hod-allocations/validate/:academicContextId`.
   - **Assert:** Generate button disabled status accurately reflects `readyForGeneration`.
   - Click "Generate Timetable".
   - **Assert:** Network tab sends `POST /api/timetable/generate-from-context` with payload `{ academicContextId }` (no client-built `assignmentPlan`).
   - **Assert:** Success card appears showing generated version label and scheduled period count.

3. **Timetable Review & Submission to HOD:**
   - Click "Open Review Matrix" (or navigate to `/coordinator/view?academicContextId=...`).
   - **Assert:** Timetable grid renders with sessions.
   - **Assert:** Multi-faculty course (e.g. `22MAN8R`) renders all assigned faculty chips (`MAT-001` and `ENG-001`) within a single grid cell.
   - Click "Submit to HOD".
   - **Assert:** Network tab captures `PATCH /api/timetable/version/:id/status` with `{ status: "PENDING_HOD_APPROVAL" }`.
   - **Assert:** Toast notification confirms successful submission.

---

### Scenario 2: Head of Department (HOD) Context Scoping & Approval (FE-P0-002, A11Y-04)

1. **Context-Isolated Approval Desk:**
   - Login as `hod@nec.edu.in` / `Password123!`.
   - Navigate to `/hod/approval`.
   - **Assert:** Topbar context selector exists.
   - Select cohort `III Year - Semester V - Section A`.
   - **Assert:** Table row count displays only versions belonging to the selected context (significantly fewer than 107 rows).
   - Switch to `III Year - Semester V - Section B`.
   - **Assert:** Version list immediately clears, shows loading, and repopulates strictly with Section B versions.
   - **Assert:** No foreign cohort rows leak into the displayed table.

2. **Accessible Rejection Flow:**
   - For a `PENDING_HOD_APPROVAL` version, click "Reject".
   - **Assert:** Accessible `<Modal>` opens with focus trapped inside.
   - **Assert:** `window.prompt` is NOT triggered.
   - Type rejection remarks: `"Adjust laboratory hours for section conflict."`
   - Click "Confirm Rejection".
   - **Assert:** Status transitions to `REJECTED` and remarks are recorded.

---

### Scenario 3: Authoritative Substitute Mapping (FE-P0-004)

1. **Eligible Faculty Allocation:**
   - Login as `tc@nec.edu.in`.
   - Navigate to `/coordinator/free-mapping`.
   - Click "New Substitute Mapping".
   - Select a reported faculty absence.
   - **Assert:** Network tab calls `GET /api/substitutes/affected-sessions`.
   - **Assert:** Affected sessions dropdown populates with specific timetable slots.
   - Select an affected session.
   - **Assert:** Network tab calls `GET /api/substitutes/eligible-faculty`.
   - **Assert:** Network tab does NOT query `GET /api/faculty`.
   - **Assert:** The substitute faculty dropdown lists only backend-verified eligible candidates (absent faculty and conflicting faculty are excluded).
   - If zero faculty are free, verify the alert: *"Zero eligible substitute faculty available for this session slot"*.

---

### Scenario 4: Faculty Timetable & Route Integrity (FE-P1-002, FE-P1-005, FE-P1-010)

1. **Published-Only Class Timetable:**
   - Login as `faculty@nec.edu.in`.
   - Navigate to `/faculty/class-timetable`.
   - **Assert:** Network tab calls `GET /api/timetable/published/:id`.
   - **Assert:** If no version is published, an informative empty state displays without crashing.
   - **Assert:** Multi-faculty sessions show co-instructors in a single table cell.

2. **Weekly Grid & My Timetable Routes:**
   - Navigate to `/faculty/weekly-timetable`.
   - **Assert:** Page loads `WeeklyTimetablePage` (does not redirect to `/faculty/class-timetable`).
   - Navigate to `/faculty/my-timetable`.
   - **Assert:** Page loads `MyTimetablePage` and user remains authenticated (does not redirect to `/login`).

---

### Scenario 5: Legacy AC Compatibility (Regression Check)

1. **AC User Routing:**
   - Login as `ac@nec.edu.in` / `Password123!`.
   - **Assert:** Redirects to `/coordinator/dashboard`.
   - **Assert:** Can access `/coordinator/design`, `/coordinator/view`, and `/coordinator/free-mapping` without 403.

---

## 3. Responsive Breakpoint Checks

Run mobile emulation across the following viewport dimensions:

| Width × Height | Device Profile | Expected Result |
|---|---|---|
| **1280 × 720** | Desktop Standard | Full grid table, sidebar open, no horizontal page scroll. |
| **1024 × 768** | Tablet Landscape | Navigation links accessible, cards wrap cleanly. |
| **768 × 1024** | Tablet Portrait | Sidebar collapses to drawer toggle; timetable scrolls inside `.ui-table-scroll-container`. |
| **430 × 932** | Large Mobile (iPhone 14 Pro Max) | Topbar collapses cleanly; modal inputs stack vertically. |
| **390 × 844** | Medium Mobile (iPhone 12/13/14) | No page-level overflow (`document.documentElement.scrollWidth === window.innerWidth`). Timetable grid scrolls within container. |
| **360 × 800** | Small Mobile (Android Standard) | Modal fits viewport, buttons remain touch-accessible (min 44px height). |

---

## 4. Accessibility & ARIA Checks

- [ ] Open any modal (`Modal.js`): verify Tab loops inside modal and Escape closes it.
- [ ] Close modal: verify focus returns to trigger button.
- [ ] Trigger a toast notification: verify `aria-live="polite"` or `aria-live="assertive"` is present on the toast container.
- [ ] Inspect form `<Select>` elements: verify all controls have associated `<label for>` or `aria-label`.
- [ ] Inspect submit buttons during loading: verify `aria-busy="true"` attribute.
