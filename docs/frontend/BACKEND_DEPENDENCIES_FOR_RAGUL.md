# BACKEND DEPENDENCIES FOR RAGUL

**From:** Rohith Kanna (Frontend Developer)
**To:** Ragul (Backend Developer & System Integrator)
**Date:** October 2026
**Context:** Handoff following complete frontend rectification on branch `rohith-frontend`.

---

## 1. Overview

During the frontend rectification, all 26 audit findings were addressed within frontend boundaries (`web/**`). No backend source code was changed. The frontend has been refactored to consume the backend's authoritative endpoints instead of inventing local business rules.

The following notes outline the genuine backend contracts and runtime expectations that Ragul should be aware of during full-stack integration and testing.

---

## 2. Authoritative Endpoints Now Actively Consumed by Frontend

The frontend now calls the following endpoints that were previously marked as `UNUSED` or bypassed:

| Endpoint | Method | Frontend Consumer | Expected Envelope / Behavior |
|---|---|---|---|
| `/api/timetable/generate-from-context` | `POST` | `OptimizationSolverPage.js` | Accepts `{ academicContextId }`. Server re-derives courses, faculty, and periods, solves CSP, and returns `{ timetableVersion, sessionsCreated }`. Protected by TC/AC role and rate limiter. |
| `/api/timetable/design-context/:id` | `GET` | `OptimizationSolverPage.js` | Returns `{ academicContext, regulation, curriculumSemester, readiness, electiveSelection, currentVersion, courses[] }`. |
| `/api/hod-allocations/validate/:id` | `GET` | `OptimizationSolverPage.js` | Returns `{ academicContextId, cohort, readyForGeneration, totalRequiredCourses, allocatedCount, details[] }`. Controls the enabled state of the Generate button. |
| `/api/substitutes/affected-sessions` | `GET` | `FreeTimetableMappingPage.js` | Accepts `absenceId`, `academicContextId`, `date`. Returns `{ sessions: [...] }`. |
| `/api/substitutes/eligible-faculty` | `GET` | `FreeTimetableMappingPage.js` | Accepts `timetableSessionId`, `absenceId`, `academicContextId`, `date`. Returns `{ eligibleCount, eligibleFaculty: [...] }`. Excludes absent and busy faculty server-side. |
| `/api/timetable/published/:id` | `GET` | `ClassTimetablePage.js` | Returns `{ isPublished, message, sessions[] }`. Default/public class timetable view now uses this endpoint exclusively. |
| `/api/timetable/review-matrix` | `GET` | `TimetableReviewPage.js` | Returns `{ sessionCount, summary, sessions[] }`. Header metrics consume `summary`. |
| `/api/courses/curriculum/r22` | `GET` | `RegulationPage.js` | Returns `{ curriculumCode, regulation, courses[], electiveSlotMap, pecVerticals, ... }`. Frontend has eliminated hardcoded `ELECTIVE_SLOTS_DATA`. |

---

## 3. Seed Data & Role Consistency

1. **TC Account (`role: 'TC'`):**
   - The frontend login page now includes a dedicated one-click shortcut for `tc@nec.edu.in`.
   - The backend seed script (`seedUsers.js`) must ensure `tc@nec.edu.in` has `role: 'TC'` and a valid `facultyId` (e.g. `'FWL-22'`).
   - The coordinator route guards accept `['TC', 'AC', 'ADMIN']` during the deprecation period for `AC`.
2. **Multi-Faculty Session Payloads:**
   - Multi-faculty lab sessions (e.g., `22MAN8R`, `22CSP09`, `22CSP10`) must contain `facultyAssignments: [ { facultyId, role, facultyName } ]` on every session object.
   - The frontend SessionCell renderer preserves these without creating duplicate cell elements.

---

## 4. Structured Error Codes

The frontend now maps structured backend error codes through `describeError(error)` (`web/src/services/api.js`). Please preserve the standard error envelope:
```json
{
  "success": false,
  "code": "ERROR_CODE_CONSTANT",
  "message": "Human readable explanation",
  "details": {}
}
```
Specific codes mapped for user-friendly UI presentation:
- `RATE_LIMIT_EXCEEDED` (HTTP 429) → Surfaces retry-after notification.
- `TIMETABLE_VERSION_CONTEXT_MISMATCH` (HTTP 409) → Notifies user of cross-context stale version.
- `SESSION_CONTEXT_MISMATCH` (HTTP 409) → Warns user if an affected session belongs to a different academic context.
- `SESSION_NOT_FOUND` (HTTP 404) → Informs user that the timetable session was rescheduled or removed.
- `ABSENCE_NOT_FOUND` (HTTP 404) → Handles missing absence records gracefully.
- `FORBIDDEN` (HTTP 403) → Standard access restriction banner.

---

## 5. Items Not Changed on Backend

- No database migrations, schemas, or seed structures require modifications for this frontend release.
- The solver engine and CSP constraints were not modified.
- All backend unit and integration test suites should run with zero regressions.
