/**
 * Thorough Comprehensive Timetable Generator Verification
 *
 * Tests the 6 exact scenarios requested:
 * 1. Theory Test (no 3+ consecutive, no full morning/afternoon, distributed across days)
 * 2. Lab Test (1 lab morning preference, 2+ labs at least one afternoon, exactly 4 continuous periods)
 * 3. Faculty Conflict Test (multiple classes sharing faculty, zero overlap, all 4 lab periods conflict-free)
 * 4. Output Test (Class and Faculty views generated from same data, 1:1 parity)
 * 5. Regeneration Test (different seeds vary randomly while satisfying all rules)
 * 6. Final Validation (independent validator pass on all generated results)
 */

const {
  DEFAULT_DAYS,
  DEFAULT_PERIODS,
  MORNING_PERIODS,
  AFTERNOON_PERIODS,
  arePeriodsConsecutive,
  crossesBreak,
  isAfternoonBlock,
  isMorningBlock,
} = require('../src/services/timetable/timetableGrid');

const {
  isFacultyAvailable,
  isClassPeriodAvailable,
  wouldFillEntireSession,
  generateLabSchedule,
  generateTheorySchedule,
  validateTimetable,
  generateFacultyTimetable,
  generateClassTimetable,
} = require('../src/services/timetable/timetableCoreLogic');

const { wouldCreateThreeConsecutiveTheory } = require('../src/services/timetable/candidateGenerator');
const SeededRandom = require('../src/services/timetable/seededRandom');

const results = {
  theory: { pass: true, details: [] },
  lab: { pass: true, details: [] },
  facultyConflict: { pass: true, details: [] },
  outputViews: { pass: true, details: [] },
  regeneration: { pass: true, details: [] },
  validation: { pass: true, details: [] },
};

function record(category, testName, passed, detail = '') {
  if (!passed) {
    results[category].pass = false;
  }
  results[category].details.push({ testName, passed, detail });
  const symbol = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`  ${symbol}: ${testName}${detail ? ` (${detail})` : ''}`);
}

async function runThoroughVerification() {
  console.log('================================================================');
  console.log('THOROUGH TIMETABLE GENERATION & CONFLICT VERIFICATION');
  console.log('================================================================\n');

  // ===========================================================================
  // 1. THEORY TEST
  // ===========================================================================
  console.log('--- 1. THEORY TEST SCENARIO ---');

  // Multi-subject theory setup: 5 courses (3-4 periods each, total 17 periods)
  const theoryPlan = [
    { id: 'T_14_1', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', totalPeriod: 4, isLab: false, duration: 1 },
    { id: 'T_14_2', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', totalPeriod: 4, isLab: false, duration: 1 },
    { id: 'T_14_3', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', totalPeriod: 4, isLab: false, duration: 1 },
    { id: 'T_14_4', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', totalPeriod: 4, isLab: false, duration: 1 },

    { id: 'T_15_1', courseCode: '22CSC15', courseName: 'Full Stack Dev', facultyId: 'FWL-14', totalPeriod: 3, isLab: false, duration: 1 },
    { id: 'T_15_2', courseCode: '22CSC15', courseName: 'Full Stack Dev', facultyId: 'FWL-14', totalPeriod: 3, isLab: false, duration: 1 },
    { id: 'T_15_3', courseCode: '22CSC15', courseName: 'Full Stack Dev', facultyId: 'FWL-14', totalPeriod: 3, isLab: false, duration: 1 },

    { id: 'T_16_1', courseCode: '22CSC16', courseName: 'OOSE', facultyId: 'FWL-03', totalPeriod: 3, isLab: false, duration: 1 },
    { id: 'T_16_2', courseCode: '22CSC16', courseName: 'OOSE', facultyId: 'FWL-03', totalPeriod: 3, isLab: false, duration: 1 },
    { id: 'T_16_3', courseCode: '22CSC16', courseName: 'OOSE', facultyId: 'FWL-03', totalPeriod: 3, isLab: false, duration: 1 },

    { id: 'T_42_1', courseCode: '22CSX42', courseName: 'UI UX Design', facultyId: 'FWL-06', totalPeriod: 3, isLab: false, duration: 1 },
    { id: 'T_42_2', courseCode: '22CSX42', courseName: 'UI UX Design', facultyId: 'FWL-06', totalPeriod: 3, isLab: false, duration: 1 },
    { id: 'T_42_3', courseCode: '22CSX42', courseName: 'UI UX Design', facultyId: 'FWL-06', totalPeriod: 3, isLab: false, duration: 1 },

    { id: 'T_21_1', courseCode: '22CSX21', courseName: 'Cryptography', facultyId: 'FWL-12', totalPeriod: 4, isLab: false, duration: 1 },
    { id: 'T_21_2', courseCode: '22CSX21', courseName: 'Cryptography', facultyId: 'FWL-12', totalPeriod: 4, isLab: false, duration: 1 },
    { id: 'T_21_3', courseCode: '22CSX21', courseName: 'Cryptography', facultyId: 'FWL-12', totalPeriod: 4, isLab: false, duration: 1 },
    { id: 'T_21_4', courseCode: '22CSX21', courseName: 'Cryptography', facultyId: 'FWL-12', totalPeriod: 4, isLab: false, duration: 1 },
  ];

  const theoryState = {
    classOccupancy: new Map(),
    globalFacultyOccupancy: new Map(),
    facultyUnavailableSet: new Set(),
    scheduledLabs: [],
    assignments: new Map(),
  };
  const theoryContext = {
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    totalLabsCount: 0,
    rng: new SeededRandom(5555),
    hodAllocationsMap: new Map(),
  };

  const theoryGenSuccess = generateTheorySchedule(theoryPlan, theoryState, theoryContext);
  record('theory', 'Theory schedule generated successfully', theoryGenSuccess, '17 periods scheduled');

  // Verify: No theory subject appears for 3+ consecutive periods
  let hasThreeConsecutive = false;
  for (const day of DEFAULT_DAYS) {
    for (let i = 0; i <= DEFAULT_PERIODS.length - 3; i++) {
      const s1 = theoryState.classOccupancy.get(`${day}_${DEFAULT_PERIODS[i]}`);
      const s2 = theoryState.classOccupancy.get(`${day}_${DEFAULT_PERIODS[i + 1]}`);
      const s3 = theoryState.classOccupancy.get(`${day}_${DEFAULT_PERIODS[i + 2]}`);
      if (s1 && s2 && s3 && s1.courseCode === s2.courseCode && s2.courseCode === s3.courseCode) {
        hasThreeConsecutive = true;
        console.error(`Violation: 3 consecutive periods of ${s1.courseCode} on ${day}: ${DEFAULT_PERIODS[i]}, ${DEFAULT_PERIODS[i+1]}, ${DEFAULT_PERIODS[i+2]}`);
      }
    }
  }
  record('theory', 'No theory subject has 3+ consecutive periods', !hasThreeConsecutive);

  // Verify: No theory subject fills an entire session (morning or afternoon)
  let fillsMorningOrAfternoon = false;
  for (const day of DEFAULT_DAYS) {
    const morningCourses = MORNING_PERIODS.map((p) => theoryState.classOccupancy.get(`${day}_${p}`)).filter(Boolean);
    if (morningCourses.length === MORNING_PERIODS.length) {
      if (morningCourses.every((s) => s.courseCode === morningCourses[0].courseCode)) {
        fillsMorningOrAfternoon = true;
      }
    }
    const afternoonCourses = AFTERNOON_PERIODS.map((p) => theoryState.classOccupancy.get(`${day}_${p}`)).filter(Boolean);
    if (afternoonCourses.length === AFTERNOON_PERIODS.length) {
      if (afternoonCourses.every((s) => s.courseCode === afternoonCourses[0].courseCode)) {
        fillsMorningOrAfternoon = true;
      }
    }
  }
  record('theory', 'No theory subject fills an entire session (morning or afternoon)', !fillsMorningOrAfternoon);

  // Verify: Theory subjects are distributed across multiple days
  const courseDaysMap = new Map();
  theoryState.classOccupancy.forEach((session, slotKey) => {
    const day = session.day || slotKey.split('_')[0];
    if (!courseDaysMap.has(session.courseCode)) {
      courseDaysMap.set(session.courseCode, new Set());
    }
    courseDaysMap.get(session.courseCode).add(day);
  });

  let wellDistributed = true;
  courseDaysMap.forEach((daysSet, code) => {
    if (daysSet.size < 2) {
      wellDistributed = false;
      console.warn(`Course ${code} only taught on ${daysSet.size} day(s)`);
    }
  });
  record('theory', 'Theory subjects distributed across multiple distinct days', wellDistributed,
    Array.from(courseDaysMap.entries()).map(([c, s]) => `${c}: ${s.size} days`).join(', ')
  );

  // ===========================================================================
  // 2. LAB TEST
  // ===========================================================================
  console.log('\n--- 2. LAB TEST SCENARIO ---');

  // Test 2A: Single Lab - Morning is preferred
  const singleLabPlan = [
    { id: 'SINGLE_LAB', courseCode: '22CSP09', courseName: 'FSD Lab', facultyId: 'FWL-14', isLab: true, duration: 4 },
  ];
  const singleLabState = {
    classOccupancy: new Map(),
    globalFacultyOccupancy: new Map(),
    facultyUnavailableSet: new Set(),
    scheduledLabs: [],
    assignments: new Map(),
  };
  const singleLabContext = {
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    totalLabsCount: 1,
    rng: new SeededRandom(100),
    hodAllocationsMap: new Map(),
  };

  const singleLabSuccess = generateLabSchedule(singleLabPlan, singleLabState, singleLabContext);
  record('lab', 'Single lab generated successfully', singleLabSuccess);

  const singleLabAssigned = singleLabState.assignments.get('SINGLE_LAB');
  const singleLabIsMorning = isMorningBlock(singleLabAssigned.periods);
  record('lab', 'Single lab prefers complete morning 4-period block', singleLabIsMorning,
    `Assigned: ${singleLabAssigned.day} ${singleLabAssigned.periods.join('-')}`
  );
  record('lab', 'Single lab occupies exactly 4 continuous periods',
    singleLabAssigned.periods.length === 4 && arePeriodsConsecutive(singleLabAssigned.periods, DEFAULT_PERIODS)
  );

  // Test 2B: Multiple Labs (2+ Labs) - At least one must be a complete afternoon block
  const multiLabPlan = [
    { id: 'LAB_1', courseCode: '22CSP09', courseName: 'FSD Lab', facultyId: 'FWL-14', isLab: true, duration: 4 },
    { id: 'LAB_2', courseCode: '22CSP10', courseName: 'Compiler Lab', facultyId: 'FWL-04', isLab: false, duration: 4, isLab: true },
  ];
  const multiLabState = {
    classOccupancy: new Map(),
    globalFacultyOccupancy: new Map(),
    facultyUnavailableSet: new Set(),
    scheduledLabs: [],
    assignments: new Map(),
  };
  const multiLabContext = {
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    totalLabsCount: 2,
    rng: new SeededRandom(200),
    hodAllocationsMap: new Map(),
  };

  const multiLabSuccess = generateLabSchedule(multiLabPlan, multiLabState, multiLabContext);
  record('lab', 'Multiple labs (2 labs) generated successfully', multiLabSuccess);

  const lab1Assigned = multiLabState.assignments.get('LAB_1');
  const lab2Assigned = multiLabState.assignments.get('LAB_2');
  const hasAfternoonLab = isAfternoonBlock(lab1Assigned.periods) || isAfternoonBlock(lab2Assigned.periods);
  record('lab', 'Multi-lab rule: at least one lab is complete afternoon block', hasAfternoonLab,
    `Lab 1: ${lab1Assigned.session}, Lab 2: ${lab2Assigned.session}`
  );

  const allLabsFourPeriods =
    lab1Assigned.periods.length === 4 &&
    arePeriodsConsecutive(lab1Assigned.periods, DEFAULT_PERIODS) &&
    lab2Assigned.periods.length === 4 &&
    arePeriodsConsecutive(lab2Assigned.periods, DEFAULT_PERIODS);
  record('lab', 'Every lab occupies exactly 4 continuous periods', allLabsFourPeriods);

  // ===========================================================================
  // 3. FACULTY CONFLICT TEST (MULTIPLE CLASSES SHARING FACULTY)
  // ===========================================================================
  console.log('\n--- 3. FACULTY CONFLICT TEST SCENARIO ---');

  // Scenario: Class A and Class B share Faculty X (FWL-04) for Theory AND Faculty Y (FWL-14) for 4-period Lab
  // Step 1: Generate Class A
  const stateA = {
    classOccupancy: new Map(),
    globalFacultyOccupancy: new Map(),
    facultyUnavailableSet: new Set(),
    scheduledLabs: [],
    assignments: new Map(),
  };
  const contextA = {
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    totalLabsCount: 1,
    rng: new SeededRandom(7001),
    hodAllocationsMap: new Map(),
  };

  const labsA = [{ id: 'CLA_L1', courseCode: '22CSP09', courseName: 'FSD Lab', facultyId: 'FWL-14', isLab: true, duration: 4 }];
  const theoryA = [
    { id: 'CLA_T1', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
    { id: 'CLA_T2', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
    { id: 'CLA_T3', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
    { id: 'CLA_T4', courseCode: '22CSC16', courseName: 'OOSE', facultyId: 'FWL-03', isLab: false, duration: 1 },
  ];

  generateLabSchedule(labsA, stateA, contextA);
  generateTheorySchedule(theoryA, stateA, contextA);

  const sessionsA = Array.from(stateA.assignments.values()).flatMap((v) =>
    v.periods.map((p) => ({
      academicContextId: 'CLASS_A',
      class: 'Class A',
      courseCode: v.courseCode,
      courseName: v.courseName,
      facultyId: v.facultyId,
      sessionType: v.isLab ? 'LAB' : 'THEORY',
      day: v.day,
      period: p,
      duration: v.duration,
    }))
  );

  // Populate Global Faculty Occupancy for Class B from Class A's sessions
  const globalFacultyOccupancyForB = new Map();
  sessionsA.forEach((s) => {
    globalFacultyOccupancyForB.set(`${s.facultyId}_${s.day}_${s.period}`, s);
  });

  // Step 2: Generate Class B with the exact same shared Faculty
  const stateB = {
    classOccupancy: new Map(),
    globalFacultyOccupancy: new Map(globalFacultyOccupancyForB),
    facultyUnavailableSet: new Set(),
    scheduledLabs: [],
    assignments: new Map(),
  };
  const contextB = {
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    totalLabsCount: 1,
    rng: new SeededRandom(7002),
    hodAllocationsMap: new Map(),
  };

  const labsB = [{ id: 'CLB_L1', courseCode: '22CSP09', courseName: 'FSD Lab', facultyId: 'FWL-14', isLab: true, duration: 4 }];
  const theoryB = [
    { id: 'CLB_T1', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
    { id: 'CLB_T2', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
    { id: 'CLB_T3', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
    { id: 'CLB_T4', courseCode: '22CSC16', courseName: 'OOSE', facultyId: 'FWL-03', isLab: false, duration: 1 },
  ];

  const classBGenLabSuccess = generateLabSchedule(labsB, stateB, contextB);
  const classBGenTheorySuccess = generateTheorySchedule(theoryB, stateB, contextB);
  record('facultyConflict', 'Class B scheduled with shared faculty', classBGenLabSuccess && classBGenTheorySuccess);

  const sessionsB = Array.from(stateB.assignments.values()).flatMap((v) =>
    v.periods.map((p) => ({
      academicContextId: 'CLASS_B',
      class: 'Class B',
      courseCode: v.courseCode,
      courseName: v.courseName,
      facultyId: v.facultyId,
      sessionType: v.isLab ? 'LAB' : 'THEORY',
      day: v.day,
      period: p,
      duration: v.duration,
    }))
  );

  // Check for any overlap between Class A and Class B on any faculty
  const facultySlotsA = new Set(sessionsA.map((s) => `${s.facultyId}_${s.day}_${s.period}`));
  const conflictingSlots = sessionsB.filter((s) => facultySlotsA.has(`${s.facultyId}_${s.day}_${s.period}`));

  record('facultyConflict', 'Zero faculty conflicts between Class A and Class B', conflictingSlots.length === 0,
    conflictingSlots.length === 0 ? 'No collisions across all shared faculty periods' : `${conflictingSlots.length} collisions`
  );

  // Check lab periods: Verify Faculty Y (FWL-14) is conflict-free for ALL 4 periods
  const labSessionA = sessionsA.filter((s) => s.sessionType === 'LAB');
  const labSessionB = sessionsB.filter((s) => s.sessionType === 'LAB');
  const labADayPeriods = new Set(labSessionA.map((s) => `${s.day}_${s.period}`));
  const labOverlap = labSessionB.some((s) => labADayPeriods.has(`${s.day}_${s.period}`));

  record('facultyConflict', 'Shared lab faculty is conflict-free across all 4 continuous periods', !labOverlap,
    `Class A lab: ${labSessionA[0].day} ${labSessionA.map((s)=>s.period).join(',')} | Class B lab: ${labSessionB[0].day} ${labSessionB.map((s)=>s.period).join(',')}`
  );

  // ===========================================================================
  // 4. OUTPUT TEST (CLASS TIMETABLE & FACULTY TIMETABLE FROM SAME DATA)
  // ===========================================================================
  console.log('\n--- 4. OUTPUT TEST SCENARIO ---');

  const combinedAssignmentData = [...sessionsA, ...sessionsB];

  // Generate Class A View
  const classTimetableA = generateClassTimetable(combinedAssignmentData, 'CLASS_A');
  record('outputViews', 'Class Timetable view generated for Class A', classTimetableA.length === sessionsA.length,
    `${classTimetableA.length} sessions matched`
  );

  // Generate Faculty Timetable View for shared Faculty FWL-04 (Dr. A. Manchula)
  const facTimetableFWL04 = generateFacultyTimetable(combinedAssignmentData, 'FWL-04');
  const expectedFWL04Count = combinedAssignmentData.filter((s) => s.facultyId === 'FWL-04').length;
  record('outputViews', 'Faculty Timetable view generated for Faculty FWL-04',
    facTimetableFWL04.length === expectedFWL04Count,
    `${facTimetableFWL04.length} sessions found (teaches in both Class A and Class B)`
  );

  // Parity Check: Verify every session in Faculty Timetable matches the exact Class Timetable assignment
  let viewDiscrepancy = false;
  facTimetableFWL04.forEach((facSession) => {
    const matchingClassSession = combinedAssignmentData.find(
      (s) =>
        s.facultyId === facSession.facultyId &&
        s.day === facSession.day &&
        s.period === facSession.period &&
        s.courseCode === facSession.courseCode
    );
    if (!matchingClassSession) {
      viewDiscrepancy = true;
    }
  });
  record('outputViews', 'No discrepancies between Class and Faculty views (single source of truth)', !viewDiscrepancy);

  // ===========================================================================
  // 5. REGENERATION TEST (RANDOMIZATION & CONSTRAINT PRESERVATION)
  // ===========================================================================
  console.log('\n--- 5. REGENERATION & RANDOMIZATION TEST SCENARIO ---');

  const seeds = [111, 222, 333, 444, 555];
  const runResults = [];

  for (const seed of seeds) {
    const rState = {
      classOccupancy: new Map(),
      globalFacultyOccupancy: new Map(),
      facultyUnavailableSet: new Set(),
      scheduledLabs: [],
      assignments: new Map(),
    };
    const rContext = {
      gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
      totalLabsCount: 1,
      rng: new SeededRandom(seed),
      hodAllocationsMap: new Map(),
    };

    const labVars = [{ id: 'R_LAB', courseCode: '22CSP09', courseName: 'FSD Lab', facultyId: 'FWL-14', isLab: true, duration: 4 }];
    const theoryVars = [
      { id: 'R_T1', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
      { id: 'R_T2', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
      { id: 'R_T3', courseCode: '22CSC15', courseName: 'Full Stack Dev', facultyId: 'FWL-14', isLab: false, duration: 1 },
      { id: 'R_T4', courseCode: '22CSC16', courseName: 'OOSE', facultyId: 'FWL-03', isLab: false, duration: 1 },
    ];

    const lOk = generateLabSchedule(labVars, rState, rContext);
    const tOk = generateTheorySchedule(theoryVars, rState, rContext);

    const flat = Array.from(rState.assignments.values()).flatMap((v) =>
      v.periods.map((p) => ({
        courseCode: v.courseCode,
        facultyId: v.facultyId,
        sessionType: v.isLab ? 'LAB' : 'THEORY',
        day: v.day,
        period: p,
      }))
    );

    const val = validateTimetable(flat, {
      resolvedRequirements: [
        { courseCode: '22CSP09', totalPeriod: 4, isLab: true },
        { courseCode: '22CSC14', totalPeriod: 2, isLab: false },
        { courseCode: '22CSC15', totalPeriod: 1, isLab: false },
        { courseCode: '22CSC16', totalPeriod: 1, isLab: false },
      ],
      gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    });

    runResults.push({ seed, success: lOk && tOk, valid: val.isValid, scheduleFingerprint: flat.map((s) => `${s.courseCode}:${s.day}:${s.period}`).sort().join('|') });
  }

  const allRunsSucceeded = runResults.every((r) => r.success && r.valid);
  record('regeneration', 'All 5 regeneration runs successfully generated and validated', allRunsSucceeded);

  // Check variation across runs
  const uniqueFingerprints = new Set(runResults.map((r) => r.scheduleFingerprint));
  record('regeneration', 'Theory and lab timetable varies randomly across runs while satisfying all constraints',
    uniqueFingerprints.size > 1, `${uniqueFingerprints.size} distinct schedules produced across ${seeds.length} seeds`
  );

  // ===========================================================================
  // 6. FINAL VALIDATION TEST
  // ===========================================================================
  console.log('\n--- 6. FINAL VALIDATION TEST SCENARIO ---');

  // Validate Class A schedule
  const valA = validateTimetable(sessionsA, {
    resolvedRequirements: [
      { courseCode: '22CSP09', totalPeriod: 4, isLab: true },
      { courseCode: '22CSC14', totalPeriod: 3, isLab: false },
      { courseCode: '22CSC16', totalPeriod: 1, isLab: false },
    ],
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
  });
  record('validation', 'Class A final validation pass', valA.isValid && valA.errors.length === 0,
    valA.isValid ? 'Zero errors detected' : JSON.stringify(valA.errors)
  );

  // Validate Class B schedule with Class A occupancy
  const valB = validateTimetable(sessionsB, {
    resolvedRequirements: [
      { courseCode: '22CSP09', totalPeriod: 4, isLab: true },
      { courseCode: '22CSC14', totalPeriod: 3, isLab: false },
      { courseCode: '22CSC16', totalPeriod: 1, isLab: false },
    ],
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    existingGlobalOccupancy: globalFacultyOccupancyForB,
  });
  record('validation', 'Class B final validation pass against multi-class occupancy', valB.isValid && valB.errors.length === 0,
    valB.isValid ? 'Zero errors detected' : JSON.stringify(valB.errors)
  );

  console.log('\n================================================================');
  console.log('TEST SUMMARY');
  console.log('================================================================');
  console.log(`Theory Rules:       ${results.theory.pass ? 'PASS' : 'FAIL'}`);
  console.log(`Lab Rules:          ${results.lab.pass ? 'PASS' : 'FAIL'}`);
  console.log(`Faculty Conflicts:  ${results.facultyConflict.pass ? 'PASS' : 'FAIL'}`);
  console.log(`Class Timetable:    ${results.outputViews.pass ? 'PASS' : 'FAIL'}`);
  console.log(`Faculty Timetable:  ${results.outputViews.pass ? 'PASS' : 'FAIL'}`);
  console.log(`Randomization:      ${results.regeneration.pass ? 'PASS' : 'FAIL'}`);
  console.log(`Validation:         ${results.validation.pass ? 'PASS' : 'FAIL'}`);
  console.log('================================================================');

  const allPassed =
    results.theory.pass &&
    results.lab.pass &&
    results.facultyConflict.pass &&
    results.outputViews.pass &&
    results.regeneration.pass &&
    results.validation.pass;

  if (!allPassed) {
    process.exit(1);
  }
}

runThoroughVerification().catch((err) => {
  console.error('[Fatal Error]:', err);
  process.exit(1);
});
