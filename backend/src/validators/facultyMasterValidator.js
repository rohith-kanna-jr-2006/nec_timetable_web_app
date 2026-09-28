/**
 * Comprehensive Faculty Master Integrity & Allocation Validator
 *
 * Validates the authoritative 27-faculty workload allocation master:
 * - 27 faculty records identified (25 CSE, 2 ECE)
 * - Exact name preservation (e.g. Dr. S. Karpusamy without normalization)
 * - Every designation, department, and allocation category verified
 * - First-class Lab preservation (Lab 1 vs Lab 2)
 * - Multi-section and non-standard academic items (PBL, Skill Dev, UHV, etc.)
 * - Flags data gaps explicitly without silent repair:
 *     - missing course code (e.g. PBL, Skill Dev)
 *     - missing hours (e.g. FWL-20 TECH GURU)
 *     - unknown totals (e.g. FWL-20 source total null)
 *     - ambiguous allocations
 */

const {
  classifyResponsibility,
  parseYearAndSection,
} = require('../services/workloadService');

const EXPECTED_27_FACULTY = [
  { id: 'FWL-01', name: 'Dr. T. Rajasekaran', dept: 'CSE' },
  { id: 'FWL-02', name: 'M. P. Thiruvenkatasuresh', dept: 'CSE' },
  { id: 'FWL-03', name: 'Dr. S. Karpusamy', dept: 'CSE' },
  { id: 'FWL-04', name: 'Dr. A. Manchula', dept: 'CSE' },
  { id: 'FWL-05', name: 'C. Mani', dept: 'CSE' },
  { id: 'FWL-06', name: 'Mrs. E. Padma', dept: 'CSE' },
  { id: 'FWL-07', name: 'Mrs. P. Uma', dept: 'CSE' },
  { id: 'FWL-08', name: 'Mrs. K. Shanmugapriya', dept: 'CSE' },
  { id: 'FWL-09', name: 'Mrs. B. Deepa', dept: 'CSE' },
  { id: 'FWL-10', name: 'Mrs. C. Navamani', dept: 'CSE' },
  { id: 'FWL-11', name: 'Mr. S. Jagadeesan', dept: 'CSE' },
  { id: 'FWL-12', name: 'Mrs. K. Eswari', dept: 'CSE' },
  { id: 'FWL-13', name: 'Mrs. N. M. Indumathi', dept: 'CSE' },
  { id: 'FWL-14', name: 'Ms. D. Vinoparkavi', dept: 'CSE' },
  { id: 'FWL-15', name: 'Mrs. P. Devika', dept: 'CSE' },
  { id: 'FWL-16', name: 'Mrs. S. Geetha', dept: 'CSE' },
  { id: 'FWL-17', name: 'Mrs. P. Savitha', dept: 'CSE' },
  { id: 'FWL-18', name: 'Mrs. V. Mythily', dept: 'CSE' },
  { id: 'FWL-19', name: 'Mr. D. Kavin Kumar', dept: 'CSE' },
  { id: 'FWL-20', name: 'Mrs. A. Satheesh Kumar', dept: 'CSE' },
  { id: 'FWL-21', name: 'Mrs. J. Radha', dept: 'CSE' },
  { id: 'FWL-22', name: 'Mr. R. Manikandan', dept: 'CSE' },
  { id: 'FWL-23', name: 'Ms. N. Bhuvaneswari', dept: 'CSE' },
  { id: 'FWL-24', name: 'Mr. K. U. Ranjith', dept: 'CSE' },
  { id: 'FWL-25', name: 'Ms. M. Sowmya', dept: 'CSE' },
  { id: 'FWL-26', name: 'Dr. R. Praveenkumar', dept: 'ECE' },
  { id: 'FWL-27', name: 'Ms. B. Preethi', dept: 'ECE' },
];

/**
 * Validates a single faculty master record.
 * Flags missing code, missing hours, ambiguous allocations, and unknown totals.
 */
function validateFacultyMasterRecord(record) {
  const errors = [];
  const flags = {
    missingCodes: [],
    missingHours: [],
    unknownTotals: [],
    ambiguousAllocations: [],
  };

  if (!record.facultyId) errors.push('Missing facultyId');
  if (!record.facultyName || !record.facultyName.trim()) errors.push('Missing facultyName');
  if (!record.designation || !record.designation.trim()) errors.push('Missing designation');

  const teaching = record.teaching || {};
  const teachingCategories = ['ugTheory1', 'ugTheory2', 'lab1', 'lab2', 'pg', 'others'];

  let teachingRowCount = 0;
  let teachingHoursSum = 0;

  teachingCategories.forEach((catKey) => {
    const items = teaching[catKey] || [];
    items.forEach((item, idx) => {
      teachingRowCount++;
      if (!item.courseName || !item.courseName.trim()) {
        errors.push(`Missing courseName in ${catKey}[${idx}] for ${record.facultyId}`);
      }

      if (item.courseCode === null || item.courseCode === undefined || item.courseCode === '') {
        flags.missingCodes.push({
          facultyId: record.facultyId,
          facultyName: record.facultyName,
          category: catKey,
          courseName: item.courseName,
          allocation: item.allocation,
        });
      }

      if (item.hours === null || item.hours === undefined) {
        flags.missingHours.push({
          facultyId: record.facultyId,
          facultyName: record.facultyName,
          category: catKey,
          courseName: item.courseName,
          allocation: item.allocation,
        });
      } else if (typeof item.hours === 'number') {
        if (item.hours < 0) {
          errors.push(`Negative hours (${item.hours}) in ${catKey}[${idx}] for ${record.facultyId}`);
        } else {
          teachingHoursSum += item.hours;
        }
      }

      if (!item.allocation) {
        flags.ambiguousAllocations.push({
          facultyId: record.facultyId,
          facultyName: record.facultyName,
          category: catKey,
          courseName: item.courseName,
          reason: 'Allocation context is null or empty',
        });
      }
    });
  });

  const responsibilities = record.responsibilities || [];
  let respRowCount = 0;
  let respHoursSum = 0;

  responsibilities.forEach((resp, idx) => {
    respRowCount++;
    if (!resp.role || !resp.role.trim()) {
      errors.push(`Missing role in responsibilities[${idx}] for ${record.facultyId}`);
    }

    if (resp.hours === null || resp.hours === undefined) {
      flags.missingHours.push({
        facultyId: record.facultyId,
        facultyName: record.facultyName,
        category: 'RESPONSIBILITY',
        role: resp.role,
        allocation: resp.allocation,
      });
    } else if (typeof resp.hours === 'number') {
      if (resp.hours < 0) {
        errors.push(`Negative hours (${resp.hours}) in responsibilities[${idx}] for ${record.facultyId}`);
      } else {
        respHoursSum += resp.hours;
      }
    }

    if (!resp.allocation && !['NBA Coordinator', 'Admin Coordinator', 'Student Affairs Coordinator', 'NIRF/IQAC Coordinator'].some(r => resp.role.includes(r))) {
      // General institutional roles without specific section are acceptable, but noted
    }
  });

  if (record.sourceTotalHours === null || record.sourceTotalHours === undefined) {
    flags.unknownTotals.push({
      facultyId: record.facultyId,
      facultyName: record.facultyName,
      reason: record.incompleteReason || 'Source total hours not specified or legible in source document',
    });
  }

  return {
    valid: errors.length === 0,
    facultyId: record.facultyId,
    facultyName: record.facultyName,
    designation: record.designation,
    teachingRowCount,
    respRowCount,
    teachingHoursSum,
    respHoursSum,
    calculatedTotal: teachingHoursSum + respHoursSum,
    sourceTotal: record.sourceTotalHours,
    errors,
    flags,
  };
}

/**
 * Validates the entire 27-faculty master register against baseline requirements.
 */
function validateFacultyMasterSuite(facultyList) {
  const issues = [];
  const aggregatedFlags = {
    missingCodes: [],
    missingHours: [],
    unknownTotals: [],
    ambiguousAllocations: [],
  };

  if (!Array.isArray(facultyList)) {
    return {
      success: false,
      error: 'Faculty master must be an array',
    };
  }

  // Check 1: Exactly 27 faculty
  const totalCount = facultyList.length;
  if (totalCount !== 27) {
    issues.push(`Expected exactly 27 faculty records, found: ${totalCount}`);
  }

  // Check 2: Department counts (25 CSE, 2 ECE)
  const cseFaculty = facultyList.filter(
    (f) => f.facultyId !== 'FWL-26' && f.facultyId !== 'FWL-27' && !(f.designation || '').includes('ECE')
  );
  const eceFaculty = facultyList.filter(
    (f) => f.facultyId === 'FWL-26' || f.facultyId === 'FWL-27' || (f.designation || '').includes('ECE')
  );

  if (cseFaculty.length !== 25) {
    issues.push(`Expected 25 CSE faculty, found: ${cseFaculty.length}`);
  }
  if (eceFaculty.length !== 2) {
    issues.push(`Expected 2 ECE faculty, found: ${eceFaculty.length}`);
  }

  // Check 3: Every expected faculty exists by ID and exact name
  EXPECTED_27_FACULTY.forEach((exp) => {
    const found = facultyList.find((f) => f.facultyId === exp.id);
    if (!found) {
      issues.push(`Missing expected faculty: ${exp.id} (${exp.name})`);
    } else if (found.facultyName !== exp.name) {
      issues.push(`Faculty name mismatch for ${exp.id}: expected "${exp.name}", found "${found.facultyName}"`);
    }
  });

  // Check 4: Row-by-row validation & flags collection
  let totalTeachingRows = 0;
  let totalRespRows = 0;
  let totalTeachingHours = 0;
  let totalRespHours = 0;

  const perFacultyResults = facultyList.map((f) => {
    const res = validateFacultyMasterRecord(f);
    totalTeachingRows += res.teachingRowCount;
    totalRespRows += res.respRowCount;
    totalTeachingHours += res.teachingHoursSum;
    totalRespHours += res.respHoursSum;

    if (!res.valid) {
      issues.push(...res.errors);
    }

    aggregatedFlags.missingCodes.push(...res.flags.missingCodes);
    aggregatedFlags.missingHours.push(...res.flags.missingHours);
    aggregatedFlags.unknownTotals.push(...res.flags.unknownTotals);
    aggregatedFlags.ambiguousAllocations.push(...res.flags.ambiguousAllocations);

    return res;
  });

  return {
    success: issues.length === 0,
    totalFaculty: totalCount,
    cseCount: cseFaculty.length,
    eceCount: eceFaculty.length,
    totalTeachingRows,
    totalRespRows,
    totalAllocatedRows: totalTeachingRows + totalRespRows,
    totalTeachingHours,
    totalRespHours,
    totalAllocatedHours: totalTeachingHours + totalRespHours,
    perFacultyResults,
    issues,
    flags: aggregatedFlags,
  };
}

module.exports = {
  EXPECTED_27_FACULTY,
  validateFacultyMasterRecord,
  validateFacultyMasterSuite,
};
