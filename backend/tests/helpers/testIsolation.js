/**
 * Phase 12 - Shared seed protection helpers.
 *
 * Some suites need controlled state for a shared AcademicContext (an empty
 * allocation set, a pristine cohort). Erasing that state with a broad
 * deleteMany permanently corrupts the canonical dataset and makes later suites
 * depend on execution order.
 *
 * These helpers make that need safe:
 *   - snapshotSharedContext() captures the rows a suite is about to change
 *   - restoreSharedContext() puts them back byte-for-byte (original _id included)
 *
 * Nothing here deletes by broad real-world attributes such as section/year.
 * Fixtures created by a suite are owned by that suite's namespace (P12_*) and
 * removed by exact id only.
 */

const HODFacultyAllocation = require('../../src/models/HODFacultyAllocation');
const TimetableVersion = require('../../src/models/TimetableVersion');
const TimetableSession = require('../../src/models/TimetableSession');

/** Deterministic namespace owned by Phase 12 fixtures. */
const P12 = {
  department: 'P12T',
  facultyPrefix: 'P12-',
  coursePrefix: 'P12',
  versionLabelPrefix: 'P12-',
  emailPrefix: 'p12_',
};

/**
 * Captures every allocation, version and session belonging to the given contexts.
 * Returns a plain snapshot safe to hold in memory for the life of the suite.
 */
async function snapshotSharedContext(academicContextIds) {
  const ids = (Array.isArray(academicContextIds) ? academicContextIds : [academicContextIds]).filter(Boolean);

  const allocations = await HODFacultyAllocation.find({ academicContextId: { $in: ids } }).lean();
  const versions = await TimetableVersion.find({ academicContextId: { $in: ids } }).lean();
  const versionIds = versions.map((v) => v._id);
  const sessions = versionIds.length
    ? await TimetableSession.find({ timetableVersionId: { $in: versionIds } }).lean()
    : [];

  return {
    academicContextIds: ids.map(String),
    allocations,
    versions,
    sessions,
  };
}

/**
 * Restores a snapshot exactly: removes whatever the suite created in those
 * contexts, then re-inserts the original documents with their original _id,
 * versionId and timestamps.
 */
async function restoreSharedContext(snapshot) {
  if (!snapshot) return { allocations: 0, versions: 0, sessions: 0 };
  const ids = snapshot.academicContextIds;

  // Remove suite-created rows for these contexts only.
  const createdVersions = await TimetableVersion.find({ academicContextId: { $in: ids } }).lean();
  const createdVersionIds = createdVersions.map((v) => v._id);
  if (createdVersionIds.length) {
    await TimetableSession.deleteMany({ timetableVersionId: { $in: createdVersionIds } });
    await TimetableVersion.deleteMany({ _id: { $in: createdVersionIds } });
  }
  await HODFacultyAllocation.deleteMany({ academicContextId: { $in: ids } });

  // Put the originals back with their own _id.
  if (snapshot.sessions.length) await TimetableSession.insertMany(snapshot.sessions);
  if (snapshot.versions.length) await TimetableVersion.insertMany(snapshot.versions);
  if (snapshot.allocations.length) await HODFacultyAllocation.insertMany(snapshot.allocations);

  return {
    allocations: snapshot.allocations.length,
    versions: snapshot.versions.length,
    sessions: snapshot.sessions.length,
  };
}

/**
 * Removes only P12-owned fixture records. Never targets shared seed data.
 */
async function cleanupP12Fixtures() {
  const contexts = await require('../../src/models/AcademicContext')
    .find({ department: P12.department })
    .select('_id')
    .lean();
  const ids = contexts.map((c) => c._id);

  const versions = await TimetableVersion.find({ academicContextId: { $in: ids } }).select('_id').lean();
  const versionIds = versions.map((v) => v._id);

  if (versionIds.length) await TimetableSession.deleteMany({ timetableVersionId: { $in: versionIds } });
  if (ids.length) await HODFacultyAllocation.deleteMany({ academicContextId: { $in: ids } });
  if (ids.length) await TimetableVersion.deleteMany({ academicContextId: { $in: ids } });
  if (ids.length) await require('../../src/models/AcademicContext').deleteMany({ _id: { $in: ids } });

  await require('../../src/models/Course').deleteMany({ courseCode: new RegExp('^' + P12.coursePrefix) });
  await require('../../src/models/Faculty').deleteMany({ facultyId: new RegExp('^' + P12.facultyPrefix) });
  await require('../../src/models/FacultyWorkload').deleteMany({ facultyId: new RegExp('^' + P12.facultyPrefix) });
  await require('../../src/models/User').deleteMany({ email: new RegExp('^' + P12.emailPrefix) });

  return { contexts: ids.length, versions: versionIds.length };
}

module.exports = {
  P12,
  snapshotSharedContext,
  restoreSharedContext,
  cleanupP12Fixtures,
};