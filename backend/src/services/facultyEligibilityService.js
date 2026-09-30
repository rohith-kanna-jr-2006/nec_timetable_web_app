const Faculty = require('../models/Faculty');

/**
 * Normalizes institution department naming variations to canonical department tokens.
 */
function normalizeDepartment(dept) {
  if (!dept) return '';
  const s = String(dept).toUpperCase().trim();
  if (s.includes('COMPUTER SCIENCE') || s.includes('CSE')) return 'CSE';
  if (s.includes('ELECTRONICS') || s.includes('ECE')) return 'ECE';
  if (s.includes('MECHANICAL') || s.includes('MECH')) return 'MECH';
  if (s.includes('CIVIL')) return 'CIVIL';
  if (s.includes('ELECTRICAL') || s.includes('EEE')) return 'EEE';
  if (s.includes('INFORMATION') || s.includes('IT')) return 'IT';
  if (s.includes('MATH') || s.includes('MATHEMATICS')) return 'MATHEMATICS';
  if (s.includes('ENGLISH')) return 'ENGLISH';
  if (s.includes('SCIENCE & HUMANITIES') || s.includes('H&S')) return 'H&S';
  return s;
}

/**
 * Reusable faculty eligibility service.
 * Queries the authoritative Faculty collection in MongoDB and returns active faculty
 * belonging to the specified department, sorted by facultyName.
 *
 * @param {Object} options
 * @param {string} options.department - Department name or token (e.g. 'Mathematics', 'MATHEMATICS', 'English')
 * @param {boolean} [options.activeOnly=true] - Only include active faculty (isActive: true)
 * @returns {Promise<Array<{facultyId: string, facultyName: string, designation: string, department: string}>>}
 */
async function getEligibleFacultyByDepartment({ department, activeOnly = true } = {}) {
  const normDept = normalizeDepartment(department);
  if (!normDept) return [];

  const query = {};
  if (activeOnly) {
    query.isActive = true;
  }

  const facultyDocs = await Faculty.find(query).sort({ facultyName: 1 });

  return facultyDocs
    .filter((f) => normalizeDepartment(f.department) === normDept)
    .map((f) => ({
      facultyId: f.facultyId,
      facultyName: f.facultyName,
      designation: f.designation,
      department: f.department,
      isActive: f.isActive,
    }));
}

/**
 * Batch-loads eligible faculty for multiple departments in a single database query.
 *
 * @param {Array<string>} departments - Array of departments to query
 * @param {boolean} [activeOnly=true]
 * @returns {Promise<Map<string, Array<Object>>>} Map of normalizedDepartment -> Array of faculty
 */
async function getEligibleFacultyBatch(departments = [], activeOnly = true) {
  const normalizedTargets = new Set(departments.map(normalizeDepartment).filter(Boolean));
  if (normalizedTargets.size === 0) return new Map();

  const query = {};
  if (activeOnly) {
    query.isActive = true;
  }

  const facultyDocs = await Faculty.find(query).sort({ facultyName: 1 });
  const resultMap = new Map();

  for (const target of normalizedTargets) {
    resultMap.set(target, []);
  }

  for (const f of facultyDocs) {
    const fDept = normalizeDepartment(f.department);
    if (normalizedTargets.has(fDept)) {
      resultMap.get(fDept).push({
        facultyId: f.facultyId,
        facultyName: f.facultyName,
        designation: f.designation,
        department: f.department,
        isActive: f.isActive,
      });
    }
  }

  return resultMap;
}

module.exports = {
  normalizeDepartment,
  getEligibleFacultyByDepartment,
  getEligibleFacultyBatch,
};
