const FacultyWorkload = require('../models/FacultyWorkload');
const {
  processWorkloadCalculations,
  parseYearAndSection,
  classifyResponsibility,
} = require('../services/workloadService');

async function seedWorkload() {
  console.log('[Seed] Importing authoritative workload master data from constants/workloadMasterData.js...');
  const workloadModule = await import('../data/workloadMasterData.js');
  const masterData = workloadModule.FACULTY_WORKLOAD_MASTER;

  if (!masterData || masterData.length !== 27) {
    throw new Error(`Expected exactly 27 faculty records in source, but found: ${masterData ? masterData.length : 0}`);
  }

  const mapTeachingItem = (item) => {
    const parsed = parseYearAndSection(item.allocation);
    return {
      category: item.category,
      courseCode: item.courseCode !== undefined ? item.courseCode : null,
      courseName: item.courseName,
      allocation: item.allocation,
      hours: item.hours !== undefined ? item.hours : null,
      year: item.year || parsed.year,
      section: item.section || parsed.section,
    };
  };

  const mapRespItem = (resp) => {
    const parsed = parseYearAndSection(resp.allocation);
    return {
      category: resp.category || 'RESPONSIBILITY',
      role: resp.role,
      allocation: resp.allocation,
      hours: resp.hours !== undefined ? resp.hours : null,
      responsibilityType: resp.responsibilityType || classifyResponsibility(resp.role),
      year: resp.year || parsed.year,
      section: resp.section || parsed.section,
    };
  };

  const workloadDocs = masterData.map((f) => {
    const calc = processWorkloadCalculations(f);
    const isECE = f.facultyId === 'FWL-26' || f.facultyId === 'FWL-27' || (f.designation || '').includes('ECE');
    const department = isECE
      ? 'Department of Electronics and Communication Engineering'
      : 'Department of Computer Science and Engineering';

    return {
      facultyId: f.facultyId,
      facultyName: f.facultyName,
      designation: f.designation,
      department,
      teaching: {
        ugTheory1: (f.teaching?.ugTheory1 || []).map(mapTeachingItem),
        ugTheory2: (f.teaching?.ugTheory2 || []).map(mapTeachingItem),
        lab1: (f.teaching?.lab1 || []).map(mapTeachingItem),
        lab2: (f.teaching?.lab2 || []).map(mapTeachingItem),
        pg: (f.teaching?.pg || []).map(mapTeachingItem),
        others: (f.teaching?.others || []).map(mapTeachingItem),
      },
      responsibilities: (f.responsibilities || []).map(mapRespItem),
      sourceTotalHours: f.sourceTotalHours !== undefined ? f.sourceTotalHours : null,
      calculatedTeachingHours: calc.calculatedTeachingHours,
      calculatedResponsibilityHours: calc.calculatedResponsibilityHours,
      calculatedTotalHours: calc.calculatedTotalHours,
      status: calc.status,
      isIncomplete: calc.isIncomplete,
      incompleteReason: calc.incompleteReason,
      discrepancyNote: calc.discrepancyNote,
      sourceVersion: 'v1.0-master-register',
    };
  });

  // Phase 12: reset ONLY the workload rows this seed owns (the master faculty
  // list), never the whole collection. A global deleteMany({}) previously
  // destroyed workload records belonging to anyone else, including fixtures
  // created by other suites.
  const managedFacultyIds = workloadDocs.map((d) => d.facultyId);
  const removed = await FacultyWorkload.deleteMany({ facultyId: { $in: managedFacultyIds } });
  const inserted = await FacultyWorkload.insertMany(workloadDocs);

  // Verification of invariants
  let totalTeachingHours = 0;
  let totalResponsibilityHours = 0;
  let totalAllocatedHours = 0;
  let incompleteCount = 0;
  let totalTeachingRows = 0;
  let totalRespRows = 0;

  inserted.forEach((doc) => {
    totalTeachingHours += doc.calculatedTeachingHours;
    totalResponsibilityHours += doc.calculatedResponsibilityHours;
    totalAllocatedHours += doc.calculatedTotalHours;
    if (doc.status === 'INCOMPLETE SOURCE DATA') {
      incompleteCount++;
    }

    Object.values(doc.teaching).forEach((arr) => {
      totalTeachingRows += arr.length;
    });
    totalRespRows += doc.responsibilities.length;
  });

  console.log(`[Seed Verification]`);
  console.log(`  - Faculty records seeded: ${inserted.length} (Expected: 27)`);
  console.log(`  - Total teaching rows: ${totalTeachingRows} (Expected: 138)`);
  console.log(`  - Total responsibility rows: ${totalRespRows} (Expected: 72)`);
  console.log(`  - Total teaching hours: ${totalTeachingHours} (Expected: 397)`);
  console.log(`  - Total responsibility hours: ${totalResponsibilityHours} (Expected: 129)`);
  console.log(`  - Total calculated workload: ${totalAllocatedHours} (Expected: 526)`);
  console.log(`  - Incomplete source records: ${incompleteCount} (Expected: 1)`);

  if (inserted.length !== 27) throw new Error('Workload seed failed: count != 27');
  if (totalTeachingRows !== 138) throw new Error(`Workload seed failed: teachingRows (${totalTeachingRows}) != 138`);
  if (totalRespRows !== 72) throw new Error(`Workload seed failed: respRows (${totalRespRows}) != 72`);
  if (totalTeachingHours !== 397) throw new Error(`Workload seed failed: teachingHours (${totalTeachingHours}) != 397`);
  if (totalResponsibilityHours !== 129) throw new Error(`Workload seed failed: respHours (${totalResponsibilityHours}) != 129`);
  if (totalAllocatedHours !== 526) throw new Error(`Workload seed failed: totalHours (${totalAllocatedHours}) != 526`);
  if (incompleteCount !== 1) throw new Error(`Workload seed failed: incompleteCount (${incompleteCount}) != 1`);

  return inserted;
}

module.exports = { seedWorkload };
