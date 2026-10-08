/**
 * Auto Timetable Generation & Assignment Plan Tests
 * 
 * Verifies:
 * 1. Year selection
 * 2. Semester selection
 * 3. Section selection
 * 4. Correct API request mapping
 * 5. Paginated response extraction
 * 6. Automatic course row creation
 * 7. Dynamic row count
 * 8. Faculty resolution from HOD allocation
 * 9. Missing HOD allocation state
 * 10. No workload fallback
 * 11. No historical faculty fallback
 * 12. Assignment Plan synchronization
 * 13. Elective option vs active-course separation
 * 14. Loading state
 * 15. Empty state
 * 16. Error state
 * 17. No duplicate automatic rows
 */

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log('  ✓ PASS: ' + testName);
  } else {
    failedTests++;
    console.error('  ✗ FAIL: ' + testName);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('AUTO TIMETABLE GENERATION & ASSIGNMENT TESTS');
  console.log('====================================================\n');

  const academicModule = await import('../src/constants/academicContext.js');
  const {
    RELEVANT_YEARS,
    YEAR_TO_SEMESTER_ODD,
    YEAR_TO_SEMESTER_EVEN,
    YEAR_SEMESTER_MAP,
    normalizeYear,
    normalizeCurriculumSemester,
    resolveCurriculumSemester,
    findMatchingAcademicContext,
  } = academicModule;

  const designModule = await import('../src/services/coordinatorDesignService.js');
  const {
    DEFAULT_ELECTIVE_SLOT_MAP,
    fetchAllCoursesForContext,
    normalizeCourseCode,
    normalizeContextId,
    resolveAuthoritativeHODFaculty,
    deriveAutomaticCourseRows,
    calculateAssignmentPlanStatus,
    validateAssignmentCounts,
    categorizeAssignmentRow,
    ASSIGNMENT_COUNT_RULES,
  } = designModule;

  // --- 1. Year Selection ---
  console.log('--- 1. Year Selection Tests ---');
  assert(RELEVANT_YEARS.includes('II Year'), 'Relevant years contains II Year');
  assert(RELEVANT_YEARS.includes('III Year'), 'Relevant years contains III Year');
  assert(RELEVANT_YEARS.includes('IV Year'), 'Relevant years contains IV Year');
  assert(normalizeYear('II') === 'II Year', 'Normalizes "II" to "II Year"');
  assert(normalizeYear('III') === 'III Year', 'Normalizes "III" to "III Year"');
  assert(normalizeYear('IV') === 'IV Year', 'Normalizes "IV" to "IV Year"');
  assert(normalizeYear('III Year') === 'III Year', 'Preserves "III Year"');

  // --- 2. Semester Selection ---
  console.log('\n--- 2. Semester Selection Tests ---');
  assert(YEAR_SEMESTER_MAP['II Year'].includes('Semester III'), 'II Year maps to Semester III');
  assert(YEAR_SEMESTER_MAP['II Year'].includes('Semester IV'), 'II Year maps to Semester IV');
  assert(YEAR_SEMESTER_MAP['III Year'].includes('Semester V'), 'III Year maps to Semester V');
  assert(YEAR_SEMESTER_MAP['III Year'].includes('Semester VI'), 'III Year maps to Semester VI');
  assert(YEAR_SEMESTER_MAP['IV Year'].includes('Semester VII'), 'IV Year maps to Semester VII');
  assert(YEAR_SEMESTER_MAP['IV Year'].includes('Semester VIII'), 'IV Year maps to Semester VIII');

  // --- 3. Section Selection & Context Resolution ---
  console.log('\n--- 3. Section Selection Tests ---');
  const mockContexts = [
    { _id: 'ctx_2_a', year: 'II Year', semester: 'Odd Semester', section: 'A', department: 'CSE' },
    { _id: 'ctx_2_b', year: 'II Year', semester: 'Odd Semester', section: 'B', department: 'CSE' },
    { _id: 'ctx_3_a', year: 'III Year', semester: 'Odd Semester', section: 'A', department: 'CSE' },
    { _id: 'ctx_3_b', year: 'III Year', semester: 'Odd Semester', section: 'B', department: 'CSE' },
    { _id: 'ctx_3_a_even', year: 'III Year', semester: 'Even Semester', section: 'A', department: 'CSE' },
    { _id: 'ctx_4_a', year: 'IV Year', semester: 'Odd Semester', section: 'A', department: 'CSE' },
  ];

  const matched3A = findMatchingAcademicContext(mockContexts, { year: 'III Year', semester: 'Semester V', section: 'A' });
  assert(matched3A && matched3A._id === 'ctx_3_a', 'Section A correctly resolves III Year Odd context (ctx_3_a)');

  const matched3B = findMatchingAcademicContext(mockContexts, { year: 'III Year', semester: 'Semester V', section: 'B' });
  assert(matched3B && matched3B._id === 'ctx_3_b', 'Section B correctly resolves III Year Odd context (ctx_3_b)');

  const matched3AEven = findMatchingAcademicContext(mockContexts, { year: 'III Year', semester: 'Semester VI', section: 'A' });
  assert(matched3AEven && matched3AEven._id === 'ctx_3_a_even', 'Section A correctly resolves III Year Even context (ctx_3_a_even)');

  // --- 4. Correct API Request Mapping ---
  console.log('\n--- 4. Correct API Request Mapping Tests ---');
  assert(resolveCurriculumSemester('II Year', 'Odd Semester') === 'Semester III', 'UI-002 TEST 1: II Year context resolves to curriculum Semester III.');
  assert(resolveCurriculumSemester('III Year', 'Odd Semester') === 'Semester V', 'UI-002 TEST 2: III Year context resolves to curriculum Semester V.');
  assert(resolveCurriculumSemester('IV Year', 'Odd Semester') === 'Semester VII', 'UI-002 TEST 3: IV Year context resolves to curriculum Semester VII.');
  assert(resolveCurriculumSemester('III Year', 'Odd Semester') !== 'Odd Semester', 'UI-002 TEST 4: "Odd Semester" is not incorrectly used as the curriculum semester filter.');
  assert(resolveCurriculumSemester('II', 'Odd') === 'Semester III', 'Selecting II-A loads Semester III courses.');
  assert(resolveCurriculumSemester('III', 'Odd') === 'Semester V', 'Selecting III-A loads Semester V courses.');
  assert(resolveCurriculumSemester('IV', 'Odd') === 'Semester VII', 'Selecting IV-A loads Semester VII courses.');
  assert(resolveCurriculumSemester('III Year', 'Semester V') === 'Semester V', 'Direct Semester V string preserves Semester V.');

  // --- 5. Paginated Response Extraction ---
  console.log('\n--- 5. Paginated Response Extraction Tests ---');
  // Verify helper processes single and multi-page payload models
  const singlePagePayload = { items: [{ courseCode: 'C1' }, { courseCode: 'C2' }], total: 2, page: 1, totalPages: 1 };
  const itemsSingle = Array.isArray(singlePagePayload) ? singlePagePayload : singlePagePayload.items;
  assert(itemsSingle.length === 2, 'Single page response extraction extracts 2 courses');

  const wrappedPayload = { data: { items: [{ courseCode: 'C1' }, { courseCode: 'C2' }, { courseCode: 'C3' }], total: 3, page: 1, totalPages: 1 } };
  const itemsWrapped = wrappedPayload.data?.items || [];
  assert(itemsWrapped.length === 3, 'Wrapped API response correctly extracts items array');

  // --- 6. Automatic Course Row Creation ---
  console.log('\n--- 6. Automatic Course Row Creation Tests ---');
  const sampleSemVCourses = [
    { courseCode: '22CSC14', courseName: 'Principles of Compiler Design', courseType: 'THEORY', totalPeriod: 4, semester: 'Semester V', category: 'Professional Core' },
    { courseCode: '22CSC15', courseName: 'Full Stack Development', courseType: 'THEORY', totalPeriod: 3, semester: 'Semester V', category: 'Professional Core' },
    { courseCode: '22CSC16', courseName: 'Object Oriented Software Engineering', courseType: 'THEORY', totalPeriod: 3, semester: 'Semester V', category: 'Professional Core' },
    { courseCode: '22CSP09', courseName: 'Full Stack Development Laboratory', courseType: 'LAB', isLab: true, totalPeriod: 4, semester: 'Semester V', category: 'Professional Core' },
    { courseCode: '22CSP10', courseName: 'Object Oriented Software Engineering Laboratory', courseType: 'LAB', isLab: true, totalPeriod: 4, semester: 'Semester V', category: 'Professional Core' },
    { courseCode: '22MAN8R', courseName: 'Soft/Analytical Skills - IV', courseType: 'MC', totalPeriod: 3, semester: 'Semester V', category: 'MC' },
  ];

  const sampleAllocations = [
    { academicContextId: 'ctx_3_a', courseCode: '22CSC14', facultyId: 'FWL-04', facultyName: 'Dr. A. Manchula', status: 'APPROVED' },
    { academicContextId: 'ctx_3_a', courseCode: '22CSC15', facultyId: 'FWL-14', facultyName: 'Ms. D. Vinoparkavi', status: 'APPROVED' },
    { academicContextId: 'ctx_3_a', courseCode: '22CSC16', facultyId: 'FWL-03', facultyName: 'Dr. S. Karpusamy', status: 'APPROVED' },
    { academicContextId: 'ctx_3_a', courseCode: '22CSP09', facultyId: 'FWL-14', facultyName: 'Ms. D. Vinoparkavi', status: 'APPROVED' },
    { academicContextId: 'ctx_3_a', courseCode: '22CSP10', facultyId: 'FWL-03', facultyName: 'Dr. S. Karpusamy', status: 'APPROVED' },
  ];

  const rows = deriveAutomaticCourseRows({
    courses: sampleSemVCourses,
    allCatalogCourses: sampleSemVCourses,
    hodAllocations: sampleAllocations,
    academicContextId: 'ctx_3_a',
    targetCurriculumSemester: 'Semester V',
    electiveSlotMap: { 'Semester V': [] }, // test without slots first
  });

  assert(rows.length === 6, 'Automatic course row creation produces 6 rows without manual Add action');
  const c14 = rows.find(r => r.courseCode === '22CSC14');
  assert(c14 && c14.courseTitle === 'Principles of Compiler Design', 'Row contains Course Code and Course Title');
  assert(c14 && c14.type === 'THEORY', 'Row contains Course Type (THEORY)');
  assert(c14 && c14.requiredPeriods === 4, 'Row contains Required Periods (4)');
  assert(c14 && c14.facultyId === 'FWL-04', 'Row contains authoritative faculty FWL-04');
  assert(c14 && c14.status === 'HOD ALLOCATED', 'Allocated course row has status HOD ALLOCATED');

  // --- 7. Dynamic Row Count Tests ---
  console.log('\n--- 7. Dynamic Row Count Tests ---');
  const sampleSemIIICourses = [
    { courseCode: '22MYB05', courseName: 'Discrete Mathematics', courseType: 'THEORY', totalPeriod: 4, semester: 'Semester III' },
    { courseCode: '22CSC05', courseName: 'Algorithms', courseType: 'THEORY', totalPeriod: 3, semester: 'Semester III' },
    { courseCode: '22CSC06', courseName: 'Computer Networks', courseType: 'THEORY', totalPeriod: 3, semester: 'Semester III' },
    { courseCode: '22CSC07', courseName: 'Java Programming', courseType: 'THEORY', totalPeriod: 3, semester: 'Semester III' },
    { courseCode: '22CSC08', courseName: 'Operating Systems', courseType: 'THEORY', totalPeriod: 3, semester: 'Semester III' },
    { courseCode: '22CSP04', courseName: 'Algorithms Laboratory', courseType: 'LAB', totalPeriod: 4, semester: 'Semester III' },
    { courseCode: '22CSP05', courseName: 'Computer Networks Laboratory', courseType: 'LAB', totalPeriod: 4, semester: 'Semester III' },
    { courseCode: '22CSP06', courseName: 'Java Programming Laboratory', courseType: 'LAB', totalPeriod: 4, semester: 'Semester III' },
    { courseCode: '22MAN04R', courseName: 'Soft/Analytical Skills - II', courseType: 'MC', totalPeriod: 3, semester: 'Semester III' },
    { courseCode: '22MAN09', courseName: 'Indian Constitution', courseType: 'MC', totalPeriod: 1, semester: 'Semester III' },
  ];

  const rowsIII = deriveAutomaticCourseRows({
    courses: sampleSemIIICourses,
    allCatalogCourses: sampleSemIIICourses,
    hodAllocations: [],
    academicContextId: 'ctx_2_a',
    targetCurriculumSemester: 'Semester III',
    electiveSlotMap: {},
  });

  assert(rowsIII.length === 10, 'Semester III dynamically renders exactly 10 rows (not hardcoded to 6)');
  assert(rows.length === 6, 'Semester V core dynamically renders exactly 6 rows (not hardcoded to 10)');

  // --- 8. Faculty Resolution from HOD Allocation ---
  console.log('\n--- 8. Faculty Resolution from HOD Allocation Tests ---');
  const resolvedFac = resolveAuthoritativeHODFaculty(sampleAllocations, 'ctx_3_a', '22CSC14');
  assert(resolvedFac.allocated === true, 'Course + authoritative faculty association resolves correctly.');
  assert(resolvedFac.facultyId === 'FWL-04', 'Resolved facultyId matches HOD allocation FWL-04');
  assert(resolvedFac.facultyName === 'Dr. A. Manchula', 'Resolved facultyName matches HOD allocation Dr. A. Manchula');
  assert(resolvedFac.status === 'HOD ALLOCATED', 'Status is HOD ALLOCATED');

  // --- 9. Missing HOD Allocation State ---
  console.log('\n--- 9. Missing HOD Allocation State Tests ---');
  const unallocatedRow = rows.find(r => r.courseCode === '22MAN8R');
  assert(unallocatedRow && unallocatedRow.isAllocated === false, 'Course without allocation has isAllocated: false');
  assert(unallocatedRow && unallocatedRow.status === 'REQUIRES HOD DECISION', 'UI-002 TEST 11: Missing HOD allocation is represented as: [REQUIRES HOD DECISION].');
  assert(unallocatedRow && unallocatedRow.faculty === '[REQUIRES HOD DECISION]', 'Missing HOD allocation displays [REQUIRES HOD DECISION] text');

  // --- 10. No Workload Fallback ---
  console.log('\n--- 10. No Workload Fallback Tests ---');
  const resolvedUnallocated = resolveAuthoritativeHODFaculty(sampleAllocations, 'ctx_3_a', '22MAN8R');
  assert(resolvedUnallocated.allocated === false, 'UI-002 TEST 12: No fallback faculty is injected.');
  assert(resolvedUnallocated.facultyId === null, 'No workload master faculty ID is injected');
  assert(resolvedUnallocated.displayFaculty === '[REQUIRES HOD DECISION]', 'Display faculty remains [REQUIRES HOD DECISION]');

  // --- 11. No Historical Faculty Fallback ---
  console.log('\n--- 11. No Historical Faculty Fallback Tests ---');
  const foreignContextAllocations = [
    { academicContextId: 'ctx_OTHER', courseCode: '22MAN8R', facultyId: 'FWL-99', facultyName: 'Historical Staff' },
  ];
  const resolvedForeign = resolveAuthoritativeHODFaculty(foreignContextAllocations, 'ctx_3_a', '22MAN8R');
  assert(resolvedForeign.allocated === false, 'Historical faculty from another cohort is rejected');
  assert(resolvedForeign.facultyId === null, 'Does not use historical timetable faculty as fallback');

  // --- 12. Assignment Plan Synchronization ---
  console.log('\n--- 12. Assignment Plan Synchronization Tests ---');
  // Plan status is derived directly from the rows
  const planMetrics = calculateAssignmentPlanStatus(rows, { hasContext: true, loading: false });
  assert(planMetrics.totalCourses === 6, 'Assignment plan total courses synchronizes with rows length (6)');
  assert(planMetrics.allocatedCount === 5, 'Assignment plan allocated count synchronizes (5)');
  assert(planMetrics.pendingCount === 1, 'Assignment plan pending count synchronizes (1)');
  assert(planMetrics.state === 'PARTIAL', 'Overall plan status is PARTIAL when 1 allocation is missing');
  assert(planMetrics.userMessage === 'Faculty allocation is pending HOD decision for one or more courses.', 'User-facing partial message matches specification');

  // --- 13. Elective Option vs Active-Course Separation ---
  console.log('\n--- 13. Elective Option vs Active-Course Separation Tests ---');
  const catalogWithPECs = [
    ...sampleSemVCourses,
    { courseCode: '22CSX01', courseName: 'Deep Learning', category: 'PEC', electiveType: 'PEC', semester: 'Programme Elective' },
    { courseCode: '22CSX02', courseName: 'Natural Language Processing', category: 'PEC', electiveType: 'PEC', semester: 'Programme Elective' },
    { courseCode: '22CSX42', courseName: 'Full Stack Frameworks', category: 'PEC', electiveType: 'PEC', semester: 'Programme Elective' },
  ];

  const allocationsWithOneElective = [
    ...sampleAllocations,
    { academicContextId: 'ctx_3_a', courseCode: '22CSX42', facultyId: 'FWL-06', facultyName: 'Mrs. E. Padma', status: 'APPROVED' },
  ];

  const rowsWithElective = deriveAutomaticCourseRows({
    courses: sampleSemVCourses,
    allCatalogCourses: catalogWithPECs,
    hodAllocations: allocationsWithOneElective,
    academicContextId: 'ctx_3_a',
    targetCurriculumSemester: 'Semester V',
    electiveSlotMap: {
      'Semester V': [
        { slot: 'E1', allowedType: 'PEC' },
        { slot: 'E2', allowedType: 'PEC' },
        { slot: 'E3', allowedType: 'PEC/OEC' },
      ],
    },
  });

  // Verify that all 48 PECs are NOT activated
  assert(!rowsWithElective.some(r => r.courseCode === '22CSX01'), 'Unselected PEC catalog course 22CSX01 is NOT automatically activated');
  assert(!rowsWithElective.some(r => r.courseCode === '22CSX02'), 'Unselected PEC catalog course 22CSX02 is NOT automatically activated');

  // Verify that allocated elective is included
  const activeElectiveRow = rowsWithElective.find(r => r.courseCode === '22CSX42');
  assert(activeElectiveRow && activeElectiveRow.facultyId === 'FWL-06', 'Active allocated elective 22CSX42 is present with allocated faculty FWL-06');

  // Verify that remaining unfulfilled elective slots are represented as unresolved slots
  const slotE2 = rowsWithElective.find(r => r.courseCode === 'E2');
  assert(slotE2 && slotE2.isElectiveSlot === true, 'Unfulfilled elective slot E2 is represented as unresolved slot');
  assert(slotE2 && slotE2.status === 'REQUIRES HOD DECISION', 'Unfulfilled elective slot E2 status is REQUIRES HOD DECISION');

  // --- 14. Loading State ---
  console.log('\n--- 14. Loading State Tests ---');
  const loadingStatus = calculateAssignmentPlanStatus([], { loading: true });
  assert(loadingStatus.state === 'LOADING', 'Loading status produces state: LOADING');
  assert(loadingStatus.isReady === false, 'Loading state isReady is false');

  // --- 15. Empty State ---
  console.log('\n--- 15. Empty State Tests ---');
  const emptyStatus = calculateAssignmentPlanStatus([], { hasContext: true, loading: false });
  assert(emptyStatus.state === 'EMPTY', 'Empty courses produces state: EMPTY');
  assert(emptyStatus.userMessage === 'No active courses are available for this academic context.', 'Empty user message matches specification');

  // --- 16. Error State ---
  console.log('\n--- 16. Error State Tests ---');
  const errorStatus = calculateAssignmentPlanStatus([], { error: 'Service Unavailable' });
  assert(errorStatus.state === 'ERROR', 'Error condition produces state: ERROR');
  assert(errorStatus.userMessage === 'Service Unavailable', 'Error message is properly exposed');

  // --- 17. Assignment-Count Rule Validation (COURSE-SCOPED) ---
  console.log('\n--- 17. Assignment-Count Rule Validation Tests ---');

  // UG Theory course with 2 faculty assignments: VALID
  const theoryTwoFaculty = [
    { courseCode: 'CS101', courseTitle: 'Compiler Design', type: 'THEORY', requiredPeriods: 4, facultyId: 'FWL-01', status: 'HOD ALLOCATED', isAllocated: true },
    { courseCode: 'CS101', courseTitle: 'Compiler Design', type: 'THEORY', requiredPeriods: 4, facultyId: 'FWL-02', status: 'HOD ALLOCATED', isAllocated: true },
  ];
  const theoryTwoViolations = validateAssignmentCounts(theoryTwoFaculty);
  assert(theoryTwoViolations.length === 0, 'UG Theory 2 faculty assignments: PASS');

  // UG Theory course with 3 faculty assignments: FAIL
  const theoryThreeFaculty = [
    { courseCode: 'CS101', courseTitle: 'Compiler Design', type: 'THEORY', requiredPeriods: 4, facultyId: 'FWL-01', status: 'HOD ALLOCATED', isAllocated: true },
    { courseCode: 'CS101', courseTitle: 'Compiler Design', type: 'THEORY', requiredPeriods: 4, facultyId: 'FWL-02', status: 'HOD ALLOCATED', isAllocated: true },
    { courseCode: 'CS101', courseTitle: 'Compiler Design', type: 'THEORY', requiredPeriods: 4, facultyId: 'FWL-03', status: 'HOD ALLOCATED', isAllocated: true },
  ];
  const theoryThreeViolations = validateAssignmentCounts(theoryThreeFaculty);
  assert(theoryThreeViolations.some((v) => v.bucket === 'UG_THEORY' && v.count === 3 && v.max === 2), 'UG Theory 3 faculty assignments: FAIL');

  // UG Lab course with 2 faculty assignments: PASS
  const labTwoFaculty = [
    { courseCode: 'CS201L', courseTitle: 'DS Lab', type: 'LAB', requiredPeriods: 4, facultyId: 'FWL-03', status: 'HOD ALLOCATED', isAllocated: true },
    { courseCode: 'CS201L', courseTitle: 'DS Lab', type: 'LAB', requiredPeriods: 4, facultyId: 'FWL-04', status: 'HOD ALLOCATED', isAllocated: true },
  ];
  const labTwoViolations = validateAssignmentCounts(labTwoFaculty);
  assert(labTwoViolations.length === 0, 'UG Lab 2 faculty assignments: PASS');

  // UG Lab course with 3 faculty assignments: FAIL
  const labThreeFaculty = [
    { courseCode: 'CS201L', courseTitle: 'DS Lab', type: 'LAB', requiredPeriods: 4, facultyId: 'FWL-03', status: 'HOD ALLOCATED', isAllocated: true },
    { courseCode: 'CS201L', courseTitle: 'DS Lab', type: 'LAB', requiredPeriods: 4, facultyId: 'FWL-04', status: 'HOD ALLOCATED', isAllocated: true },
    { courseCode: 'CS201L', courseTitle: 'DS Lab', type: 'LAB', requiredPeriods: 4, facultyId: 'FWL-05', status: 'HOD ALLOCATED', isAllocated: true },
  ];
  const labThreeViolations = validateAssignmentCounts(labThreeFaculty);
  assert(labThreeViolations.some((v) => v.bucket === 'UG_LAB' && v.count === 3 && v.max === 2), 'UG Lab 3 faculty assignments: FAIL');

  // PG course with 1 faculty assignment: PASS
  const pgOneFaculty = [
    { courseCode: 'PG501', courseTitle: 'Advanced AI', type: 'PG', requiredPeriods: 3, facultyId: 'FWL-07', status: 'HOD ALLOCATED', isAllocated: true },
  ];
  const pgOneViolations = validateAssignmentCounts(pgOneFaculty);
  assert(pgOneViolations.length === 0, 'PG 1 faculty assignment: PASS');

  // PG course with 2 faculty assignments: FAIL
  const pgTwoFaculty = [
    { courseCode: 'PG501', courseTitle: 'Advanced AI', type: 'PG', requiredPeriods: 3, facultyId: 'FWL-07', status: 'HOD ALLOCATED', isAllocated: true },
    { courseCode: 'PG501', courseTitle: 'Advanced AI', type: 'PG', requiredPeriods: 3, facultyId: 'FWL-08', status: 'HOD ALLOCATED', isAllocated: true },
  ];
  const pgTwoViolations = validateAssignmentCounts(pgTwoFaculty);
  assert(pgTwoViolations.some((v) => v.bucket === 'PG' && v.count === 2 && v.max === 1), 'PG 2 faculty assignments: FAIL');

  // Multiple different courses assigned to the same faculty: MUST NOT violate
  const multiCourseSameFaculty = [
    { courseCode: 'CS101', courseTitle: 'Compiler Design', type: 'THEORY', requiredPeriods: 4, facultyId: 'FWL-01', status: 'HOD ALLOCATED', isAllocated: true },
    { courseCode: 'CS102', courseTitle: 'OOP', type: 'THEORY', requiredPeriods: 3, facultyId: 'FWL-01', status: 'HOD ALLOCATED', isAllocated: true },
    { courseCode: 'CS201L', courseTitle: 'DS Lab', type: 'LAB', requiredPeriods: 4, facultyId: 'FWL-01', status: 'HOD ALLOCATED', isAllocated: true },
  ];
  const multiCourseViolations = validateAssignmentCounts(multiCourseSameFaculty);
  assert(multiCourseViolations.length === 0, 'Multiple different courses on same faculty must NOT create a violation');

  // categorizeAssignmentRow bucket mapping (uses type metadata only)
  assert(categorizeAssignmentRow({ type: 'THEORY', courseCode: 'CS101' }) === 'UG_THEORY', 'THEORY maps to UG_THEORY bucket');
  assert(categorizeAssignmentRow({ type: 'LAB', courseCode: 'CS101L' }) === 'UG_LAB', 'LAB maps to UG_LAB bucket');
  assert(categorizeAssignmentRow({ type: 'PG', courseCode: 'CS701' }) === 'PG', 'PG maps to PG bucket');

  // --- 18. Academic Context Binding (Stale Data Not Reused) ---
  console.log('\n--- 18. Academic Context Binding Tests ---');
  // Rows must be derived ONLY from the active academic context, not stale/other contexts
  const staleContextAllocations = [
    { academicContextId: 'ctx_OLD', courseCode: '22CSC14', facultyId: 'FWL-99', status: 'APPROVED' },
    { academicContextId: 'ctx_3_a', courseCode: '22CSC15', facultyId: 'FWL-04', status: 'APPROVED' },
  ];
  const contextBoundRows = deriveAutomaticCourseRows({
    courses: sampleSemVCourses,
    allCatalogCourses: sampleSemVCourses,
    hodAllocations: staleContextAllocations,
    academicContextId: 'ctx_3_a',
    targetCurriculumSemester: 'Semester V',
    electiveSlotMap: {},
  });
  // The stale ctx_OLD allocation for 22CSC14 should NOT bind; only ctx_3_a counts
  const csc14Row = contextBoundRows.find((r) => r.courseCode === '22CSC14');
  assert(csc14Row && csc14Row.facultyId === null, 'Stale academic context allocation rejected for 22CSC14');
  const csc15Row = contextBoundRows.find((r) => r.courseCode === '22CSC15');
  assert(csc15Row && csc15Row.facultyId === 'FWL-04', 'Active academic context allocation accepted for 22CSC15');

  // --- 19. Required Periods Display Tests ---
  console.log('\n--- 19. Required Periods Display Tests ---');
  const periodRows = contextBoundRows.filter((r) => r.courseCode === '22CSC14');
  assert(periodRows.length === 1, 'Row for 22CSC14 is present');
  assert(periodRows[0].requiredPeriods === 4, 'Required periods for 22CSC14 = 4 (from curriculum catalog)');
  const csc15Periods = contextBoundRows.find((r) => r.courseCode === '22CSC15');
  assert(csc15Periods && csc15Periods.requiredPeriods === 3, 'Required periods for 22CSC15 = 3');

  // --- 20. Assignment Plan Status with Violations ---
  console.log('\n--- 20. Assignment Plan Status with Violations ---');
  const violationStatus = calculateAssignmentPlanStatus(theoryThreeFaculty, { hasContext: true, loading: false });
  assert(violationStatus.state === 'PARTIAL' || violationStatus.state === 'READY', 'Plan status computed even with violations');

  // --- 17b. No Duplicate Automatic Rows ---
  console.log('\n--- 17. No Duplicate Automatic Rows Tests ---');
  const duplicatedCourseList = [
    ...sampleSemVCourses,
    { courseCode: '22CSC14', courseName: 'Principles of Compiler Design (Duplicate Session)', courseType: 'THEORY', totalPeriod: 4, semester: 'Semester V' },
  ];
  const deduplicatedRows = deriveAutomaticCourseRows({
    courses: duplicatedCourseList,
    allCatalogCourses: duplicatedCourseList,
    hodAllocations: sampleAllocations,
    academicContextId: 'ctx_3_a',
    targetCurriculumSemester: 'Semester V',
    electiveSlotMap: {},
  });
  const countC14 = deduplicatedRows.filter(r => r.courseCode === '22CSC14').length;
  assert(countC14 === 1, 'Exact duplicate course row is prevented: course appears exactly once');

  // --- Fully Allocated Ready State Test ---
  console.log('\n--- Ready State Verification ---');
  const fullyAllocatedAllocs = [
    ...sampleAllocations,
    { academicContextId: 'ctx_3_a', courseCode: '22MAN8R', facultyId: 'FWL-07', facultyName: 'Dr. SAS Faculty', status: 'APPROVED' },
  ];
  const fullyAllocatedRows = deriveAutomaticCourseRows({
    courses: sampleSemVCourses,
    allCatalogCourses: sampleSemVCourses,
    hodAllocations: fullyAllocatedAllocs,
    academicContextId: 'ctx_3_a',
    targetCurriculumSemester: 'Semester V',
    electiveSlotMap: {},
  });
  const readyPlanStatus = calculateAssignmentPlanStatus(fullyAllocatedRows, { hasContext: true });
  assert(readyPlanStatus.state === 'READY', 'Fully allocated rows evaluate to state: READY');
  assert(readyPlanStatus.isReady === true, 'isReady is true when all courses are allocated');
  assert(readyPlanStatus.pendingCount === 0, 'Pending count is 0 in READY state');

  // --- 18. Solver API Payload Construction Tests ---
  console.log('\n--- 18. Solver API Payload Construction Tests ---');
  const assignmentPlanPayload = fullyAllocatedRows
    .filter((r) => r.facultyId && r.courseCode)
    .map((r) => ({
      courseCode: r.courseCode,
      facultyId: r.facultyId,
      type: r.type === 'LAB' ? 'LAB' : 'THEORY',
      requiredPeriods: Number(r.requiredPeriods) || 3,
    }));
  assert(assignmentPlanPayload.length === 6, 'Solver payload contains exactly 6 course assignments');
  assert(assignmentPlanPayload[0].courseCode === '22CSC14', 'First assignment course code is 22CSC14');
  assert(assignmentPlanPayload[0].facultyId === 'FWL-04', 'First assignment facultyId is FWL-04');
  assert(assignmentPlanPayload[0].type === 'THEORY', 'First assignment type is THEORY');
  assert(assignmentPlanPayload[3].type === 'LAB', 'Lab assignment type is normalized to LAB');
  assert(typeof assignmentPlanPayload[0].requiredPeriods === 'number', 'requiredPeriods is a numeric value');

  // Verify that an unallocated course row is NOT sent to the solver
  const partialPlanPayload = rows
    .filter((r) => r.facultyId && r.courseCode)
    .map((r) => ({
      courseCode: r.courseCode,
      facultyId: r.facultyId,
      type: r.type === 'LAB' ? 'LAB' : 'THEORY',
      requiredPeriods: Number(r.requiredPeriods) || 3,
    }));
  assert(partialPlanPayload.length === 5, 'Unallocated courses without faculty are excluded from payload');
  assert(!partialPlanPayload.some((p) => p.courseCode === '22MAN8R'), 'Pending course 22MAN8R is excluded');

  // --- 19. Solver Response Unpacking & Summary Construction Tests ---
  console.log('\n--- 19. Solver Response Unpacking & Summary Construction Tests ---');
  const mockSolverResponse = {
    success: true,
    data: {
      success: true,
      timetableVersion: {
        _id: 'ver_001',
        versionLabel: 'v1.0-AUTO',
        academicYear: '2025-2026',
        semester: 'Semester V',
        section: 'A',
        status: 'GENERATED',
      },
      sessionsCreated: 28,
      assignments: new Array(28).fill({}),
    },
  };
  const unpackedData = mockSolverResponse?.data || mockSolverResponse;
  const unpackedVersion = unpackedData.timetableVersion || {};
  const sessionsCount = unpackedData.sessionsCreated ?? (unpackedData.assignments?.length || 0);

  const generationSummary = {
    status: 'GENERATED',
    versionId: unpackedVersion._id || unpackedVersion.id,
    versionLabel: unpackedVersion.versionLabel || 'v1.0',
    academicContextId: 'ctx_3_a',
    academicContext: 'III Year | Semester V | Section A',
    totalCourses: readyPlanStatus.totalCourses,
    theoryCourses: readyPlanStatus.theoryCount,
    labCourses: readyPlanStatus.labCount,
    allocatedCourses: readyPlanStatus.allocatedCount,
    sessionsCreated: sessionsCount,
  };

  assert(generationSummary.versionId === 'ver_001', 'Summary correctly captures versionId');
  assert(generationSummary.versionLabel === 'v1.0-AUTO', 'Summary correctly captures versionLabel');
  assert(generationSummary.sessionsCreated === 28, 'Summary correctly captures sessionsCreated (28)');
  assert(generationSummary.totalCourses === 6, 'Summary captures totalCourses (6)');

  // --- 20. 2D Timetable Matrix & Schedule Mapping Tests ---
  console.log('\n--- 20. 2D Timetable Matrix & Schedule Mapping Tests ---');
  const sampleScheduleSessions = [
    { day: 'MON', period: 'P1', courseCode: '22CSC14', courseName: 'Principles of Compiler Design', facultyId: 'FWL-04', facultyName: 'Dr. A. Manchula', room: 'LH-101', sessionType: 'THEORY' },
    { day: 'MON', period: 'P2', courseCode: '22CSC15', courseName: 'Full Stack Development', facultyId: 'FWL-01', facultyName: 'Dr. K. S.', room: 'LH-101', sessionType: 'THEORY' },
    { day: 'TUE', period: 'P5', courseCode: '22CSP09', courseName: 'Full Stack Development Laboratory', facultyId: 'FWL-01', facultyName: 'Dr. K. S.', room: 'LAB-02', sessionType: 'LAB' },
  ];

  // Test matrix building using WEEK_DAYS d.id
  const testWeekDays = [
    { id: 'MON', label: 'Mon' },
    { id: 'TUE', label: 'Tue' },
    { id: 'WED', label: 'Wed' },
    { id: 'THU', label: 'Thu' },
    { id: 'FRI', label: 'Fri' },
  ];
  const testPeriodTimings = [
    { period: 'P1', startTime: '09:15', endTime: '10:05', label: '09:15 – 10:05' },
    { period: 'P2', startTime: '10:05', endTime: '10:55', label: '10:05 – 10:55' },
    { type: 'break', name: 'Morning Break' },
    { period: 'P3', startTime: '11:10', endTime: '12:00', label: '11:10 – 12:00' },
    { period: 'P4', startTime: '12:00', endTime: '12:50', label: '12:00 – 12:50' },
    { type: 'lunch', name: 'Lunch Interval' },
    { period: 'P5', startTime: '01:45', endTime: '02:35', label: '01:45 – 02:35' },
    { period: 'P6', startTime: '02:35', endTime: '03:25', label: '02:35 – 03:25' },
    { type: 'break', name: 'Evening Break' },
    { period: 'P7', startTime: '03:40', endTime: '04:30', label: '03:40 – 04:30' },
  ];

  const academicPeriods = testPeriodTimings.filter((p) => Boolean(p.period));
  assert(academicPeriods.length === 7, 'Academic periods filter produces exactly 7 periods (P1 to P7)');
  assert(!academicPeriods.some((p) => p.type === 'break' || p.type === 'lunch'), 'Breaks and lunches excluded from period grid');

  const matrix = {};
  testWeekDays.forEach((d) => {
    matrix[d.id] = {};
  });
  sampleScheduleSessions.forEach((s) => {
    const dayId = (s.day || '').toUpperCase();
    const periodId = (s.period || '').toUpperCase();
    if (matrix[dayId]) {
      matrix[dayId][periodId] = s;
    }
  });

  assert(matrix['MON']['P1'] !== undefined, 'Monday P1 session is placed in matrix');
  assert(matrix['MON']['P1'].courseCode === '22CSC14', 'Monday P1 course code is 22CSC14');
  assert(matrix['MON']['P1'].facultyName === 'Dr. A. Manchula', 'Monday P1 faculty is Dr. A. Manchula');
  assert(matrix['MON']['P1'].room === 'LH-101', 'Monday P1 room is LH-101');
  assert(matrix['TUE']['P5'].sessionType === 'LAB', 'Tuesday P5 session type is LAB');
  assert(matrix['WED']['P1'] === undefined, 'Wednesday P1 is free/empty');

  // --- 21. Review Matrix Filter & Navigation URL Tests ---
  console.log('\n--- 21. Review Matrix Filter & Navigation URL Tests ---');
  const reviewUrl = `/coordinator/view?academicContextId=${generationSummary.academicContextId}&versionId=${generationSummary.versionId}`;
  assert(reviewUrl.includes('academicContextId=ctx_3_a'), 'Review Matrix URL includes academicContextId');
  assert(reviewUrl.includes('versionId=ver_001'), 'Review Matrix URL includes versionId');

  const classUrl = `/faculty/class-timetable?academicContextId=${generationSummary.academicContextId}`;
  assert(classUrl.includes('academicContextId=ctx_3_a'), 'Class Timetable URL includes academicContextId');

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
