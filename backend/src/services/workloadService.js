const FacultyWorkload = require('../models/FacultyWorkload');

/**
 * Calculates sum of teaching contact hours across all categories.
 */
function calculateTeachingHours(teaching = {}) {
  let sum = 0;
  if (!teaching || typeof teaching !== 'object') return sum;

  const categories = ['ugTheory1', 'ugTheory2', 'lab1', 'lab2', 'pg', 'others'];
  categories.forEach((catKey) => {
    const items = teaching[catKey];
    if (Array.isArray(items)) {
      items.forEach((item) => {
        sum += item.hours || 0;
      });
    }
  });

  return sum;
}

/**
 * Calculates sum of responsibility hours.
 * Handles null/unknown hours gracefully without treating null as 0.
 */
function calculateResponsibilityHours(responsibilities = []) {
  let sum = 0;
  if (Array.isArray(responsibilities)) {
    responsibilities.forEach((item) => {
      if (typeof item.hours === 'number' && !isNaN(item.hours)) {
        sum += item.hours;
      }
    });
  }
  return sum;
}

/**
 * Classifies an institutional responsibility into standard domain categories:
 * - Academic (Class Advisor, Proctor, Academic Coordinator, etc.)
 * - Administrative (Admin Coordinator, Lab Incharge, DCOE, AICTE, etc.)
 * - Coordination (NBA, CIPD, Timetable, Placement, NIRF, etc.)
 * - Institutional (TECH GURU, Website, Newsletter, Alumni, Clubs, etc.)
 */
function classifyResponsibility(role) {
  if (!role) return 'Institutional';
  const r = role.toLowerCase().trim();

  // Academic duties
  if (
    r.includes('academic coordinator') ||
    r.includes('class advisor') ||
    r.includes('proctor') ||
    r.includes('student affairs') ||
    r.includes('one credit')
  ) {
    return 'Academic';
  }

  // Administrative duties
  if (
    r.includes('admin') ||
    r.includes('lab incharge') ||
    r.includes('lab i/c') ||
    r.includes('dcoe') ||
    r.includes('exam cell') ||
    r.includes('aicte') ||
    r.includes('affiliation') ||
    r.includes('infrastructure') ||
    r.includes('maintenance') ||
    r.includes('minutes')
  ) {
    return 'Administrative';
  }

  // Coordination duties
  if (
    r.includes('nba') ||
    r.includes('naac') ||
    r.includes('cipd') ||
    r.includes('bos') ||
    r.includes('p&ea') ||
    r.includes('nirf') ||
    r.includes('iqac') ||
    r.includes('timetable') ||
    r.includes('placement') ||
    r.includes('industrial relations') ||
    r.includes('mou') ||
    r.includes('internship') ||
    r.includes('cfir') ||
    r.includes('rsd') ||
    r.includes('nptel')
  ) {
    return 'Coordination';
  }

  return 'Institutional';
}

/**
 * Parses academic year and section from unstructured allocation strings.
 * e.g. "UG III Year B" -> { year: "III Year", section: "B" }
 * e.g. "II Year C"     -> { year: "II Year",  section: "C" }
 * e.g. "PG I Year"     -> { year: "I Year",   section: null }
 */
function parseYearAndSection(allocationStr) {
  if (!allocationStr || typeof allocationStr !== 'string') {
    return { year: null, section: null };
  }
  const s = allocationStr.trim();
  let year = null;
  let section = null;

  const yMatch = s.match(/(I{1,3}|IV)\s*Year/i);
  if (yMatch) {
    year = yMatch[1].toUpperCase() + ' Year';
  } else if (/BSC/i.test(s)) {
    year = 'BSC';
  }

  const secMatch = s.match(/\b([A-D])\b/);
  if (secMatch) {
    section = secMatch[1].toUpperCase();
  }

  return { year, section };
}

/**
 * Formats a faculty workload profile into the frontend-facing structure:
 * Teaching Load:
 *   ├── UG Theory
 *   ├── Labs
 *   ├── PG
 *   └── Others
 * Responsibilities:
 *   ├── Academic
 *   ├── Administrative
 *   ├── Coordination
 *   └── Other institutional duties
 * Plus flat allocation list and optional query filtering.
 */
function formatFacultyAllocations(workloadRecord, filters = {}) {
  const { category, year, section, courseCode, allocationType } = filters;

  const teaching = workloadRecord.teaching || {};
  const responsibilities = workloadRecord.responsibilities || [];

  // Group teaching allocations
  const ugTheory = (teaching.ugTheory1 || [])
    .concat(teaching.ugTheory2 || [])
    .map((item) => {
      const parsed = parseYearAndSection(item.allocation);
      return {
        ...item.toObject ? item.toObject() : item,
        allocationType: 'UG_THEORY',
        year: item.year || parsed.year,
        section: item.section || parsed.section,
      };
    });

  const labs = (teaching.lab1 || [])
    .concat(teaching.lab2 || [])
    .map((item) => {
      const parsed = parseYearAndSection(item.allocation);
      return {
        ...item.toObject ? item.toObject() : item,
        allocationType: 'LAB',
        year: item.year || parsed.year,
        section: item.section || parsed.section,
      };
    });

  const pg = (teaching.pg || []).map((item) => {
    const parsed = parseYearAndSection(item.allocation);
    return {
      ...item.toObject ? item.toObject() : item,
      allocationType: 'PG',
      year: item.year || parsed.year,
      section: item.section || parsed.section,
    };
  });

  const others = (teaching.others || []).map((item) => {
    const parsed = parseYearAndSection(item.allocation);
    return {
      ...item.toObject ? item.toObject() : item,
      allocationType: 'OTHERS',
      year: item.year || parsed.year,
      section: item.section || parsed.section,
    };
  });

  // Group responsibilities
  const academic = [];
  const administrative = [];
  const coordination = [];
  const institutional = [];

  responsibilities.forEach((r) => {
    const item = r.toObject ? r.toObject() : r;
    const type = item.responsibilityType || classifyResponsibility(item.role);
    const parsed = parseYearAndSection(item.allocation);
    const enriched = {
      ...item,
      responsibilityType: type,
      year: item.year || parsed.year,
      section: item.section || parsed.section,
    };

    if (type === 'Academic') academic.push(enriched);
    else if (type === 'Administrative') administrative.push(enriched);
    else if (type === 'Coordination') coordination.push(enriched);
    else institutional.push(enriched);
  });

  // Flat allocations
  let allAllocations = [
    ...ugTheory,
    ...labs,
    ...pg,
    ...others,
    ...academic.map((r) => ({ ...r, allocationType: 'RESPONSIBILITY' })),
    ...administrative.map((r) => ({ ...r, allocationType: 'RESPONSIBILITY' })),
    ...coordination.map((r) => ({ ...r, allocationType: 'RESPONSIBILITY' })),
    ...institutional.map((r) => ({ ...r, allocationType: 'RESPONSIBILITY' })),
  ];

  // Apply filters if requested
  if (category) {
    const catUpper = category.toUpperCase();
    allAllocations = allAllocations.filter((a) => (a.category || '').toUpperCase().includes(catUpper));
  }
  if (allocationType) {
    const atUpper = allocationType.toUpperCase();
    allAllocations = allAllocations.filter((a) => (a.allocationType || '').toUpperCase() === atUpper);
  }
  if (year) {
    const yUpper = year.toUpperCase();
    allAllocations = allAllocations.filter((a) => (a.year || '').toUpperCase().includes(yUpper));
  }
  if (section) {
    const sUpper = section.toUpperCase();
    allAllocations = allAllocations.filter((a) => (a.section || '').toUpperCase() === sUpper);
  }
  if (courseCode) {
    const ccUpper = courseCode.toUpperCase();
    allAllocations = allAllocations.filter((a) => (a.courseCode || '').toUpperCase().includes(ccUpper));
  }

  return {
    facultyId: workloadRecord.facultyId,
    facultyName: workloadRecord.facultyName,
    designation: workloadRecord.designation,
    department: workloadRecord.department || 'Department of Computer Science and Engineering',
    summary: {
      teachingHours: workloadRecord.calculatedTeachingHours,
      responsibilityHours: workloadRecord.calculatedResponsibilityHours,
      totalHours: workloadRecord.calculatedTotalHours,
      sourceTotalHours: workloadRecord.sourceTotalHours,
      status: workloadRecord.status,
      isIncomplete: workloadRecord.isIncomplete,
      incompleteReason: workloadRecord.incompleteReason,
    },
    teachingLoad: {
      ugTheory,
      labs,
      pg,
      others,
    },
    responsibilities: {
      academic,
      administrative,
      coordination,
      institutional,
    },
    allocations: allAllocations,
  };
}

/**
 * Computes deterministic totals and integrity status for a workload payload.
 */
function processWorkloadCalculations(payload) {
  const teachingHours = calculateTeachingHours(payload.teaching);
  const responsibilityHours = calculateResponsibilityHours(payload.responsibilities);
  const calculatedTotalHours = teachingHours + responsibilityHours;

  let status = 'MATCHED';
  let discrepancyNote = null;
  let isIncomplete = Boolean(payload.isIncomplete);
  let incompleteReason = payload.incompleteReason || null;

  const sourceTotal = payload.sourceTotalHours;

  if (isIncomplete || sourceTotal === null || sourceTotal === undefined) {
    status = 'INCOMPLETE SOURCE DATA';
    isIncomplete = true;
    discrepancyNote = incompleteReason || 'Source total hours not specified or legible.';
  } else if (sourceTotal !== calculatedTotalHours) {
    status = 'REVIEW REQUIRED';
    discrepancyNote = `Source total (${sourceTotal}h) does not match calculated total (${calculatedTotalHours}h). Difference: ${Math.abs(
      sourceTotal - calculatedTotalHours
    )}h.`;
  }

  return {
    calculatedTeachingHours: teachingHours,
    calculatedResponsibilityHours: responsibilityHours,
    calculatedTotalHours,
    status,
    isIncomplete,
    incompleteReason,
    discrepancyNote,
  };
}

/**
 * Aggregates workload metrics directly from MongoDB.
 * Computes dynamic totals without hardcoding numbers.
 */
async function getDynamicSummaryMetrics() {
  const aggregateResult = await FacultyWorkload.aggregate([
    {
      $group: {
        _id: null,
        totalFaculty: { $sum: 1 },
        totalTeachingHours: { $sum: '$calculatedTeachingHours' },
        totalResponsibilityHours: { $sum: '$calculatedResponsibilityHours' },
        totalAllocatedHours: { $sum: '$calculatedTotalHours' },
        completeCount: {
          $sum: { $cond: [{ $eq: ['$status', 'MATCHED'] }, 1, 0] },
        },
        incompleteCount: {
          $sum: { $cond: [{ $eq: ['$status', 'INCOMPLETE SOURCE DATA'] }, 1, 0] },
        },
        discrepancyCount: {
          $sum: { $cond: [{ $eq: ['$status', 'REVIEW REQUIRED'] }, 1, 0] },
        },
      },
    },
  ]);

  if (!aggregateResult || aggregateResult.length === 0) {
    return {
      totalFaculty: 0,
      totalTeachingHours: 0,
      totalResponsibilityHours: 0,
      totalAllocatedHours: 0,
      completeCount: 0,
      incompleteCount: 0,
      discrepancyCount: 0,
    };
  }

  const { _id, ...metrics } = aggregateResult[0];
  return metrics;
}

module.exports = {
  calculateTeachingHours,
  calculateResponsibilityHours,
  classifyResponsibility,
  parseYearAndSection,
  formatFacultyAllocations,
  processWorkloadCalculations,
  getDynamicSummaryMetrics,
};
