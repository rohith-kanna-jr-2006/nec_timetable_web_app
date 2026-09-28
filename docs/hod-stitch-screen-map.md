# HOD Stitch Screen Map & Institutional Role Specification

**Project**: Academic Timetable Scheduler Prototype  
**Stitch Project ID**: `2431280884270750586` (`projects/2431280884270750586`)  
**Design System**: Academic Nexus (`assets/338929a72f9c4eb69f47996fda5f9e58`)  
**Institution**: Nandha Engineering College (Autonomous), Department of Computer Science and Engineering  
**Role Tier**: Level 01 Executive Authority (Head of Department / HOD)  

---

## Executive Authority & Responsibility Architecture

| Dimension | Head of Department (HOD) | Academic Coordinator (AC) | Teaching Faculty / Proctor |
| :--- | :--- | :--- | :--- |
| **Statutory Clearance** | **Level 01 Executive Authority** | **Level 02 Operational Authority** | **Level 03 Instructional Staff** |
| **Class Advisor Role** | **Final Sole Appointment Authority** | Suggests candidates / Operations | Assigned as Advisor or Proctor |
| **Course Allocation** | **Final Binding Assignment Authority** | Supplies Subject Handled Faculty input | Assigned course load / Views schedule |
| **Timetable Prep** | Reviews and audits compiled matrix | Operates constraint solver / Drafts grid | Views personal / class schedule |
| **Ratification / Sign-off** | **Statutory Ratification & Approval** | Submits draft for HOD sanction | Read-only viewer once published |
| **Release to ERP** | **Syndicate / CoE Release Authority** | Operational distribution | Personal calendar / ERP sync |

---

## Complete HOD Workflow

```
HOD Login (L1 Portal)
       ↓
HOD Dashboard (Executive Decision Desk)
       ↓
Select Academic Context (Dept, AY, Reg, Year, Sem, Cohort/Section)
       ↓
Class Advisor Assignment (Sole HOD Appointment Authority)
       ↓
Course Faculty Input Review (Audit AC Pool vs HOD Decision)
       ↓
HOD Faculty Allocation (Binding Course-to-Faculty Assignment)
       ↓
Allocation Review (Pre-Ratification Compliance Audit)
       ↓
Class Timetable Review (35-Period Cohort Matrix Inspection)
       ↓
HOD Timetable Approval (Statutory Ratification / Rejection)
       ↓
Approval Details (Official Decree, Digital Seal & ERP Release)
       ↓
HOD Notifications & Profile Management
```

---

## Detailed HOD Screen Specifications

### Screen 1: HOD Login — HOD Portal
- **HOD Screen Name**: `HOD Login - HOD Portal`
- **Stitch Screen ID**: `e0e52f5b161a4778a7b1afb18b2d3b02`
- **Classification**: **DERIVED**
- **Stitch Source Screen(s)**:
  - Faculty Login (`85a93b6d753245c99ec024abcd9b8f4a`)
  - AC Login (`fe2dc221c921483cb1938afc3d00e42b`)
- **Purpose**: Authenticate the Head of Department into the Level 01 Executive Portal, distinctly separating executive governance from AC operational and Faculty instructional access.
- **Major Reused Components**:
  - Institutional Nandha Engineering College crest & autonomous accreditation banner
  - Monospace ERP credentials container (`JetBrains Mono`)
  - Two-factor Duo authentication badge (`2FA DUO ACTIVE`)
  - Cross-portal navigation gateway cards (Switch to AC Portal, Switch to Faculty Portal)
- **Notes**: Explicitly enforces `PORTAL CLEARANCE LEVEL 01 • EXECUTIVE - HEAD OF DEPARTMENT (HOD) ACCESS` with administrative encryption indicators.

---

### Screen 2: HOD Dashboard — Academic Executive Desk
- **HOD Screen Name**: `HOD Dashboard - Academic Executive Desk`
- **Stitch Screen ID**: `11d7d50880f84387bed96851617795ea`
- **Classification**: **DERIVED**
- **Stitch Source Screen(s)**:
  - AC Dashboard (`280c6d5d66934998a255b3a9b1ebec56`)
  - Faculty Dashboard (`98e14e6f79994470b5570087ab068e64`)
- **Purpose**: Provide the HOD with an action-oriented, decision-focused command center over pending advisor ratifications, faculty allocation queues, and timetable approvals without generic analytics.
- **Major Reused Components**:
  - Executive identity profile banner (`Dr. S. Karthik, M.E., Ph.D.`) with institutional tags
  - Compact Bento status cards for Class Advisors, AC Course Inputs, Faculty Allocations, and Approvals
  - Urgent Decision Queue (review draft, ratify advisor, resolve allocation clash)
  - Departmental Section Timetable Status Tracker (III CSE A-D, IV CSE A-B)
  - Fixed 5-tab HOD Bottom Navigation (`Dashboard`, `Scope`, `Allocations`, `Timetable`, `Approvals`)
- **Notes**: Derived from the data-density of the AC Dashboard but elevates actions to executive decisions instead of matrix solver mechanics.

---

### Screen 3: Academic Context Selection — HOD Authority
- **HOD Screen Name**: `Academic Context Selection - HOD Authority`
- **Stitch Screen ID**: `14ea55151b904ec88d6cdc9abd9582fa`
- **Classification**: **DERIVED**
- **Stitch Source Screen(s)**:
  - AC Dashboard Header (`4623838586e143f193666324240e940f`)
  - Course Selection (`8accbc8ddd5146a28e67afa09bda7d42`)
- **Purpose**: Enable HOD to define and select the exact cohort scope (Department, Academic Year, Regulation, Academic Year Pill, Semester, and Section) that cascades into the downstream decision workflow.
- **Major Reused Components**:
  - Multi-tier segmented controls (Year I–IV, Semester V/VI)
  - Interactive cohort section cards with live status badges (Section A–D)
  - Target Cohort Summary Card for selected Section CSE-C
  - Deep Navy primary action button (`Confirm Context & Proceed to Class Advisor`)
- **Notes**: Formally anchors Section CSE-C (64 students, Room LH-204, Lead AC Mr. R. Manikandan) as the active design context.

---

### Screen 4: Class Advisor Assignment — HOD Decision
- **HOD Screen Name**: `Class Advisor Assignment - HOD Decision`
- **Stitch Screen ID**: `90f203571e624b2eb17c630076eec277`
- **Classification**: **DERIVED**
- **Stitch Source Screen(s)**:
  - Faculty Assignment & Review (`e4d256a305924ff7a877be4fca4e3ab4`)
  - Faculty Workload Validation (`000cbbd8aeeb403ebe1dd0e5f3c53d8f`)
- **Purpose**: Sole statutory assignment of Class Advisors to cohort sections by the Head of Department.
- **Major Reused Components**:
  - Vacant cohort indicator banner
  - Before-and-after executive appointment comparison card
  - Filterable faculty candidate roster with seniority metrics and teaching period load gauges
  - Radio card selection component highlighting appointed advisor `Dr. M. Deepa, M.E., Ph.D.` (10/16 Periods)
  - Official statutory appointment seal box dispatched to CoE & Dean Academics
- **Notes**: ACs do not possess Class Advisor assignment authority; this screen reinforces that this is strictly an HOD appointment decree.

---

### Screen 5: Course Faculty Input Review — AC Input vs HOD Decision
- **HOD Screen Name**: `Course Faculty Input Review - AC Input vs HOD Decision`
- **Stitch Screen ID**: `b6d3e5b4291546c3ac5d823722a35eb1`
- **Classification**: **DERIVED**
- **Stitch Source Screen(s)**:
  - Course Selection (`8accbc8ddd5146a28e67afa09bda7d42`)
  - Faculty Assignment & Review (`e4d256a305924ff7a877be4fca4e3ab4`)
- **Purpose**: Systematic review by HOD of operational course input submitted by the Academic Coordinator, contrasting suggested pools against unfinalized allocation states.
- **Major Reused Components**:
  - Operational boundary legend (`AC INPUT` advisory tag vs `HOD ASSIGNMENT` binding tag)
  - Course code and credit taxonomy tags (`22CSC14`, `22CSC15`, `22CSL05`, `22CSE08`)
  - AC recommendation containers with faculty workload gauges and past pass-rate notes
  - Amber dashed pending containers (`[ NOT ASSIGNED - PENDING HOD DECISION ]`)
  - Dual action buttons (`Proceed to HOD Allocation Desk` and `Request Revision from AC`)
- **Notes**: Visualizes that AC inputs are strictly advisory until ratified by HOD.

---

### Screen 6: HOD Faculty Allocation — Final Binding Assignment
- **HOD Screen Name**: `HOD Faculty Allocation - Final Binding Assignment`
- **Stitch Screen ID**: `b3f91214e9474173822a687153bc5c93`
- **Classification**: **DERIVED**
- **Stitch Source Screen(s)**:
  - Faculty Assignment & Review (`e4d256a305924ff7a877be4fca4e3ab4`)
  - Faculty Conflict & Regenerate (`d2a4aa6dd059480aa5884038cac1eb44`)
- **Purpose**: Execute the HOD's final binding faculty assignments for each theory, laboratory, and elective course in Section CSE-C.
- **Major Reused Components**:
  - Section-wise course allocation cards with faculty details and teaching workload calculation
  - Emerald `HOD APPOINTED` verified chips
  - Dual-faculty laboratory allocation structure (Lead In-Charge + Supporting Tutor)
  - Active faculty selection dropdown for elective `22CSE08` comparing candidate options
  - 16 Periods/Week AICTE workload compliance verification strip
- **Notes**: Reuses component styling from `e4d256a305924ff7a877be4fca4e3ab4` while replacing AC drafting controls with definitive HOD binding assignment controls.

---

### Screen 7: Allocation Review — HOD Pre-Ratification Audit
- **HOD Screen Name**: `Allocation Review - HOD Pre-Ratification Audit`
- **Stitch Screen ID**: `35e7f72d7eb2428983d5eeb08ec9003e`
- **Classification**: **DERIVED**
- **Stitch Source Screen(s)**:
  - Timetable Validation (`7c78a6890932491ba38153f1994ae03e`)
  - Faculty Assignment & Review (`e4d256a305924ff7a877be4fca4e3ab4`)
- **Purpose**: Comprehensive pre-ratification tabular and card audit of the complete 35-period department schedule allocations before timetable compilation.
- **Major Reused Components**:
  - Structured side-by-side audit rows comparing Course, Section, Periods, AC Advisory Input, and HOD Assigned Faculty
  - Status badges: `Assigned` (Emerald), `Needs Review` (Amber), `Pending` (Amber), `Conflict` (Red)
  - Filterable status pill bar (All, Assigned, Needs Review, Conflicts)
  - HOD Allocation Statutory Certification Box with cryptographic seal `#HOD-NEC-CSE-RATIFY-2024-V5`
  - Primary button: `Confirm Allocations & Generate Timetable`
- **Notes**: Status remains `Assigned` or `Needs Review` until HOD confirms; `Approved` is reserved for post-approval decree.

---

### Screen 8: Class Timetable Review — HOD Review Desk
- **HOD Screen Name**: `Class Timetable Review - HOD Review Desk`
- **Stitch Screen ID**: `81833f21c1e44b579b78297f5b75dd83`
- **Classification**: **DIRECT (Core Timetable Matrix) / DERIVED (Executive HOD Review Workflow)**
- **Stitch Source Screen(s)**:
  - Weekly Timetable - CSE-C (`e6b43399dae7404a8300e8bd71a92caf`)
- **Purpose**: Allow HOD to inspect the full 35-period timetable matrix generated from finalized allocations, reviewing each cell's subject, instructor, venue, and continuous lab blocks.
- **Major Reused Components**:
  - Day selector tabs (`MON` [Active], `TUE`, `WED`, `THU`, `FRI`, `SAT`)
  - Time rail column with period boundaries (P1 to P8)
  - Color-coded period cards:
    - Theory Slots: Deep Navy/Indigo tint (`#EEF2FF`, border `#C7D2FE`)
    - Laboratory Spans: Emerald/Teal cohesive tint (`#ECFDF5`, border `#A7F3D0`) for P5–P7
    - Elective / Skill Slots: Violet tint (`#FAF5FF`, border `#E9D5FF`)
    - Morning tea and lunch interval blocks (`#F1F5F9`)
  - Status pipeline banner (`PENDING HOD REVIEW` with pulsing indicator)
  - Solver engine verification card (0 conflicts, 0 venue clashes)
- **Notes**: Directly adapts the visual cell taxonomy of `e6b43399dae7404a8300e8bd71a92caf` into the HOD executive review context with ratification buttons.

---

### Screen 9: HOD Timetable Approval — Executive Ratification
- **HOD Screen Name**: `HOD Timetable Approval - Executive Ratification`
- **Stitch Screen ID**: `91218122c85b4d828a6ed37262a7a5b4`
- **Classification**: **DERIVED**
- **Stitch Source Screen(s)**:
  - Timetable Validation (`7c78a6890932491ba38153f1994ae03e`)
  - AC Dashboard (`280c6d5d66934998a255b3a9b1ebec56`)
- **Purpose**: The definitive executive authority interface where HOD sanctions or requests revision on the compiled class timetable.
- **Major Reused Components**:
  - Academic context cohort header with submission metadata
  - 6-metric Bento summary grid (Required Periods, Scheduled Periods, Free Periods, Faculty Conflicts, Venue Clashes, Solver Engine)
  - 4-point Autonomous Compliance Audit checklist (Continuous lab integrity, Advisor contact, AICTE workload ceiling, Room dedication)
  - Executive remarks input field & legal declaration checkbox for Dr. S. Karthik, HOD
  - High-emphasis primary CTA: `APPROVE TIMETABLE` (Solid Deep Navy) & `REJECT / REQUEST REVISION` (Crimson outline)
- **Notes**: Communicates absolute final authority; approvals cannot be made by AC or Faculty.

---

### Screen 10: Approval Details — HOD Ratified Order
- **HOD Screen Name**: `Approval Details - HOD Ratified Order`
- **Stitch Screen ID**: `d2b0fb398c5d4d83b15f35f66009159c`
- **Classification**: **DERIVED**
- **Stitch Source Screen(s)**:
  - AC Dashboard Publish Confirmation (`280c6d5d66934998a255b3a9b1ebec56`)
  - Timetable Validation (`000cbbd8aeeb403ebe1dd0e5f3c53d8f`)
- **Purpose**: Official decree screen certifying completed HOD ratification, displaying executive signature metadata, SHA-256 audit hash, and distribution timeline.
- **Major Reused Components**:
  - Hero Deep Navy ratification decree card with emerald verified emblem and `APPROVED BY HOD` headline
  - Formal approval timestamp (`20 Sep 2024, 11:45 AM IST`) and approver credentials
  - Academic metadata summary grid
  - Institutional distribution milestone tracker (Drafting $\rightarrow$ Allocation $\rightarrow$ HOD Ratification $\rightarrow$ Live ERP Release)
  - HOD executive remarks circular quote box
  - Actions: `Download Official Signed PDF` and `Share Circular to Faculty & Students`
- **Notes**: Displayed only post-approval; conveys authoritative permanence and syndicate audit readiness.

---

### Screen 11: HOD Notifications — Executive Action Center
- **HOD Screen Name**: `HOD Notifications - Executive Action Center`
- **Stitch Screen ID**: `c954ea1f2ab343f183cfa20676725479`
- **Classification**: **DERIVED**
- **Stitch Source Screen(s)**:
  - Faculty Notifications (`fea03d98bf864bba82b281436c309354`)
- **Purpose**: Department-wide executive alert center routing HOD-specific approvals, allocation clash notices, advisor vacancies, and AC revision progress.
- **Major Reused Components**:
  - Horizontal filter carousel with category count pills (`All`, `Approvals`, `Allocations`, `Advisors`, `Revisions`)
  - High-density notification cards with category chips, relative timestamps, and unread indicator dots
  - One-tap executive action triggers (`Review & Ratify Timetable →`, `Confirm Allocation →`, `Appoint Advisor →`)
  - Cryptographic administrative ledger notice
  - HOD Bottom Navigation Bar with pending alerts counter
- **Notes**: Derived from `fea03d98bf864bba82b281436c309354`, but restructures categories and actions around HOD executive responsibilities.

---

### Screen 12: HOD Profile — Institutional Executive Identity
- **HOD Screen Name**: `HOD Profile - Institutional Executive Identity`
- **Stitch Screen ID**: `6b499dba3ac9499188ed07d2f653517d`
- **Classification**: **DERIVED**
- **Stitch Source Screen(s)**:
  - Faculty Dashboard Header & Settings (`98e14e6f79994470b5570087ab068e64`)
  - AC Dashboard Header (`280c6d5d66934998a255b3a9b1ebec56`)
- **Purpose**: Showcase the Head of Department's institutional credentials, office contact directory, statutory delegation privileges, and security preferences.
- **Major Reused Components**:
  - Executive Identity Hero Bento Card with `SK` monogram and Level 01 authority badges
  - Official Department Executive Office directory (Room 101, IT Block II, extension, office hours)
  - Statutory Authority & Delegation breakdown (Advisor ratification, faculty allocation, timetable approval, syndicate key)
  - Security & preference controls (2FA Duo enforcement, AICTE 16-period conflict thresholds, daily health digest)
  - Active workstation LAN session telemetry and full-width Sign Out action
- **Notes**: Concludes the HOD interface suite with full institutional dignity and administrative clarity.

---

## Stitch Screen Catalog Reference

| # | Screen Name | Screen ID | Classification | Device Type | Status |
| :-: | :--- | :--- | :-: | :-: | :-: |
| 1 | `HOD Login - HOD Portal` | `e0e52f5b161a4778a7b1afb18b2d3b02` | DERIVED | Mobile | Verified in Stitch |
| 2 | `HOD Dashboard - Academic Executive Desk` | `11d7d50880f84387bed96851617795ea` | DERIVED | Mobile | Verified in Stitch |
| 3 | `Academic Context Selection - HOD Authority` | `14ea55151b904ec88d6cdc9abd9582fa` | DERIVED | Mobile | Verified in Stitch |
| 4 | `Class Advisor Assignment - HOD Decision` | `90f203571e624b2eb17c630076eec277` | DERIVED | Mobile | Verified in Stitch |
| 5 | `Course Faculty Input Review - AC Input vs HOD Decision` | `b6d3e5b4291546c3ac5d823722a35eb1` | DERIVED | Mobile | Verified in Stitch |
| 6 | `HOD Faculty Allocation - Final Binding Assignment` | `b3f91214e9474173822a687153bc5c93` | DERIVED | Mobile | Verified in Stitch |
| 7 | `Allocation Review - HOD Pre-Ratification Audit` | `35e7f72d7eb2428983d5eeb08ec9003e` | DERIVED | Mobile | Verified in Stitch |
| 8 | `Class Timetable Review - HOD Review Desk` | `81833f21c1e44b579b78297f5b75dd83` | DIRECT / DERIVED | Mobile | Verified in Stitch |
| 9 | `HOD Timetable Approval - Executive Ratification` | `91218122c85b4d828a6ed37262a7a5b4` | DERIVED | Mobile | Verified in Stitch |
| 10 | `Approval Details - HOD Ratified Order` | `d2b0fb398c5d4d83b15f35f66009159c` | DERIVED | Mobile | Verified in Stitch |
| 11 | `HOD Notifications - Executive Action Center` | `c954ea1f2ab343f183cfa20676725479` | DERIVED | Mobile | Verified in Stitch |
| 12 | `HOD Profile - Institutional Executive Identity` | `6b499dba3ac9499188ed07d2f653517d` | DERIVED | Mobile | Verified in Stitch |
