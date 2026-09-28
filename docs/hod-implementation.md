# HOD Interface React Native Implementation Specification

**Project**: Academic Timetable Scheduler Prototype  
**Institution**: Nandha Engineering College (Autonomous), Department of Computer Science and Engineering  
**Role Tier**: Level 01 Executive Authority (Head of Department / HOD)  
**Stitch Source Project ID**: `2431280884270750586` (`projects/2431280884270750586`)  
**Design System**: Academic Nexus (`assets/338929a72f9c4eb69f47996fda5f9e58`)  

---

## 1. Statutory Role Architecture

```
                                  ┌──────────────────────────────┐
                                  │   Head of Department (HOD)   │
                                  │  Level 01 Executive Authority│
                                  └──────────────┬───────────────┘
                                                 │
                  ┌──────────────────────────────┴──────────────────────────────┐
                  ▼                                                             ▼
    ┌───────────────────────────┐                                 ┌───────────────────────────┐
    │  Academic Coordinator (AC)│                                 │   Class Advisor & Faculty │
    │ Level 02 Operational Auth │                                 │  Level 03 Instructional   │
    └─────────────┬─────────────┘                                 └───────────────────────────┘
                  │
                  ├─ Subject Handled Faculty Input (Advisory)
                  ├─ Course Faculty Input (Advisory)
                  ├─ Timetable Generation / Solver Execution
                  └─ Class & Faculty Timetable Drafts
```

### Institutional Role Matrix

| Authority Dimension | Head of Department (HOD) | Academic Coordinator (AC) | Teaching Faculty / Proctor |
| :--- | :--- | :--- | :--- |
| **Statutory Clearance** | **Level 01 Executive Authority** | **Level 02 Operational Authority** | **Level 03 Instructional Staff** |
| **Class Advisor Designation**| **Final Sole Appointing Authority** | Recommends staff / Operational aid | Appointed Class Advisor or Proctor |
| **Course Allocation** | **Final Binding Assignment Authority**| Advisory Subject Handled pool | Assigned course load viewer |
| **AC Input Review** | Audits AC pool against workload rules | Supplies prerequisite recommendations | None |
| **Timetable Ratification** | **Approve / Reject Statutory Decree** | Submits draft for HOD sanction | Read-only timetable once approved |
| **Campus Release** | **Syndicate / CoE / ERP Release** | Operational schedule maintenance | Syncs to personal schedule |

---

## 2. Implemented HOD Screen & Route Roster

All 12 HOD screens have been converted from Google Stitch prototype screens (`projects/2431280884270750586`) into native React Native JavaScript files using StyleSheet:

| # | Screen Name | Route | Stitch Screen ID | Direct / Derived | React Native File | Implementation Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | HOD Login | `/hod/login` | `e0e52f5b161a4778a7b1afb18b2d3b02` | **DERIVED** | `app/hod/login.js` | **Complete** |
| 2 | HOD Dashboard | `/hod` | `11d7d50880f84387bed96851617795ea` | **DERIVED** | `app/hod/index.js` | **Complete** |
| 3 | Academic Context | `/hod/context` | `14ea55151b904ec88d6cdc9abd9582fa` | **DERIVED** | `app/hod/context.js` | **Complete** |
| 4 | Class Advisor Assignment | `/hod/class-advisor` | `90f203571e624b2eb17c630076eec277` | **DERIVED** | `app/hod/class-advisor.js` | **Complete** |
| 5 | Course Faculty Input Review | `/hod/faculty-input` | `b6d3e5b4291546c3ac5d823722a35eb1` | **DERIVED** | `app/hod/faculty-input.js` | **Complete** |
| 6 | HOD Faculty Allocation | `/hod/faculty-allocation` | `b3f91214e9474173822a687153bc5c93` | **DERIVED** | `app/hod/faculty-allocation.js` | **Complete** |
| 7 | Allocation Review | `/hod/allocation-review` | `35e7f72d7eb2428983d5eeb08ec9003e` | **DERIVED** | `app/hod/allocation-review.js` | **Complete** |
| 8 | Class Timetable Review | `/hod/timetable-review` | `81833f21c1e44b579b78297f5b75dd83` | **DERIVED** | `app/hod/timetable-review.js` | **Complete** |
| 9 | HOD Timetable Approval | `/hod/approval` | `91218122c85b4d828a6ed37262a7a5b4` | **DERIVED** | `app/hod/approval.js` | **Complete** |
| 10 | Approval Details | `/hod/approval-details` | `d2b0fb398c5d4d83b15f35f66009159c` | **DERIVED** | `app/hod/approval-details.js` | **Complete** |
| 11 | HOD Notifications | `/hod/notifications` | `c954ea1f2ab343f183cfa20676725479` | **DERIVED** | `app/hod/notifications.js` | **Complete** |
| 12 | HOD Profile | `/hod/profile` | `6b499dba3ac9499188ed07d2f653517d` | **DERIVED** | `app/hod/profile.js` | **Complete** |

---

## 3. Reusable Shared Components Created

1. **`components/HODHeader.js`**:
   - Institutional Nandha Engineering College sub-brand
   - Dynamic screen title and active cohort pill (`III / V / CSE-C`)
   - `L1 HOD` statutory executive clearance badge
   - Back navigation icon button
   - Notification bell with dynamic unread counter badge
   - Profile avatar shortcut
2. **`components/HODBottomNav.js`**:
   - Fixed 6-item bottom bar: `Desk`, `Context`, `Advisors`, `Allocate`, `Timetable`, `Approval`
   - Active state styling (`#0F2942` primary fill with white icon)
   - Route mapping adhering to institutional workflow sequence
3. **`app/hod/_layout.js`**:
   - Native stack layout with headerless options and smooth slide transitions

---

## 4. State Architecture & Real-Data Readiness

All runtime data operations integrate with `constants/demoData.js`:
- **Zero Hardcoded Mock Data**: Components handle uninitialized collections gracefully without crashes.
- **`getHODProfile()` / `setHODProfile()`**: Provides authenticated executive credentials with default fallback (`DEFAULT_HOD_PROFILE`).
- **`getClassAdvisors()` / `setClassAdvisor(section, advisorData)`**: Manages sole HOD appointment of class advisors per section.
- **`getHODFacultyAllocations()` / `setHODFacultyAllocation(courseCode, allocation)`**: Stores binding HOD assignments separate from AC advisory recommendations.
- **`getTimetableVersion()` / `updateTimetableVersionStatus()`**: Manages lifecycle statuses (`DRAFT` → `PENDING_HOD_APPROVAL` → `APPROVED` / `REJECTED` → `PUBLISHED`).
- **`getMasterTimetableSessions()` / `getClassTimetable()`**: Source of truth for 35-period weekly timetable grids.
- **`getHODNotifications()` / `markHODNotificationRead(id)`**: Reactive executive notification center.
