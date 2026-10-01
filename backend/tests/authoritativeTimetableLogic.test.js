/**
 * Authoritative Timetable Requirements & Logic Test Suite
 *
 * Verifies all requirements specified:
 * 1. Theory distribution and 3+ consecutive prevention
 * 2. Never fill entire morning or afternoon session with same theory subject
 * 3. 4-period continuous labs and break protection
 * 4. Multi-lab rule (at least one afternoon lab)
 * 5. Single-lab rule (prefers morning, allows afternoon if constrained)
 * 6. Faculty conflict prevention across multiple classes (Class A vs Class B)
 * 7. Faculty availability for ALL 4 lab periods
 * 8. Validation function enforces all constraints
 * 9. Unified assignment data produces both Class Timetable and Faculty Timetable views
 * 10. Constraint-based randomization & regeneration
 */

const {
  DEFAULT_DAYS,
  DEFAULT_PERIODS,
  MORNING_PERIODS,
  AFTERNOON_PERIODS,
  crossesBreak,
  arePeriodsConsecutive,
  getValidLabBlocksForDay,
} = require('../src/services/timetable/timetableGrid');

const {
  isFacultyAvailable,
  isClassPeriodAvailable,
  wouldFillEntireSession,
  isTheoryPlacementValid,
  isLabPlacementValid,
  generateLabSchedule,
  generateTheorySchedule,
  validateTimetable,
  generateFacultyTimetable,
  generateClassTimetable,
} = require('../src/services/timetable/timetableCoreLogic');

const {
  wouldCreateThreeConsecutiveTheory,
  getCourseCountOnDay,
} = require('../src/services/timetable/candidateGenerator');
const { scoreCandidate } = require('../src/services/timetable/candidateScorer');

const SeededRandom = require('../src/services/timetable/seededRandom');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failCount++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runAllTests() {
  console.log('============================================================');
  console.log('AUTHORITATIVE TIMETABLE GENERATION & CONFLICT LOGIC TESTS');
  console.log('============================================================\n');

  // -------------------------------------------------------------------------
  // TEST SUITE 1: THEORY CONSTRAINTS & DISTRIBUTION
  // -------------------------------------------------------------------------
  console.log('--- 1. Theory 3+ Consecutive Prevention ---');
  const classOccTwoTheory = new Map([
    ['MON_P1', { courseCode: '22CSC14' }],
    ['MON_P2', { courseCode: '22CSC14' }],
  ]);

  // P3 would make P1, P2, P3
  assert(
    wouldCreateThreeConsecutiveTheory('MON', 'P3', '22CSC14', classOccTwoTheory, DEFAULT_PERIODS) === true,
    'Placing 22CSC14 at P3 after P1+P2 is detected as 3 consecutive periods'
  );

  // P4 does not create 3 consecutive
  assert(
    wouldCreateThreeConsecutiveTheory('MON', 'P4', '22CSC14', classOccTwoTheory, DEFAULT_PERIODS) === false,
    'Placing 22CSC14 at P4 is allowed (gap between P2 and P4)'
  );

  // Middle gap: P1 and P3 occupied -> P2 would make P1, P2, P3
  const classOccGap = new Map([
    ['MON_P1', { courseCode: '22CSC14' }],
    ['MON_P3', { courseCode: '22CSC14' }],
  ]);
  assert(
    wouldCreateThreeConsecutiveTheory('MON', 'P2', '22CSC14', classOccGap, DEFAULT_PERIODS) === true,
    'Placing 22CSC14 at P2 between P1 and P3 is detected as 3 consecutive periods'
  );

  console.log('\n--- 2. Never Fill Entire Session with Same Theory Subject ---');
  // Morning session has 4 periods: P1, P2, P3, P4
  const classOccMorning3 = new Map([
    ['MON_P1', { courseCode: '22CSC14' }],
    ['MON_P2', { courseCode: '22CSC14' }],
    ['MON_P3', { courseCode: '22CSC14' }],
  ]);
  // Attempting to place 4th period in morning fills entire morning session!
  assert(
    wouldFillEntireSession('MON', 'P4', '22CSC14', classOccMorning3, DEFAULT_PERIODS) === true,
    'Placing 22CSC14 at P4 after P1, P2, P3 fills entire morning session'
  );

  // Other subject at P4 does not fill session
  assert(
    wouldFillEntireSession('MON', 'P4', '22CSC15', classOccMorning3, DEFAULT_PERIODS) === false,
    'Different subject 22CSC15 at P4 does not fill morning session'
  );

  console.log('\n--- 2b. Theory Distribution Heuristics & Scoring ---');
  // Candidate on a day with 0 periods of this course gets +60 bonus vs repeat on same day
  const emptyDayState = {
    classOccupancy: new Map(),
    globalFacultyOccupancy: new Map(),
    scheduledLabs: [],
    remainingVariables: [],
  };
  const scoringContext = {
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    totalLabsCount: 0,
    rng: null,
  };
  const variableT = { id: 'T_1', courseCode: '22CSC14', facultyId: 'FWL-04', isLab: false };
  const candEmptyDay = { day: 'TUE', period: 'P1', periods: ['P1'], session: 'MORNING', isLab: false };
  const scoreEmpty = scoreCandidate(candEmptyDay, variableT, emptyDayState, scoringContext);

  // When day already has 1 period of this course, day bonus is lower
  const onePeriodDayState = {
    classOccupancy: new Map([['TUE_P1', { courseCode: '22CSC14' }]]),
    globalFacultyOccupancy: new Map([['FWL-04_TUE_P1', {}]]),
    scheduledLabs: [],
    remainingVariables: [],
  };
  const candSameDay = { day: 'TUE', period: 'P4', periods: ['P4'], session: 'MORNING', isLab: false };
  const scoreSameDay = scoreCandidate(candSameDay, variableT, onePeriodDayState, scoringContext);

  assert(
    scoreEmpty > scoreSameDay,
    `Spreading theory across unscheduled days scores higher (${scoreEmpty}) than same-day repeat (${scoreSameDay})`
  );

  // Adjacency penalty: placing at P2 immediately adjacent to P1 receives repeat penalty
  const candAdjacent = { day: 'TUE', period: 'P2', periods: ['P2'], session: 'MORNING', isLab: false };
  const scoreAdjacent = scoreCandidate(candAdjacent, variableT, onePeriodDayState, scoringContext);
  assert(
    scoreSameDay > scoreAdjacent,
    `Separated lecture period scores higher (${scoreSameDay}) than adjacent repeat period (${scoreAdjacent})`
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 2: LAB CONSTRAINTS (4-PERIOD BLOCKS & SESSIONS)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Lab 4-Period Block Continuity & Break Protection ---');
  assert(arePeriodsConsecutive(['P1', 'P2', 'P3', 'P4'], DEFAULT_PERIODS) === true, 'P1-P4 is strictly consecutive');
  assert(arePeriodsConsecutive(['P5', 'P6', 'P7', 'P8'], DEFAULT_PERIODS) === true, 'P5-P8 is strictly consecutive');
  assert(arePeriodsConsecutive(['P1', 'P2', 'P4', 'P5'], DEFAULT_PERIODS) === false, 'P1, P2, P4, P5 is non-consecutive');

  // Crossing lunch break between P4 and P5
  assert(crossesBreak(['P3', 'P4', 'P5', 'P6']) === true, 'P3-P6 is identified as crossing lunch break');
  assert(crossesBreak(['P1', 'P2', 'P3', 'P4']) === false, 'P1-P4 morning block does not cross lunch break');
  assert(crossesBreak(['P5', 'P6', 'P7', 'P8']) === false, 'P5-P8 afternoon block does not cross lunch break');

  // Valid lab blocks for a day
  const validBlocks = getValidLabBlocksForDay('MON', 4, DEFAULT_PERIODS);
  assert(validBlocks.length === 2, `Generates exactly 2 valid 4-period lab blocks per day (found ${validBlocks.length})`);
  assert(validBlocks.some((b) => b.session === 'MORNING'), 'Contains 1 complete morning lab block');
  assert(validBlocks.some((b) => b.session === 'AFTERNOON'), 'Contains 1 complete afternoon lab block');

  // -------------------------------------------------------------------------
  // TEST SUITE 3: MULTI-LAB & SINGLE-LAB RULES
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Multi-Lab Afternoon Rule ---');
  // If lab count > 1, at least ONE lab must be a complete afternoon block
  const multiLabInvalid = [
    // Lab 1 morning
    { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P1', sessionType: 'LAB' },
    { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P2', sessionType: 'LAB' },
    { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P3', sessionType: 'LAB' },
    { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P4', sessionType: 'LAB' },
    // Lab 2 also morning!
    { courseCode: '22CSP10', facultyId: 'FWL-03', day: 'THU', period: 'P1', sessionType: 'LAB' },
    { courseCode: '22CSP10', facultyId: 'FWL-03', day: 'THU', period: 'P2', sessionType: 'LAB' },
    { courseCode: '22CSP10', facultyId: 'FWL-03', day: 'THU', period: 'P3', sessionType: 'LAB' },
    { courseCode: '22CSP10', facultyId: 'FWL-03', day: 'THU', period: 'P4', sessionType: 'LAB' },
  ];

  const valMultiLab = validateTimetable(multiLabInvalid, {
    resolvedRequirements: [
      { courseCode: '22CSP09', totalPeriod: 4, isLab: true },
      { courseCode: '22CSP10', totalPeriod: 4, isLab: true },
    ],
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
  });
  assert(!valMultiLab.isValid, 'Multi-lab with 0 afternoon labs is rejected by validator');
  assert(valMultiLab.errors.some((e) => e.code === 'MULTI_LAB_AFTERNOON_REQUIRED'), 'Error code MULTI_LAB_AFTERNOON_REQUIRED');

  // Multi-lab valid (one morning, one afternoon)
  const multiLabValid = [
    // Lab 1 morning
    { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P1', sessionType: 'LAB' },
    { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P2', sessionType: 'LAB' },
    { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P3', sessionType: 'LAB' },
    { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P4', sessionType: 'LAB' },
    // Lab 2 afternoon
    { courseCode: '22CSP10', facultyId: 'FWL-03', day: 'THU', period: 'P5', sessionType: 'LAB' },
    { courseCode: '22CSP10', facultyId: 'FWL-03', day: 'THU', period: 'P6', sessionType: 'LAB' },
    { courseCode: '22CSP10', facultyId: 'FWL-03', day: 'THU', period: 'P7', sessionType: 'LAB' },
    { courseCode: '22CSP10', facultyId: 'FWL-03', day: 'THU', period: 'P8', sessionType: 'LAB' },
  ];
  const valMultiLabValid = validateTimetable(multiLabValid, {
    resolvedRequirements: [
      { courseCode: '22CSP09', totalPeriod: 4, isLab: true },
      { courseCode: '22CSP10', totalPeriod: 4, isLab: true },
    ],
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
  });
  assert(valMultiLabValid.isValid, 'Multi-lab with 1 morning and 1 afternoon lab passes validation');

  console.log('\n--- 5. Single-Lab Morning Preference & Afternoon Fallback ---');
  // Helper isLabPlacementValid allows morning for single lab
  const labValidMorning = isLabPlacementValid(
    'MON',
    ['P1', 'P2', 'P3', 'P4'],
    '22CSP09',
    'FWL-14',
    new Map(),
    new Map(),
    new Set(),
    { periods: DEFAULT_PERIODS },
    { totalLabsCount: 1 }
  );
  assert(labValidMorning === true, 'Single lab: morning block is valid');

  // Single lab: afternoon is valid when morning is unavailable
  const morningBlockedClassOcc = new Map([
    ['MON_P1', { courseCode: 'OCCUPIED' }],
    ['MON_P2', { courseCode: 'OCCUPIED' }],
    ['MON_P3', { courseCode: 'OCCUPIED' }],
    ['MON_P4', { courseCode: 'OCCUPIED' }],
  ]);
  const labValidAfternoonFallback = isLabPlacementValid(
    'MON',
    ['P5', 'P6', 'P7', 'P8'],
    '22CSP09',
    'FWL-14',
    morningBlockedClassOcc,
    new Map(),
    new Set(),
    { periods: DEFAULT_PERIODS },
    { totalLabsCount: 1 }
  );
  assert(labValidAfternoonFallback === true, 'Single lab: afternoon block is valid as fallback when morning occupied');

  // -------------------------------------------------------------------------
  // TEST SUITE 4: FACULTY CONFLICT PREVENTION (CRITICAL REQUIREMENT 3)
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Critical Faculty Conflict Prevention Across Multiple Classes ---');
  // Class A has Faculty X (FWL-04) on Monday P3
  const globalFacultyOccupancy = new Map([
    ['FWL-04_MON_P3', { academicContextId: 'CLASS_A', courseCode: '22CSC14' }],
  ]);

  // Class B tries to assign Faculty X (FWL-04) on Monday P3
  const isAvailableClassB = isFacultyAvailable('FWL-04', 'MON', 'P3', globalFacultyOccupancy);
  assert(isAvailableClassB === false, 'CRITICAL: Faculty FWL-04 scheduled in Class A on MON P3 is REJECTED in Class B');

  // Class B tries to assign Faculty X on Monday P4 -> Available!
  const isAvailableClassBP4 = isFacultyAvailable('FWL-04', 'MON', 'P4', globalFacultyOccupancy);
  assert(isAvailableClassBP4 === true, 'Faculty FWL-04 is available in Class B on MON P4 where Class A is not scheduled');

  // Class B tries to assign Faculty X on Tuesday P3 -> Available!
  const isAvailableClassBTue = isFacultyAvailable('FWL-04', 'TUE', 'P3', globalFacultyOccupancy);
  assert(isAvailableClassBTue === true, 'Faculty FWL-04 is available in Class B on TUE P3');

  // Multi-Class Test: Faculty X shared across Class A, Class B, and Class C
  const multiClassOcc = new Map([
    ['FWL-04_MON_P1', { academicContextId: 'CLASS_A', courseCode: '22CSC14' }],
    ['FWL-04_MON_P2', { academicContextId: 'CLASS_B', courseCode: '22CSC15' }],
  ]);
  assert(
    isFacultyAvailable('FWL-04', 'MON', 'P1', multiClassOcc) === false,
    'Class C cannot schedule Faculty X on MON P1 (occupied in Class A)'
  );
  assert(
    isFacultyAvailable('FWL-04', 'MON', 'P2', multiClassOcc) === false,
    'Class C cannot schedule Faculty X on MON P2 (occupied in Class B)'
  );
  assert(
    isFacultyAvailable('FWL-04', 'MON', 'P3', multiClassOcc) === true,
    'Class C CAN schedule Faculty X on MON P3 (free across Class A and Class B)'
  );

  console.log('\n--- 7. Faculty Availability for ALL 4 Lab Periods ---');
  // Faculty X has a lecture in Class A on Monday P2 (only 1 period out of 4)
  const facOccLabTest = new Map([
    ['FWL-04_MON_P2', { academicContextId: 'CLASS_A', courseCode: '22CSC14' }],
  ]);
  // Class B tries to assign a 4-period lab (P1-P4) with Faculty X
  const isLabAvailConflict = isFacultyAvailable('FWL-04', 'MON', ['P1', 'P2', 'P3', 'P4'], facOccLabTest);
  assert(
    isLabAvailConflict === false,
    'CRITICAL: 4-period lab rejected because Faculty X is occupied in Class A during P2 (period 2 of 4)'
  );

  // Multi-faculty lab: Primary is free, but Additional faculty (FWL-06) is occupied on P3
  const multiFacOcc = new Map([
    ['FWL-06_MON_P3', { academicContextId: 'CLASS_C', courseCode: '22CSX42' }],
  ]);
  const isMultiLabConflict = isFacultyAvailable(['FWL-04', 'FWL-06'], 'MON', ['P1', 'P2', 'P3', 'P4'], multiFacOcc);
  assert(
    isMultiLabConflict === false,
    'CRITICAL: 4-period lab rejected because secondary staff FWL-06 is occupied during P3'
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 5: VALIDATOR ENFORCEMENT OF ALL RULES
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Validator Rejects Faulty Schedules ---');
  // A. Reject 3+ consecutive theory
  const threeConsecutiveTheory = [
    { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P1', sessionType: 'THEORY' },
    { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P2', sessionType: 'THEORY' },
    { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P3', sessionType: 'THEORY' },
  ];
  const val3Consec = validateTimetable(threeConsecutiveTheory, {
    resolvedRequirements: [{ courseCode: '22CSC14', totalPeriod: 3, isLab: false }],
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
  });
  assert(!val3Consec.isValid, 'Validator rejects 3 consecutive theory periods');
  assert(val3Consec.errors.some((e) => e.code === 'THEORY_CONSECUTIVE_VIOLATION'), 'Error code THEORY_CONSECUTIVE_VIOLATION');

  // B. Reject theory filling entire session
  const fillSessionTheory = [
    { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P1', sessionType: 'THEORY' },
    { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P2', sessionType: 'THEORY' },
    { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P3', sessionType: 'THEORY' },
    { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P4', sessionType: 'THEORY' },
  ];
  const valFillSession = validateTimetable(fillSessionTheory, {
    resolvedRequirements: [{ courseCode: '22CSC14', totalPeriod: 4, isLab: false }],
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
  });
  assert(!valFillSession.isValid, 'Validator rejects theory course filling entire morning session');
  assert(valFillSession.errors.some((e) => e.code === 'THEORY_FILLS_ENTIRE_SESSION'), 'Error code THEORY_FILLS_ENTIRE_SESSION');

  // C. Reject lab not 4 periods (e.g. 3 periods)
  const threePeriodLab = [
    { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P1', sessionType: 'LAB' },
    { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P2', sessionType: 'LAB' },
    { courseCode: '22CSP09', facultyId: 'FWL-14', day: 'MON', period: 'P3', sessionType: 'LAB' },
  ];
  const val3Lab = validateTimetable(threePeriodLab, {
    resolvedRequirements: [{ courseCode: '22CSP09', totalPeriod: 3, isLab: true }],
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
  });
  assert(!val3Lab.isValid, 'Validator rejects 3-period lab (must be exactly 4 periods)');
  assert(val3Lab.errors.some((e) => e.code === 'LAB_NOT_FOUR_PERIODS'), 'Error code LAB_NOT_FOUR_PERIODS');

  // D. Reject external faculty conflict
  const extConflictSchedule = [
    { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P1', sessionType: 'THEORY' },
  ];
  const valExtConflict = validateTimetable(extConflictSchedule, {
    resolvedRequirements: [{ courseCode: '22CSC14', totalPeriod: 1, isLab: false }],
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    existingGlobalOccupancy: new Map([['FWL-04_MON_P1', { academicContextId: 'CLASS_OTHER' }]]),
  });
  assert(!valExtConflict.isValid, 'Validator rejects timetable when faculty is occupied in external class');
  assert(valExtConflict.errors.some((e) => e.code === 'GLOBAL_FACULTY_CONFLICT'), 'Error code GLOBAL_FACULTY_CONFLICT');

  // E. Reject class double-booking
  const classConflictSchedule = [
    { courseCode: '22CSC14', facultyId: 'FWL-04', day: 'MON', period: 'P1', sessionType: 'THEORY' },
    { courseCode: '22CSC15', facultyId: 'FWL-14', day: 'MON', period: 'P1', sessionType: 'THEORY' },
  ];
  const valClassConflict = validateTimetable(classConflictSchedule, {
    resolvedRequirements: [
      { courseCode: '22CSC14', totalPeriod: 1, isLab: false },
      { courseCode: '22CSC15', totalPeriod: 1, isLab: false },
    ],
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
  });
  assert(!valClassConflict.isValid, 'Validator rejects timetable when class has two subjects in one period');
  assert(valClassConflict.errors.some((e) => e.code === 'CLASS_TIME_CONFLICT'), 'Error code CLASS_TIME_CONFLICT');

  // -------------------------------------------------------------------------
  // TEST SUITE 6: SINGLE SOURCE OF TRUTH -> TWO VIEWS
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Single Source of Truth Output Views ---');
  const masterSessions = [
    {
      _id: 'sess_1',
      academicContextId: 'ctx_cse_3a',
      class: 'III Year CSE A',
      year: 'III Year',
      section: 'A',
      department: 'CSE',
      courseCode: '22CSC14',
      courseName: 'Principles of Compiler Design',
      sessionType: 'THEORY',
      facultyId: 'FWL-04',
      facultyName: 'Dr. A. Manchula',
      day: 'MON',
      period: 'P1',
      room: 'LH-101',
      duration: 1,
    },
    {
      _id: 'sess_2',
      academicContextId: 'ctx_cse_3b',
      class: 'III Year CSE B',
      year: 'III Year',
      section: 'B',
      department: 'CSE',
      courseCode: '22CSC14',
      courseName: 'Principles of Compiler Design',
      sessionType: 'THEORY',
      facultyId: 'FWL-04',
      facultyName: 'Dr. A. Manchula',
      day: 'MON',
      period: 'P2',
      room: 'LH-102',
      duration: 1,
    },
    {
      _id: 'sess_3',
      academicContextId: 'ctx_cse_3a',
      class: 'III Year CSE A',
      year: 'III Year',
      section: 'A',
      department: 'CSE',
      courseCode: '22CSP09',
      courseName: 'Full Stack Development Lab',
      sessionType: 'LAB',
      facultyId: 'FWL-14',
      facultyName: 'Ms. D. Vinoparkavi',
      day: 'TUE',
      period: 'P1',
      room: 'Systems Lab',
      duration: 4,
    },
  ];

  // A. Class Timetable for III Year CSE A
  const classTimetableA = generateClassTimetable(masterSessions, 'ctx_cse_3a');
  assert(classTimetableA.length === 2, `Class A view contains exactly 2 sessions (found ${classTimetableA.length})`);
  assert(classTimetableA[0].courseCode === '22CSC14', 'First session in Class A is 22CSC14');
  assert(classTimetableA[0].startPeriod === 'P1', 'Start period is preserved');
  assert(classTimetableA[0].endPeriod === 'P1', 'End period is preserved');
  assert(classTimetableA[0].subjectType === 'THEORY', 'Subject type is THEORY');
  assert(classTimetableA[0].faculty === 'Dr. A. Manchula', 'Faculty name is populated');
  assert(classTimetableA[0].class === 'III Year CSE A', 'Class is populated');

  // B. Faculty Timetable for Dr. A. Manchula (FWL-04)
  const facTimetableManchula = generateFacultyTimetable(masterSessions, 'FWL-04');
  assert(facTimetableManchula.length === 2, `Faculty FWL-04 view contains exactly 2 sessions (found ${facTimetableManchula.length})`);
  assert(facTimetableManchula[0].class === 'III Year CSE A', 'First session is for Class III-A');
  assert(facTimetableManchula[1].class === 'III Year CSE B', 'Second session is for Class III-B');
  assert(facTimetableManchula[0].period === 'P1' && facTimetableManchula[1].period === 'P2', 'Periods are MON P1 and MON P2');

  // -------------------------------------------------------------------------
  // TEST SUITE 7: REGENERATION & CONSTRAINT-BASED RANDOMIZATION
  // -------------------------------------------------------------------------
  console.log('\n--- 10. Constraint-Based Randomization & Regeneration ---');
  const rngSeed1 = new SeededRandom(12345);
  const rngSeed2 = new SeededRandom(67890);
  assert(rngSeed1.next() !== rngSeed2.next(), 'Different seeds produce different random sequences');

  // Build a test scheduling problem with 1 Lab + 4 Theory subjects
  const labVariables = [
    { id: 'LAB_1', courseCode: '22CSP09', courseName: 'FSD Lab', facultyId: 'FWL-14', isLab: true, duration: 4 },
  ];
  const theoryVariables = [
    { id: 'T_1', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
    { id: 'T_2', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
    { id: 'T_3', courseCode: '22CSC15', courseName: 'Full Stack Dev', facultyId: 'FWL-14', isLab: false, duration: 1 },
    { id: 'T_4', courseCode: '22CSC16', courseName: 'OOSE', facultyId: 'FWL-03', isLab: false, duration: 1 },
  ];

  function runScheduleGeneration(seed) {
    const state = {
      classOccupancy: new Map(),
      globalFacultyOccupancy: new Map(),
      facultyUnavailableSet: new Set(),
      scheduledLabs: [],
      assignments: new Map(),
    };
    const context = {
      gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
      totalLabsCount: 1,
      rng: new SeededRandom(seed),
      hodAllocationsMap: new Map(),
    };

    // 1. Generate Labs first
    const labSuccess = generateLabSchedule(labVariables, state, context);
    // 2. Generate Theory second
    const theorySuccess = generateTheorySchedule(theoryVariables, state, context);

    const generated = Array.from(state.assignments.values()).flatMap((v) =>
      v.periods.map((p) => ({
        courseCode: v.courseCode,
        courseName: v.courseName,
        facultyId: v.facultyId,
        sessionType: v.isLab ? 'LAB' : 'THEORY',
        day: v.day,
        period: p,
      }))
    );

    return { labSuccess, theorySuccess, state, generated };
  }

  const run1 = runScheduleGeneration(101);
  assert(run1.labSuccess && run1.theorySuccess, 'Generation run 1 succeeds (Lab-first + Theory-second)');
  assert(run1.generated.length === 8, `Run 1 scheduled all 8 periods (4 lab + 4 theory, found ${run1.generated.length})`);

  const run2 = runScheduleGeneration(999);
  assert(run2.labSuccess && run2.theorySuccess, 'Generation run 2 with different seed succeeds');

  // Validate run 1 schedule against all rules
  const valRun1 = validateTimetable(run1.generated, {
    resolvedRequirements: [
      { courseCode: '22CSP09', totalPeriod: 4, isLab: true },
      { courseCode: '22CSC14', totalPeriod: 2, isLab: false },
      { courseCode: '22CSC15', totalPeriod: 1, isLab: false },
      { courseCode: '22CSC16', totalPeriod: 1, isLab: false },
    ],
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
  });
  assert(valRun1.isValid, 'Generated schedule passes independent 10-point hard validation pass');

  // Both runs satisfy all constraints
  const valRun2 = validateTimetable(run2.generated, {
    resolvedRequirements: [
      { courseCode: '22CSP09', totalPeriod: 4, isLab: true },
      { courseCode: '22CSC14', totalPeriod: 2, isLab: false },
      { courseCode: '22CSC15', totalPeriod: 1, isLab: false },
      { courseCode: '22CSC16', totalPeriod: 1, isLab: false },
    ],
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
  });
  assert(valRun2.isValid, 'Run 2 schedule also passes validation');

  // -------------------------------------------------------------------------
  // TEST SUITE 8: MULTIPLE CLASSES SHARING SAME FACULTY (CLASS A & CLASS B)
  // -------------------------------------------------------------------------
  console.log('\n--- 11. Multi-Class Timetable Generation Sharing Same Faculty ---');
  // Shared Faculty: Dr. A. Manchula (FWL-04) teaches 3 periods of Theory in Class A AND 3 periods of Theory in Class B
  // Shared Faculty: Ms. D. Vinoparkavi (FWL-14) conducts 4-period Lab in Class A AND 4-period Lab in Class B

  // Step 1: Generate Class A
  const stateClassA = {
    classOccupancy: new Map(),
    globalFacultyOccupancy: new Map(),
    facultyUnavailableSet: new Set(),
    scheduledLabs: [],
    assignments: new Map(),
  };
  const contextClassA = {
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    totalLabsCount: 1,
    rng: new SeededRandom(2026),
    hodAllocationsMap: new Map(),
  };
  const labVarsClassA = [
    { id: 'CLA_LAB', courseCode: '22CSP09', courseName: 'FSD Lab', facultyId: 'FWL-14', isLab: true, duration: 4 },
  ];
  const theoryVarsClassA = [
    { id: 'CLA_T1', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
    { id: 'CLA_T2', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
    { id: 'CLA_T3', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
  ];

  const classALabSuccess = generateLabSchedule(labVarsClassA, stateClassA, contextClassA);
  const classATheorySuccess = generateTheorySchedule(theoryVarsClassA, stateClassA, contextClassA);
  assert(classALabSuccess && classATheorySuccess, 'Class A generated successfully (1 Lab + 3 Theory)');

  const classASessions = Array.from(stateClassA.assignments.values()).flatMap((v) =>
    v.periods.map((p) => ({
      academicContextId: 'CLASS_A',
      class: 'III Year CSE A',
      courseCode: v.courseCode,
      courseName: v.courseName,
      facultyId: v.facultyId,
      sessionType: v.isLab ? 'LAB' : 'THEORY',
      day: v.day,
      period: p,
      duration: v.duration,
    }))
  );

  // Step 2: Feed Class A's schedule into Global Faculty Occupancy for Class B
  const globalFacultyOccupancyForB = new Map();
  classASessions.forEach((s) => {
    globalFacultyOccupancyForB.set(`${s.facultyId}_${s.day}_${s.period}`, {
      academicContextId: s.academicContextId,
      courseCode: s.courseCode,
      sessionType: s.sessionType,
    });
  });

  // Verify FWL-04 has 3 slots occupied and FWL-14 has 4 slots occupied
  const fwl04ClassASlots = classASessions.filter((s) => s.facultyId === 'FWL-04');
  const fwl14ClassASlots = classASessions.filter((s) => s.facultyId === 'FWL-14');
  assert(fwl04ClassASlots.length === 3, `Class A has exactly 3 periods for FWL-04 (found ${fwl04ClassASlots.length})`);
  assert(fwl14ClassASlots.length === 4, `Class A has exactly 4 periods (Lab) for FWL-14 (found ${fwl14ClassASlots.length})`);

  // Step 3: Generate Class B with the SAME faculty members
  const stateClassB = {
    classOccupancy: new Map(),
    globalFacultyOccupancy: new Map(globalFacultyOccupancyForB),
    facultyUnavailableSet: new Set(),
    scheduledLabs: [],
    assignments: new Map(),
  };
  const contextClassB = {
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    totalLabsCount: 1,
    rng: new SeededRandom(2027),
    hodAllocationsMap: new Map(),
  };
  const labVarsClassB = [
    { id: 'CLB_LAB', courseCode: '22CSP09', courseName: 'FSD Lab', facultyId: 'FWL-14', isLab: true, duration: 4 },
  ];
  const theoryVarsClassB = [
    { id: 'CLB_T1', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
    { id: 'CLB_T2', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
    { id: 'CLB_T3', courseCode: '22CSC14', courseName: 'Compiler Design', facultyId: 'FWL-04', isLab: false, duration: 1 },
  ];

  const classBLabSuccess = generateLabSchedule(labVarsClassB, stateClassB, contextClassB);
  const classBTheorySuccess = generateTheorySchedule(theoryVarsClassB, stateClassB, contextClassB);
  assert(classBLabSuccess && classBTheorySuccess, 'Class B generated successfully with same shared faculty');

  const classBSessions = Array.from(stateClassB.assignments.values()).flatMap((v) =>
    v.periods.map((p) => ({
      academicContextId: 'CLASS_B',
      class: 'III Year CSE B',
      courseCode: v.courseCode,
      courseName: v.courseName,
      facultyId: v.facultyId,
      sessionType: v.isLab ? 'LAB' : 'THEORY',
      day: v.day,
      period: p,
      duration: v.duration,
    }))
  );

  // Step 4: Verify ZERO collision between Class A and Class B for shared faculty
  const classASlotKeys = new Set(classASessions.map((s) => `${s.facultyId}_${s.day}_${s.period}`));
  const overlappingSlots = classBSessions.filter((s) => classASlotKeys.has(`${s.facultyId}_${s.day}_${s.period}`));

  assert(overlappingSlots.length === 0, `ZERO faculty overlap between Class A and Class B (found ${overlappingSlots.length} collisions)`);

  // Step 5: Verify multi-class validator pass for Class B against Class A occupancy
  const valClassB = validateTimetable(classBSessions, {
    resolvedRequirements: [
      { courseCode: '22CSP09', totalPeriod: 4, isLab: true },
      { courseCode: '22CSC14', totalPeriod: 3, isLab: false },
    ],
    gridConfig: { days: DEFAULT_DAYS, periods: DEFAULT_PERIODS },
    existingGlobalOccupancy: globalFacultyOccupancyForB,
  });
  assert(valClassB.isValid, 'Class B timetable passes validation with external Class A occupancy active');

  // Step 6: Verify Single Source of Truth produces correct Faculty Timetables for shared faculty
  const combinedSessions = [...classASessions, ...classBSessions];
  const fwl04CombinedTimetable = generateFacultyTimetable(combinedSessions, 'FWL-04');
  assert(fwl04CombinedTimetable.length === 6, `Dr. A. Manchula has 6 total periods across both classes (found ${fwl04CombinedTimetable.length})`);
  assert(fwl04CombinedTimetable.filter((s) => s.class === 'III Year CSE A').length === 3, 'Manchula timetable has 3 periods in Class A');
  assert(fwl04CombinedTimetable.filter((s) => s.class === 'III Year CSE B').length === 3, 'Manchula timetable has 3 periods in Class B');

  const fwl14CombinedTimetable = generateFacultyTimetable(combinedSessions, 'FWL-14');
  assert(fwl14CombinedTimetable.length === 8, `Ms. D. Vinoparkavi has 8 total lab periods across both classes (found ${fwl14CombinedTimetable.length})`);
  assert(fwl14CombinedTimetable.filter((s) => s.class === 'III Year CSE A').length === 4, 'Vinoparkavi timetable has 4 lab periods in Class A');
  assert(fwl14CombinedTimetable.filter((s) => s.class === 'III Year CSE B').length === 4, 'Vinoparkavi timetable has 4 lab periods in Class B');

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passCount} Passed, ${failCount} Failed`);
  console.log('============================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('[Test Error]:', err);
  process.exit(1);
});
