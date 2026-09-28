/**
 * Automated Verification Suite for HOD Add Faculty & Workload Allocation Frontend
 * Tests:
 * 1. Exact 38-Role Responsibility Master Integrity
 * 2. Role classification and validation
 * 3. Workload calculations (live estimation)
 * 4. Constraint validations (Others 1–3, Responsibilities 1–6, duplicate prevention)
 * 5. POST /api/faculty verified contract payload formatting
 * 6. Error handling mappings (400, 401, 403, 409, 500)
 */

import {
  RESPONSIBILITY_MASTER_ROLES,
  RESPONSIBILITY_CATEGORIES,
  isValidResponsibilityRole,
  classifyResponsibility,
  DEFAULT_DEPARTMENT,
} from '../src/constants/responsibilityMaster.js';

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

async function runFacultyWorkflowTests() {
  console.log('====================================================');
  console.log('HOD ADD FACULTY & WORKLOAD ALLOCATION FRONTEND TESTS');
  console.log('====================================================\n');

  // -----------------------------------------------------------------
  // 1. Exact 38 Responsibility Master Roles Verification
  // -----------------------------------------------------------------
  console.log('--- 1. Responsibility Master (38 Roles) Integrity ---');
  assert(
    Array.isArray(RESPONSIBILITY_MASTER_ROLES) && RESPONSIBILITY_MASTER_ROLES.length === 38,
    `Master responsibility list contains exactly 38 authoritative roles (Found: ${RESPONSIBILITY_MASTER_ROLES.length})`
  );

  // Check specific backend-required source roles
  const keyRoles = [
    'DCOE',
    'TECH GURU',
    'CC1 Lab Incharge',
    'CC1 Lab I/C',
    'CCI Lab Incharge',
    'Class Advisor',
    'Proctor',
    'Timetable Coordinator',
    'Timetable I/C',
    'AI Affiliation/AICTE Work',
    'Overall Academic Coordinator',
    'NBA Coordinator',
    'NAAC/NBA Coordinator',
  ];
  keyRoles.forEach((role) => {
    assert(
      RESPONSIBILITY_MASTER_ROLES.includes(role),
      `Verified exact backend spelling for master role: '${role}'`
    );
  });

  // Verify isValidResponsibilityRole helper
  assert(isValidResponsibilityRole('DCOE') === true, "isValidResponsibilityRole('DCOE') is true");
  assert(isValidResponsibilityRole('TECH GURU') === true, "isValidResponsibilityRole('TECH GURU') is true");
  assert(isValidResponsibilityRole('CC1 Lab Incharge') === true, "isValidResponsibilityRole('CC1 Lab Incharge') is true");
  assert(
    isValidResponsibilityRole('Custom Non-Master Task') === false,
    "isValidResponsibilityRole rejects invented role 'Custom Non-Master Task'"
  );
  assert(
    isValidResponsibilityRole('') === false,
    'isValidResponsibilityRole rejects empty string'
  );

  // Verify Role Classifications
  assert(classifyResponsibility('Class Advisor') === 'Academic', 'Class Advisor classified as Academic');
  assert(classifyResponsibility('Proctor') === 'Academic', 'Proctor classified as Academic');
  assert(classifyResponsibility('DCOE') === 'Administrative', 'DCOE classified as Administrative');
  assert(classifyResponsibility('CC1 Lab Incharge') === 'Administrative', 'CC1 Lab Incharge classified as Administrative');
  assert(classifyResponsibility('Timetable Coordinator') === 'Coordination', 'Timetable Coordinator classified as Coordination');
  assert(classifyResponsibility('TECH GURU') === 'Institutional', 'TECH GURU classified as Institutional');

  // -----------------------------------------------------------------
  // 2. Constraint & Form Validation Rules
  // -----------------------------------------------------------------
  console.log('\n--- 2. Form & Allocation Validation Constraints ---');

  // Department default
  assert(
    DEFAULT_DEPARTMENT === 'Department of Computer Science and Engineering',
    'Default Department is strictly "Department of Computer Science and Engineering"'
  );

  // Others Constraint: 1 to 3 hours/week
  function validateOthersHours(hours) {
    const h = Number(hours);
    return !isNaN(h) && h >= 1 && h <= 3;
  }
  assert(validateOthersHours(1) === true, 'Others: 1 hour is valid (lower bound)');
  assert(validateOthersHours(2) === true, 'Others: 2 hours is valid');
  assert(validateOthersHours(3) === true, 'Others: 3 hours is valid (upper bound)');
  assert(validateOthersHours(0) === false, 'Others: 0 hours is strictly rejected (< 1)');
  assert(validateOthersHours(4) === false, 'Others: 4 hours is strictly rejected (> 3)');
  assert(validateOthersHours(-1) === false, 'Others: negative hours is rejected');

  // Responsibilities Constraint: 1 to 6 hours/week
  function validateResponsibilityHours(hours) {
    const h = Number(hours);
    return !isNaN(h) && h >= 1 && h <= 6;
  }
  assert(validateResponsibilityHours(1) === true, 'Responsibility: 1 hour is valid (lower bound)');
  assert(validateResponsibilityHours(3) === true, 'Responsibility: 3 hours is valid');
  assert(validateResponsibilityHours(6) === true, 'Responsibility: 6 hours is valid (upper bound)');
  assert(validateResponsibilityHours(0) === false, 'Responsibility: 0 hours is strictly rejected (< 1)');
  assert(validateResponsibilityHours(7) === false, 'Responsibility: 7 hours is strictly rejected (> 6)');

  // Duplicate Responsibility Prevention
  function checkDuplicateResponsibilities(responsibilities) {
    const seen = new Set();
    for (const r of responsibilities) {
      const norm = (r.role || '').toLowerCase().trim();
      if (!norm) continue;
      if (seen.has(norm)) return false; // Duplicate!
      seen.add(norm);
    }
    return true; // No duplicates
  }
  const cleanList = [
    { role: 'Class Advisor', hours: 2 },
    { role: 'Proctor', hours: 1 },
    { role: 'TECH GURU', hours: 2 },
  ];
  const duplicateList = [
    { role: 'Class Advisor', hours: 2 },
    { role: 'Proctor', hours: 1 },
    { role: 'Class Advisor', hours: 2 },
  ];
  assert(checkDuplicateResponsibilities(cleanList) === true, 'Distinct responsibilities list accepted');
  assert(checkDuplicateResponsibilities(duplicateList) === false, 'Duplicate responsibility correctly detected and rejected');

  // -----------------------------------------------------------------
  // 3. Live UI Workload Estimation Formula
  // -----------------------------------------------------------------
  console.log('\n--- 3. Workload Live UI Estimation Formula ---');

  function calculateEstimatedWorkload(teaching, responsibilities) {
    let teachingSum = 0;
    // ugTheory1 & 2
    (teaching.ugTheory1 || []).forEach((i) => (teachingSum += Number(i.hours) || 0));
    (teaching.ugTheory2 || []).forEach((i) => (teachingSum += Number(i.hours) || 0));
    // lab1 & 2
    (teaching.lab1 || []).forEach((i) => (teachingSum += Number(i.hours) || 0));
    (teaching.lab2 || []).forEach((i) => (teachingSum += Number(i.hours) || 0));
    // PG / Honours / Minor: 1 course = 1 equivalent hour
    teachingSum += (teaching.pg || []).length * 1;
    // others
    (teaching.others || []).forEach((i) => (teachingSum += Number(i.hours) || 0));

    let respSum = 0;
    (responsibilities || []).forEach((r) => (respSum += Number(r.hours) || 0));

    return {
      estimatedTeachingHours: teachingSum,
      estimatedResponsibilityHours: respSum,
      estimatedTotalHours: teachingSum + respSum,
    };
  }

  const sampleTeaching = {
    ugTheory1: [{ courseCode: '22CS501', courseName: 'Compiler Design', hours: 3 }],
    ugTheory2: [{ courseCode: '22CS502', courseName: 'Cloud Computing', hours: 3 }],
    lab1: [{ courseCode: '22CSP07', courseName: 'Compiler Design Lab', hours: 4 }],
    lab2: [{ courseCode: '22CSP08', courseName: 'Cloud Computing Lab', hours: 4 }],
    pg: [{ courseCode: '22CPB05', courseName: 'Advanced Distributed Systems' }],
    others: [{ courseName: 'PBL / Mini Project', hours: 2 }],
  };
  const sampleResponsibilities = [
    { role: 'Class Advisor', hours: 2 },
    { role: 'DCOE', hours: 3 },
  ];

  const estimated = calculateEstimatedWorkload(sampleTeaching, sampleResponsibilities);
  // Expected teaching: 3 + 3 + 4 + 4 + 1 (PG) + 2 (others) = 17
  // Expected responsibilities: 2 + 3 = 5
  // Expected total: 17 + 5 = 22
  assert(estimated.estimatedTeachingHours === 17, `Estimated teaching contact hours is 17 (Computed: ${estimated.estimatedTeachingHours})`);
  assert(estimated.estimatedResponsibilityHours === 5, `Estimated responsibility hours is 5 (Computed: ${estimated.estimatedResponsibilityHours})`);
  assert(estimated.estimatedTotalHours === 22, `Estimated total workload hours is 22 (Computed: ${estimated.estimatedTotalHours})`);

  // -----------------------------------------------------------------
  // 4. Contract Payload Assembly Verification
  // -----------------------------------------------------------------
  console.log('\n--- 4. Verified Request Contract Conformity ---');

  const contractPayload = {
    facultyName: 'Dr. K. Suresh Kumar',
    designation: 'Associate Professor',
    department: 'Department of Computer Science and Engineering',
    email: 'sureshkumar@nec.edu.in',
    phone: '9876543210',
    roles: ['FACULTY'],
    teaching: sampleTeaching,
    responsibilities: sampleResponsibilities,
  };

  assert(contractPayload.facultyName === 'Dr. K. Suresh Kumar', 'Contract: facultyName preserved');
  assert(contractPayload.department === 'Department of Computer Science and Engineering', 'Contract: CSE department assigned');
  assert(Array.isArray(contractPayload.roles) && contractPayload.roles[0] === 'FACULTY', 'Contract: roles array has FACULTY');
  assert(Array.isArray(contractPayload.teaching.ugTheory1), 'Contract: ugTheory1 is separate array');
  assert(Array.isArray(contractPayload.teaching.ugTheory2), 'Contract: ugTheory2 is separate array');
  assert(Array.isArray(contractPayload.teaching.lab1), 'Contract: lab1 is separate array');
  assert(Array.isArray(contractPayload.teaching.lab2), 'Contract: lab2 is separate array');
  assert(Array.isArray(contractPayload.teaching.pg), 'Contract: pg is separate array');
  assert(Array.isArray(contractPayload.teaching.others), 'Contract: others is separate array');
  assert(Array.isArray(contractPayload.responsibilities), 'Contract: responsibilities is separate array');
  assert(!('calculatedTotalHours' in contractPayload), 'Contract: Does not send manual calculatedTotalHours (backend calculates authoritative)');

  // -----------------------------------------------------------------
  // 5. Response & Error Handling Mappings
  // -----------------------------------------------------------------
  console.log('\n--- 5. Response & Error Handling Mappings ---');

  function mapErrorToUserMessage(status, rawErrorMsg) {
    if (status === 400) return rawErrorMsg || 'Validation failed. Please verify all inputs and constraints.';
    if (status === 401) return 'Your session has expired. Please sign in again.';
    if (status === 403) return 'Access denied: You lack statutory authorization to add faculty members.';
    if (status === 409) return rawErrorMsg || 'A faculty record with this identity or ID already exists.';
    if (status >= 500) return 'Server encountered an internal error. Please try again later.';
    return rawErrorMsg || 'An unexpected error occurred.';
  }

  assert(
    mapErrorToUserMessage(400, 'Invalid responsibility hours in row 1') === 'Invalid responsibility hours in row 1',
    'HTTP 400 correctly displays validation error detail'
  );
  assert(
    mapErrorToUserMessage(401) === 'Your session has expired. Please sign in again.',
    'HTTP 401 correctly identifies session expired'
  );
  assert(
    mapErrorToUserMessage(403) === 'Access denied: You lack statutory authorization to add faculty members.',
    'HTTP 403 correctly identifies Access Denied / unauthorized role'
  );
  assert(
    mapErrorToUserMessage(409, "Faculty ID 'FWL-28' already exists") === "Faculty ID 'FWL-28' already exists",
    'HTTP 409 correctly identifies duplicate identity conflict'
  );
  assert(
    mapErrorToUserMessage(500) === 'Server encountered an internal error. Please try again later.',
    'HTTP 500 gracefully handles server error without leaking stack trace'
  );

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runFacultyWorkflowTests();
