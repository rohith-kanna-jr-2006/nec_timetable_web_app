# Stitch Screen Mapping

## Screen 1: App Entry & Splash
- App Route: `/` (`app/index.js`)
- Screen Name: App Entry / Splash
- Stitch Source: Project Theme & Institutional Branding
- Stitch Screen ID: `2431280884270750586`
- Type: DERIVED
- React Native File: `app/index.js`
- Notes: Serves as the native app entrypoint with institutional badge, autonomous status, and quick direct routing to Login or Faculty Dashboard.

## Screen 2: Faculty Sign In
- App Route: `/(auth)/login` (`app/(auth)/login.js`)
- Screen Name: Faculty Login - Faculty Portal
- Stitch Source: Google Stitch Project Screen
- Stitch Screen ID: `85a93b6d753245c99ec024abcd9b8f4a`
- Type: DIRECT
- React Native File: `app/(auth)/login.js`
- Notes: 1:1 mobile translation of the Stitch login interface with institutional crest, staff ERP indicator, 2FA status, password visibility toggle, switch to AC view, and demo authentication flow.

## Screen 3: Faculty Dashboard
- App Route: `/(faculty)/dashboard` (`app/(faculty)/dashboard.js`)
- Screen Name: Faculty Dashboard - Faculty Portal
- Stitch Source: Google Stitch Project Screen
- Stitch Screen ID: `98e14e6f79994470b5570087ab068e64`
- Type: DIRECT
- React Native File: `app/(faculty)/dashboard.js`
- Notes: Direct mobile port of the complete Faculty Dashboard including Identity Card (`CSE-FAC-042`), Hero Next Class card ("Starts in 45m"), 7-period timeline breakdown, quick timetable strip, assigned course metrics (`22CSX42`), and workload gauge (`6/16 Periods`).

## Screen 4: Faculty Timetable (Personal Faculty Schedule)
- App Route: `/(faculty)/timetable` (`app/(faculty)/timetable.js`)
- Screen Name: My Timetable - Ms. C. Navamani
- Stitch Source: Google Stitch Project Screen
- Stitch Screen ID: `8ee20fde33234b37ad58c40a7eaadbab`
- Type: DIRECT
- React Native File: `app/(faculty)/timetable.js`
- Notes: Direct implementation of personal timetable view projected strictly from `MASTER_TIMETABLE_SESSIONS.filter(facultyId)`. Features dynamic version governance badge (`DRAFT / PENDING HOD APPROVAL` vs `OFFICIAL • PUBLISHED`), Today vs Weekly view switchers, day filter chips (`All`, `Mon`, `Tue`, `Wed`, `Thu`, `Fri`), and free day empty states.

## Screen 5: Class Timetable (Class Cohort Grid)
- App Route: `/(faculty)/weekly-timetable` (`app/(faculty)/weekly-timetable.js`)
- Screen Name: Weekly Timetable - CSE-C
- Stitch Source: Google Stitch Project Screen
- Stitch Screen ID: `e6b43399dae7404a8300e8bd71a92caf`
- Type: DIRECT (Core Matrix) / DERIVED (Multi-Context Governance Extensions)
- React Native File: `app/(faculty)/weekly-timetable.js`
- Notes: 35-period weekly timetable matrix projected strictly from `MASTER_TIMETABLE_SESSIONS.filter(classSection)`. Features academic context indicators (Dept, Year, Sem, Sec), live HOD Approval status banner (`PENDING HOD APPROVAL` / `APPROVED` / `PUBLISHED`), continuous 4-period laboratory blocks (`22CSP09`, `22CSP10`), morning/lunch/evening break ribbons, and day filter chips.

## Screen 6: Faculty Workload & Timetable Validation
- App Route: `/(faculty)/workload` (`app/(faculty)/workload.js`)
- Screen Name: Faculty Timetable Validation - Faculty Portal
- Stitch Source: Google Stitch Project Screen
- Stitch Screen ID: `000cbbd8aeeb403ebe1dd0e5f3c53d8f`
- Type: DIRECT
- React Native File: `app/(faculty)/workload.js`
- Notes: Direct conversion of the 5-point Audit Integrity Protocol (Conflict check, Institutional release, Break integrity, Curriculum match, and Workload compliance) with progress ring, metadata grid, and collapsible session breakdown.

## Screen 7: Faculty Notifications & Alerts
- App Route: `/(faculty)/notifications` (`app/(faculty)/notifications.js`)
- Screen Name: Faculty Notifications - Faculty Portal
- Stitch Source: Google Stitch Project Screen
- Stitch Screen ID: `fea03d98bf864bba82b281436c309354`
- Type: DIRECT
- React Native File: `app/(faculty)/notifications.js`
- Notes: Direct implementation of the notification stream with unread counter badges, filter chips (`All`, `Unread`, `Timetable`, `Assignment`, `Academic`), dismiss actions, and interactive navigation links.

## Screen 8: Faculty Profile & Academic Settings
- App Route: `/(faculty)/profile` (`app/(faculty)/profile.js`)
- Screen Name: Faculty Profile - Staff Information Desk
- Stitch Source: Adapted from Stitch Faculty Identity tokens and institutional ERP metadata
- Stitch Screen ID: DERIVED from `98e14e6f79994470b5570087ab068e64` & `8ee20fde33234b37ad58c40a7eaadbab`
- Type: DERIVED
- React Native File: `app/(faculty)/profile.js`
- Notes: Comprehensive profile screen showing verified academic credentials, contact details, assigned teaching load summary, calendar sync settings, and sign-out action.

## Screen 9: Academic Coordinator Dashboard
- App Route: `/coordinator` (`app/coordinator/index.js`)
- Screen Name: AC Dashboard - Academic Coordinator Desk
- Stitch Source: Google Stitch Project Screen
- Stitch Screen ID: `280c6d5d66934998a255b3a9b1ebec56` & `4623838586e143f193666324240e940f`
- Type: DIRECT
- React Native File: `app/coordinator/index.js`
- Notes: Academic Coordinator command console displaying cohort selection, 35/35 matrix load, allocation readiness alerts, quick statistics bento, and direct CTA to start timetable generation pipeline.

## Screen 10: Course Selection & Verification
- App Route: `/coordinator/course-selection` (`app/coordinator/course-selection.js`)
- Screen Name: Course Selection - CSE-C
- Stitch Source: Google Stitch Project Screen
- Stitch Screen ID: `8accbc8ddd5146a28e67afa09bda7d42`
- Type: DIRECT
- React Native File: `app/coordinator/course-selection.js`
- Notes: R2022 curriculum course verification screen covering 12 required courses (3 Theory, 2 Lab, 1 SAS, 3 Electives, 3 Other), credit allocations, contact hours, and proceed action to Faculty Allocation.

## Screen 11: Faculty Allocation & Review
- App Route: `/coordinator/faculty-assignment` (`app/coordinator/faculty-assignment.js`)
- Screen Name: Faculty Assignment & Review
- Stitch Source: Google Stitch Project Screen
- Stitch Screen ID: `e4d256a305924ff7a877be4fca4e3ab4`
- Type: DIRECT
- React Native File: `app/coordinator/faculty-assignment.js`
- Notes: Authoritative course-level faculty assignment console enforcing Rule A (Theory solo), Rule B (Lab theory-linked primary + additional staff), Rule C (SAS min 2 faculty), and Rule D (Other Staff's Handled 1/2/3 staff).

## Screen 12: Optimization Progress & Solver
- App Route: `/coordinator/optimization` (`app/coordinator/optimization.js`)
- Screen Name: Optimization Progress
- Stitch Source: Google Stitch Project Screen
- Stitch Screen ID: `118edde1dd874a4e9626a5ff12a3ae69`
- Type: DIRECT
- React Native File: `app/coordinator/optimization.js`
- Notes: Animated constraint solver engine progress screen tracking pipeline stages, showing calculated generation output metrics (Required: 35, Scheduled: 35, Free: 0, Conflicts: 0), and routing to Validation & Approval.

## Screen 13: Timetable Validation & HOD Approval
- App Route: `/coordinator/validation` (`app/coordinator/validation.js`)
- Screen Name: Timetable Validation - CSE-C
- Stitch Source: Google Stitch Project Screen
- Stitch Screen ID: `7c78a6890932491ba38153f1994ae03e`
- Type: DIRECT (Audit Layout) / DERIVED (HOD Approval State & Simulation Controls)
- React Native File: `app/coordinator/validation.js`
- Notes: Institutional compliance engine verifying 6/6 Hard Constraints & 4/4 Soft Optimizations. Integrated with live TimetableVersion governance model, AC "Submit for HOD Approval" action, clearly labeled `DEMO HOD APPROVAL` controls (Approve / Reject), and conditional "Publish Class Timetable" action.

## Screen 14: Faculty Conflict Simulation & Regenerate
- App Route: `/coordinator/conflict` (`app/coordinator/conflict.js`)
- Screen Name: Faculty Conflict & Regenerate
- Stitch Source: Google Stitch Project Screen
- Stitch Screen ID: `d2a4aa6dd059480aa5884038cac1eb44`
- Type: DIRECT
- React Native File: `app/coordinator/conflict.js`
- Notes: Diagnostic simulation tool displaying collision impact analysis across smart classrooms, conflicting slot inspection, and atomic re-optimization trigger.
