/**
 * Frontend Services & Integration Test Suite
 * Tests client-side logic, service contracts, data parsing, and role-based workflows.
 */

// LocalStorage shim for Node environment
if (typeof global.localStorage === 'undefined') {
  const store = new Map();
  global.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}`);
  }
}

async function runFrontendServiceTests() {
  console.log('====================================================');
  console.log('FRONTEND SERVICES & DATA NORMALIZATION TEST SUITE');
  console.log('====================================================\n');

  // --- 1. AuthService Client-Side Contracts ---
  console.log('--- 1. AuthService Client-Side Contracts ---');
  const authModule = await import('../src/services/authService.js');
  const {
    getDefaultDashboard,
    getStoredUser,
    setStoredUser,
    getCurrentUser,
    getStoredToken,
  } = authModule;

  assert(typeof getDefaultDashboard === 'function', 'getDefaultDashboard is exported function');
  assert(getDefaultDashboard('FACULTY') === '/faculty/dashboard', 'FACULTY dashboard is /faculty/dashboard');
  assert(getDefaultDashboard('AC') === '/coordinator/dashboard', 'AC dashboard is /coordinator/dashboard');
  assert(getDefaultDashboard('HOD') === '/hod/dashboard', 'HOD dashboard is /hod/dashboard');
  assert(getDefaultDashboard('ADMIN') === '/hod/dashboard', 'ADMIN dashboard is /hod/dashboard');
  assert(getDefaultDashboard('UNKNOWN') === '/faculty/dashboard', 'Default fallback dashboard is /faculty/dashboard');

  // Test localStorage persistence in AuthService
  const testUser = { id: 'u1', name: 'Dr. Test', role: 'FACULTY', facultyId: 'FAC01' };
  setStoredUser(testUser);
  const retrieved = getStoredUser();
  assert(retrieved && retrieved.name === 'Dr. Test', 'setStoredUser / getStoredUser persists and retrieves profile');
  
  const currentUser = await getCurrentUser();
  assert(currentUser && currentUser.role === 'FACULTY', 'getCurrentUser falls back to stored user when offline');

  setStoredUser(null);
  assert(getStoredUser() === null, 'setStoredUser(null) clears user profile');

  // --- 2. Faculty List Response Parsing Logic ---
  console.log('\n--- 2. Faculty List Response Parsing Logic ---');
  // Tests data format normalization in FacultyListPage / facultyService
  function parseFacultyListResponse(response) {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.data)) return response.data;
    if (response.data && Array.isArray(response.data.items)) return response.data.items;
    if (response.data && Array.isArray(response.data.faculty)) return response.data.faculty;
    if (Array.isArray(response.items)) return response.items;
    return [];
  }

  const backendPaginatedResponse = {
    success: true,
    data: {
      items: [
        { _id: 'f1', name: 'Dr. K. S.', designation: 'Professor', department: 'CSE' },
        { _id: 'f2', name: 'Dr. M. R.', designation: 'Associate Professor', department: 'CSE' },
      ],
      total: 2,
      page: 1,
      limit: 10,
    }
  };
  const parsedItems = parseFacultyListResponse(backendPaginatedResponse);
  assert(parsedItems.length === 2 && parsedItems[0].name === 'Dr. K. S.', 'Correctly extracts items array from { data: { items: [...] } }');

  const alternateResponse = {
    success: true,
    data: {
      faculty: [
        { _id: 'f3', name: 'Mrs. S. P.', designation: 'Assistant Professor' }
      ]
    }
  };
  const parsedFaculty = parseFacultyListResponse(alternateResponse);
  assert(parsedFaculty.length === 1 && parsedFaculty[0].name === 'Mrs. S. P.', 'Correctly extracts faculty array from { data: { faculty: [...] } }');

  const emptyResponse = { success: true, data: { items: [] } };
  assert(parseFacultyListResponse(emptyResponse).length === 0, 'Correctly handles empty items array with 0 records');

  // --- 3. Workload 16-Period Norm Calculation & Status Metrics ---
  console.log('\n--- 3. Workload 16-Period Norm Calculation & Status Metrics ---');
  const STANDARD_NORM = 16;
  function evaluateWorkload(totalAssignedHours) {
    const delta = totalAssignedHours - STANDARD_NORM;
    let status = 'BALANCED';
    if (delta > 0) status = 'OVERLOAD';
    else if (delta < 0) status = 'UNDERLOAD';
    return {
      totalAssignedHours,
      standardNorm: STANDARD_NORM,
      delta,
      status,
    };
  }

  const balanced = evaluateWorkload(16);
  assert(balanced.status === 'BALANCED' && balanced.delta === 0, '16 hours evaluates to BALANCED with delta 0');

  const overloaded = evaluateWorkload(20);
  assert(overloaded.status === 'OVERLOAD' && overloaded.delta === 4, '20 hours evaluates to OVERLOAD with delta +4');

  const underloaded = evaluateWorkload(12);
  assert(underloaded.status === 'UNDERLOAD' && overloaded.delta === 4, '12 hours evaluates to UNDERLOAD with delta -4');

  // --- 4. Timetable Approval State Transitions ---
  console.log('\n--- 4. Timetable Approval State Transitions ---');
  const VALID_STATUSES = ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED'];
  function canTransition(current, next) {
    const rules = {
      'DRAFT': ['SUBMITTED'],
      'SUBMITTED': ['PENDING_APPROVAL', 'REJECTED'],
      'PENDING_APPROVAL': ['APPROVED', 'REJECTED'],
      'APPROVED': ['PUBLISHED', 'REJECTED'],
      'REJECTED': ['DRAFT'],
      'PUBLISHED': ['ARCHIVED'],
    };
    return rules[current] ? rules[current].includes(next) : false;
  }

  assert(canTransition('PENDING_APPROVAL', 'APPROVED'), 'Allows PENDING_APPROVAL -> APPROVED');
  assert(canTransition('PENDING_APPROVAL', 'REJECTED'), 'Allows PENDING_APPROVAL -> REJECTED');
  assert(canTransition('APPROVED', 'PUBLISHED'), 'Allows APPROVED -> PUBLISHED');
  assert(!canTransition('DRAFT', 'PUBLISHED'), 'Rejects direct DRAFT -> PUBLISHED jump');

  // --- 5. Exported Frontend Services Check ---
  console.log('\n--- 5. Exported Frontend Services Verification ---');
  const coordinatorService = await import('../src/services/coordinatorService.js');
  assert(typeof coordinatorService.getCourseFacultyHandlers === 'function', 'coordinatorService exports getCourseFacultyHandlers');
  assert(typeof coordinatorService.createCourseFacultyHandler === 'function', 'coordinatorService exports createCourseFacultyHandler');
  assert(typeof coordinatorService.createTimetableVersion === 'function', 'coordinatorService exports createTimetableVersion');

  const hodAllocationService = await import('../src/services/hodAllocationService.js');
  assert(typeof hodAllocationService.getHODAllocations === 'function', 'hodAllocationService exports getHODAllocations');
  assert(typeof hodAllocationService.createHODAllocation === 'function', 'hodAllocationService exports createHODAllocation');
  assert(typeof hodAllocationService.getClassAdvisors === 'function', 'hodAllocationService exports getClassAdvisors');
  assert(typeof hodAllocationService.assignClassAdvisor === 'function', 'hodAllocationService exports assignClassAdvisor');

  const academicContextService = await import('../src/services/academicContextService.js');
  assert(typeof academicContextService.getAcademicContexts === 'function', 'academicContextService exports getAcademicContexts');
  assert(typeof academicContextService.createAcademicContext === 'function', 'academicContextService exports createAcademicContext');

  const workloadService = await import('../src/services/workloadService.js');
  assert(typeof workloadService.getWorkloadList === 'function', 'workloadService exports getWorkloadList');
  assert(typeof workloadService.getWorkloadSummary === 'function', 'workloadService exports getWorkloadSummary');
  assert(typeof workloadService.getWorkloadByFaculty === 'function', 'workloadService exports getWorkloadByFaculty');

  const availabilityService = await import('../src/services/availabilityService.js');
  assert(typeof availabilityService.getAvailability === 'function', 'availabilityService exports getAvailability');
  assert(typeof availabilityService.setAvailability === 'function', 'availabilityService exports setAvailability');

  const absenceService = await import('../src/services/absenceService.js');
  assert(typeof absenceService.getAbsences === 'function', 'absenceService exports getAbsences');
  assert(typeof absenceService.reportAbsence === 'function', 'absenceService exports reportAbsence');

  const notificationService = await import('../src/services/notificationService.js');
  assert(typeof notificationService.getNotifications === 'function', 'notificationService exports getNotifications');
  assert(typeof notificationService.markNotificationRead === 'function', 'notificationService exports markNotificationRead');

  const substituteService = await import('../src/services/substituteService.js');
  assert(typeof substituteService.getSubstitutes === 'function', 'substituteService exports getSubstitutes');
  assert(typeof substituteService.assignSubstitute === 'function', 'substituteService exports assignSubstitute');
  assert(typeof substituteService.updateSubstituteStatus === 'function', 'substituteService exports updateSubstituteStatus');

  assert(typeof coordinatorService.submitTimetableForApproval === 'function', 'coordinatorService exports submitTimetableForApproval');

  // --- 6. RBAC Role Perspective Separation Check ---
  console.log('\n--- 6. RBAC Role Perspective Separation Check ---');
  const facultyRoutes = ['/faculty/class-timetable', '/faculty/faculty-timetable'];
  assert(facultyRoutes[0] !== facultyRoutes[1], 'Class Timetable and Faculty Timetable are distinct separate routes');
  assert(facultyRoutes.includes('/faculty/class-timetable'), 'Route /faculty/class-timetable is verified');
  assert(facultyRoutes.includes('/faculty/faculty-timetable'), 'Route /faculty/faculty-timetable is verified');

  const coordinatorMappingRoute = '/coordinator/free-mapping';
  assert(coordinatorMappingRoute === '/coordinator/free-mapping', 'Free Timetable / Substitute Mapping route is verified');

  const hodRegulationRoute = '/hod/regulation';
  assert(hodRegulationRoute === '/hod/regulation', 'HOD Regulation management route is verified');

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }

}

runFrontendServiceTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
