# RAGUL — PERMANENT TESTING RULES

## Roles & Ownership
- **Ragul**:
  - Backend
  - Database
  - API
  - Business Logic
  - Frontend Testing
  - Playwright
  - E2E
  - Integration
  - Regression
  - Heavy validation
  - Workloads: Playwright matrix, Docker, Docker Compose, backend, MongoDB, full regression, performance testing, heavy builds, large scripts
- **Rohith**:
  - Frontend implementation ownership (React files, CSS, Webpack/frontend configs, etc.)
  - Rohith's 8 GB RAM environment must not be burdened with heavy testing workloads unless unavoidable.

---

## RULE 1 — TEST BEFORE MODIFY
During an initial testing/audit pass:
- **DO NOT modify source code.**
- Especially do not modify:
  - React files
  - CSS
  - webpack config
  - frontend configuration
  - backend configuration
- Initial pass must strictly follow:
  **OBSERVE → RECORD → REPORT**
- Only after Rohith implements a fix should Ragul re-test it.

---

## RULE 2 — NEVER TEST A MODIFIED BASELINE
- The application under audit must remain unchanged during the baseline test.
- If any file is modified accidentally:
  1. **STOP.**
  2. Record:
     - file
     - change
     - reason
  3. Establish a clean known baseline before continuing.
- Never report a modified application as an unmodified baseline.

---

## RULE 3 — SEPARATE TEST PASSES
- **PASS 1**: Baseline audit — no modifications.
- **PASS 2**: Rohith frontend implementation/fixes.
- **PASS 3**: Playwright regression validation.
- Never mix these phases.

---

## RULE 4 — AUTHENTICATION
- Prefer real browser login through the UI for E2E tests.
- Do not bypass authentication using manually generated JWTs unless performing a clearly labeled API/backend-only test.
- Never expose secrets in reports.
- Never hardcode or print production secrets.

---

## RULE 5 — TEST DATA SAFETY
- Never delete records based only on guessed IDs.
- When creating test data:
  - Use identifiable test data.
  - Use unique test email/name where appropriate.
  - Record created identifier.
  - Clean up only the exact test record.
- Never risk deleting existing production/master data.

---

## RULE 6 — SOURCE OF TRUTH
- Use the real repository and current runtime behavior.
- Do not infer behavior from filenames or branch names.
- Worktree names are NOT task definitions.

---

## RULE 7 — BROWSER EVIDENCE
- For UI claims, prefer:
  - Playwright browser evidence
  - Screenshot
  - Snapshot
  - Geometry checks where appropriate
- Do not declare browser success from source inspection alone.

---

## RULE 8 — CLEAR EVIDENCE TYPES
Every finding must identify its evidence category:
- `BROWSER VERIFIED`
- `API VERIFIED`
- `DATABASE VERIFIED`
- `SOURCE CONFIRMED`
- `INFERRED`
- `NOT VERIFIED`
- Do not mix these categories.

---

## RULE 9 — REPORT ACCOUNTING
- Before finalizing a report, reconcile all counts.
- Ensure:
  - Total routes = `Implemented` + `Placeholder` + `Missing` + `Blocked`
  - Viewport counts must equal the actual matrix.
  - `PASS` + `MINOR` + `MAJOR` + `BROKEN` + `BLOCKED` must equal the total evaluated checks.
- Do not publish contradictory numbers.

---

## RULE 10 — DO NOT CALL A FAILED AUDIT A SUCCESS
- Distinguish `AUDIT COMPLETE` from `AUDIT PASSED`.
- Example: *"Responsive audit completed; mobile acceptance criteria failed."*
- Do not say the UI is complete when P0/P1 defects remain.

---

## RULE 11 — PHASE AWARENESS
- A planned placeholder is `NOT IMPLEMENTED — EXPECTED`, not automatically a `BUG`.
- Only mark it as a defect when it is required by the current project phase.

---

## RULE 12 — UX RECOMMENDATION VS BUG
- Separate `REQUIRED DEFECT` from `UX IMPROVEMENT`.
- Do not call a recommendation a verified product failure unless an explicit requirement or acceptance criterion supports it.

---

## RULE 13 — NO SILENT FRONTEND FIXES
- If a frontend defect is found: **Report it to Rohith.**
- Do not silently edit frontend implementation during an audit.
- If an emergency temporary runtime workaround is required for testing, document it explicitly and do not include it as a product fix.

---

## RULE 14 — HEAVY WORKLOAD
- Ragul handles:
  - Playwright matrix
  - Docker & Docker Compose
  - Backend & MongoDB
  - Full regression & integration tests
  - Performance testing
  - Heavy builds & large scripts
- Protect Rohith's 8 GB RAM environment from heavy workloads unless unavoidable.

---

## RULE 15 — FINAL REPORT STRUCTURE
Every report must contain:
1. Environment
2. Baseline state
3. Scope
4. Test matrix
5. Evidence
6. PASS
7. FAIL
8. Missing
9. Blocked
10. Changes made during test — if any
11. Regression status
12. Exact counts
13. Rohith action items
14. Re-test plan

Never claim a result that was not actually verified.

---

## FINAL PRINCIPLE
> **DO NOT CHANGE WHAT YOU ARE TRYING TO MEASURE.**  
> Freeze the baseline → Measure it → Report it → Let Rohith fix frontend issues → Re-test.
