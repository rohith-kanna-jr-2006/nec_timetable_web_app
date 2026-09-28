import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import AuthLayout from '../layouts/AuthLayout';
import FacultyLayout from '../layouts/FacultyLayout';
import CoordinatorLayout from '../layouts/CoordinatorLayout';
import HODLayout from '../layouts/HODLayout';

// Route Guard
import ProtectedRoute from './ProtectedRoute';

// Pages
import LoginPage from '../pages/auth/LoginPage';
import FacultyDashboardPlaceholder from '../pages/faculty/FacultyDashboardPlaceholder';
import CoordinatorDashboardPlaceholder from '../pages/coordinator/CoordinatorDashboardPlaceholder';
import HODDashboardPlaceholder from '../pages/hod/HODDashboardPlaceholder';
import RoutePlaceholder from '../pages/common/RoutePlaceholder';
import AccessDenied from '../pages/common/AccessDenied';
import MyTimetablePage from '../pages/faculty/MyTimetablePage';
import WeeklyTimetablePage from '../pages/faculty/WeeklyTimetablePage';
import FacultyListPage from '../pages/hod/FacultyListPage';
import AddFacultyPage from '../pages/hod/AddFacultyPage';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Root redirect to login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public Authentication routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/access-denied" element={<AccessDenied />} />
        <Route path="/403" element={<Navigate to="/access-denied" replace />} />
      </Route>

      {/* Protected Faculty Portal routes (FACULTY, ADMIN) */}
      <Route element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']} />}>
        <Route path="/faculty" element={<FacultyLayout />}>
          <Route index element={<Navigate to="/faculty/dashboard" replace />} />
          <Route path="dashboard" element={<FacultyDashboardPlaceholder />} />
          <Route path="timetable" element={<MyTimetablePage />} />
          <Route path="weekly-timetable" element={<WeeklyTimetablePage />} />
          <Route
            path="workload"
            element={
              <RoutePlaceholder
                title="Workload Compliance & Norms"
                section="Faculty Portal"
                phaseTarget="Phase 3"
                description="Detailed breakdown of teaching contact hours against 16-period norm."
              />
            }
          />
          <Route
            path="availability"
            element={
              <RoutePlaceholder
                title="Availability & Preferences"
                section="Faculty Portal"
                phaseTarget="Phase 3"
                description="Slot preferences, off-period submissions, and conflict audit."
              />
            }
          />
          <Route
            path="absence"
            element={
              <RoutePlaceholder
                title="Absence & Leave Management"
                section="Faculty Portal"
                phaseTarget="Phase 3"
                description="Leave request submission and substitute assignment monitoring."
              />
            }
          />
          <Route
            path="notifications"
            element={
              <RoutePlaceholder
                title="Alerts & Notifications"
                section="Faculty Portal"
                phaseTarget="Phase 3"
                description="Institutional announcements, schedule modifications, and leave approvals."
              />
            }
          />
          <Route
            path="profile"
            element={
              <RoutePlaceholder
                title="Staff Profile & Settings"
                section="Faculty Portal"
                phaseTarget="Phase 3"
                description="Faculty credentials, department designation, and institutional cabin venue."
              />
            }
          />
        </Route>
      </Route>

      {/* Protected Academic Coordinator routes (AC, ADMIN) */}
      <Route element={<ProtectedRoute allowedRoles={['AC', 'ADMIN']} />}>
        <Route path="/coordinator" element={<CoordinatorLayout />}>
          <Route index element={<Navigate to="/coordinator/dashboard" replace />} />
          <Route path="dashboard" element={<CoordinatorDashboardPlaceholder />} />
          <Route
            path="context"
            element={
              <RoutePlaceholder
                title="Academic Context Setting"
                section="Coordinator Portal"
                phaseTarget="Phase 4"
                description="Regulation, Academic Year, Term, Department, and Cohort selection."
              />
            }
          />
          <Route
            path="course-selection"
            element={
              <RoutePlaceholder
                title="Course Selection (R2022)"
                section="Coordinator Portal"
                phaseTarget="Phase 4"
                description="Authoritative curriculum subject validation for current semester."
              />
            }
          />
          <Route
            path="faculty-assignment"
            element={
              <RoutePlaceholder
                title="Faculty Handler Assignment"
                section="Coordinator Portal"
                phaseTarget="Phase 4"
                description="Candidate instructor nomination matrix with allocation rules."
              />
            }
          />
          <Route
            path="conflict"
            element={
              <RoutePlaceholder
                title="Conflict Detection"
                section="Coordinator Portal"
                phaseTarget="Phase 4"
                description="Automated audit for double-booking, room contention, and slot overlaps."
              />
            }
          />
          <Route
            path="validation"
            element={
              <RoutePlaceholder
                title="Validation Rules & Compliance"
                section="Coordinator Portal"
                phaseTarget="Phase 4"
                description="Weekly period quotas and institutional contact period balancing."
              />
            }
          />
          <Route
            path="optimization"
            element={
              <RoutePlaceholder
                title="Optimization Solver"
                section="Coordinator Portal"
                phaseTarget="Phase 4"
                description="Automated timetable generation solver interface."
              />
            }
          />
          <Route
            path="notifications"
            element={
              <RoutePlaceholder
                title="Operational Alerts"
                section="Coordinator Portal"
                phaseTarget="Phase 4"
                description="Operational change logs and timetable draft submission receipts."
              />
            }
          />
        </Route>
      </Route>

      {/* Protected Head of Department routes (HOD, ADMIN) */}
      <Route element={<ProtectedRoute allowedRoles={['HOD', 'ADMIN']} />}>
        <Route path="/hod" element={<HODLayout />}>
          <Route index element={<Navigate to="/hod/dashboard" replace />} />
          <Route path="dashboard" element={<HODDashboardPlaceholder />} />
          <Route path="faculty" element={<FacultyListPage />} />
          <Route path="faculty/add" element={<AddFacultyPage />} />
          <Route
            path="context"
            element={
              <RoutePlaceholder
                title="Departmental Academic Context"
                section="HOD Portal"
                phaseTarget="Phase 5"
                description="Department-wide regulation and semester oversight."
              />
            }
          />
          <Route
            path="faculty-allocation"
            element={
              <RoutePlaceholder
                title="Executive Faculty Allocation"
                section="HOD Portal"
                phaseTarget="Phase 5"
                description="Binding course-faculty assignments and statutory institutional periods."
              />
            }
          />
          <Route
            path="allocation-review"
            element={
              <RoutePlaceholder
                title="Allocation Review"
                section="HOD Portal"
                phaseTarget="Phase 5"
                description="Side-by-side audit of AC-recommended candidate pools vs final allocation."
              />
            }
          />
          <Route
            path="timetable-review"
            element={
              <RoutePlaceholder
                title="Class Timetable Review"
                section="HOD Portal"
                phaseTarget="Phase 5"
                description="Master class schedule grid audit before executive approval."
              />
            }
          />
          <Route
            path="approval"
            element={
              <RoutePlaceholder
                title="Timetable State Ratification"
                section="HOD Portal"
                phaseTarget="Phase 5"
                description="Formal state transitions: APPROVE or REJECT with statutory decree."
              />
            }
          />
          <Route
            path="class-advisor"
            element={
              <RoutePlaceholder
                title="Class Advisor Designation"
                section="HOD Portal"
                phaseTarget="Phase 5"
                description="Sole appointing authority for departmental Class Advisors."
              />
            }
          />
          <Route
            path="faculty-input"
            element={
              <RoutePlaceholder
                title="Faculty Preferences & Input"
                section="HOD Portal"
                phaseTarget="Phase 5"
                description="Faculty availability review, workload distribution, and leave requests."
              />
            }
          />
          <Route
            path="notifications"
            element={
              <RoutePlaceholder
                title="HOD Executive Alerts"
                section="HOD Portal"
                phaseTarget="Phase 5"
                description="Pending timetable submissions and statutory system notifications."
              />
            }
          />
          <Route
            path="profile"
            element={
              <RoutePlaceholder
                title="HOD Executive Profile"
                section="HOD Portal"
                phaseTarget="Phase 5"
                description="Head of Department credentials, secretariat cabin, and clearance level."
              />
            }
          />
        </Route>
      </Route>

      {/* Catch-all route */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
