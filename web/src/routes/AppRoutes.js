import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import AuthLayout from '../layouts/AuthLayout';
import FacultyLayout from '../layouts/FacultyLayout';
import CoordinatorLayout from '../layouts/CoordinatorLayout';
import HODLayout from '../layouts/HODLayout';

// Route Guard
import ProtectedRoute from './ProtectedRoute';

// Public & Common Pages
import LoginPage from '../pages/auth/LoginPage';
import AccessDenied from '../pages/common/AccessDenied';

// Faculty Portal Pages (Phase 3)
import FacultyDashboard from '../pages/faculty/FacultyDashboard';
import MyTimetablePage from '../pages/faculty/MyTimetablePage';
import WeeklyTimetablePage from '../pages/faculty/WeeklyTimetablePage';
import FacultyWorkloadPage from '../pages/faculty/FacultyWorkloadPage';
import FacultyAvailabilityPage from '../pages/faculty/FacultyAvailabilityPage';
import FacultyAbsencePage from '../pages/faculty/FacultyAbsencePage';
import FacultyNotificationsPage from '../pages/faculty/FacultyNotificationsPage';
import FacultyProfilePage from '../pages/faculty/FacultyProfilePage';

// Coordinator Portal Pages (Phase 4)
import CoordinatorDashboard from '../pages/coordinator/CoordinatorDashboard';
import CourseSelectionPage from '../pages/coordinator/CourseSelectionPage';
import FacultyAssignmentPage from '../pages/coordinator/FacultyAssignmentPage';
import ConflictDetectionPage from '../pages/coordinator/ConflictDetectionPage';
import ValidationRulesPage from '../pages/coordinator/ValidationRulesPage';
import OptimizationSolverPage from '../pages/coordinator/OptimizationSolverPage';
import CoordinatorNotificationsPage from '../pages/coordinator/CoordinatorNotificationsPage';

// HOD Portal Pages (Phase 5)
import HODDashboard from '../pages/hod/HODDashboard';
import FacultyListPage from '../pages/hod/FacultyListPage';
import AddFacultyPage from '../pages/hod/AddFacultyPage';
import AcademicContextPage from '../pages/hod/AcademicContextPage';
import HODFacultyAllocationPage from '../pages/hod/HODFacultyAllocationPage';
import AllocationReviewPage from '../pages/hod/AllocationReviewPage';
import TimetableReviewPage from '../pages/hod/TimetableReviewPage';
import TimetableApprovalPage from '../pages/hod/TimetableApprovalPage';
import ClassAdvisorPage from '../pages/hod/ClassAdvisorPage';
import FacultyInputReviewPage from '../pages/hod/FacultyInputReviewPage';
import HODNotificationsPage from '../pages/hod/HODNotificationsPage';
import HODProfilePage from '../pages/hod/HODProfilePage';

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
          <Route path="dashboard" element={<FacultyDashboard />} />
          <Route path="timetable" element={<MyTimetablePage />} />
          <Route path="weekly-timetable" element={<WeeklyTimetablePage />} />
          <Route path="workload" element={<FacultyWorkloadPage />} />
          <Route path="availability" element={<FacultyAvailabilityPage />} />
          <Route path="absence" element={<FacultyAbsencePage />} />
          <Route path="notifications" element={<FacultyNotificationsPage />} />
          <Route path="profile" element={<FacultyProfilePage />} />
        </Route>
      </Route>

      {/* Protected Academic Coordinator routes (AC, ADMIN) */}
      <Route element={<ProtectedRoute allowedRoles={['AC', 'ADMIN']} />}>
        <Route path="/coordinator" element={<CoordinatorLayout />}>
          <Route index element={<Navigate to="/coordinator/dashboard" replace />} />
          <Route path="dashboard" element={<CoordinatorDashboard />} />
          <Route path="context" element={<AcademicContextPage portalType="Coordinator" />} />
          <Route path="course-selection" element={<CourseSelectionPage />} />
          <Route path="faculty-assignment" element={<FacultyAssignmentPage />} />
          <Route path="conflict" element={<ConflictDetectionPage />} />
          <Route path="validation" element={<ValidationRulesPage />} />
          <Route path="optimization" element={<OptimizationSolverPage />} />
          <Route path="notifications" element={<CoordinatorNotificationsPage />} />
        </Route>
      </Route>

      {/* Protected Head of Department routes (HOD, ADMIN) */}
      <Route element={<ProtectedRoute allowedRoles={['HOD', 'ADMIN']} />}>
        <Route path="/hod" element={<HODLayout />}>
          <Route index element={<Navigate to="/hod/dashboard" replace />} />
          <Route path="dashboard" element={<HODDashboard />} />
          <Route path="faculty" element={<FacultyListPage />} />
          <Route path="faculty/add" element={<AddFacultyPage />} />
          <Route path="context" element={<AcademicContextPage portalType="HOD" />} />
          <Route path="faculty-allocation" element={<HODFacultyAllocationPage />} />
          <Route path="allocation-review" element={<AllocationReviewPage />} />
          <Route path="timetable-review" element={<TimetableReviewPage />} />
          <Route path="approval" element={<TimetableApprovalPage />} />
          <Route path="class-advisor" element={<ClassAdvisorPage />} />
          <Route path="faculty-input" element={<FacultyInputReviewPage />} />
          <Route path="notifications" element={<HODNotificationsPage />} />
          <Route path="profile" element={<HODProfilePage />} />
        </Route>
      </Route>

      {/* Catch-all redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
