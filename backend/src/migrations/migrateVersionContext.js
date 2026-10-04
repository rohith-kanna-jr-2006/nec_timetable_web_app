/**
 * Migration: TimetableVersion ↔ AcademicContext Integrity Anchor
 *
 * Purpose : Locate all TimetableVersion documents without an academicContextId
 *           and backfill the reference using the canonical 5-field tuple:
 *           (academicYear, semester, department, year, section).
 *
 * Safety  : Non-destructive & Idempotent.
 *           - Never deletes versions or sessions.
 *           - Never overwrites unrelated fields.
 *           - If multiple AcademicContext records match a version, reports AMBIGUOUS and skips (does not guess).
 *           - If no AcademicContext matches, reports UNRESOLVED and skips.
 *           - Safe to run multiple times.
 *
 * Usage   : npm run migrate:timetable-context
 *           node backend/src/migrations/migrateVersionContext.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const TimetableVersion = require('../models/TimetableVersion');
const AcademicContext = require('../models/AcademicContext');
const { connectDB, disconnectDB } = require('../config/db');

async function migrateVersionContext(options = { closeConnection: true }) {
  console.log('[Migration:timetable-context] Starting TimetableVersion ↔ AcademicContext anchor migration...');

  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  // 1. Locate all TimetableVersion records missing academicContextId
  const pendingVersions = await TimetableVersion.find({
    $or: [
      { academicContextId: null },
      { academicContextId: { $exists: false } },
    ],
  }).sort({ createdAt: 1 });

  console.log(`[Migration:timetable-context] Total TimetableVersion records requiring migration: ${pendingVersions.length}`);

  if (pendingVersions.length === 0) {
    console.log('[Migration:timetable-context] All TimetableVersion documents are already anchored to an AcademicContext.');
    if (options.closeConnection) await disconnectDB();
    return {
      total: 0,
      migrated: 0,
      unresolved: 0,
      ambiguous: 0,
    };
  }

  let migratedCount = 0;
  let unresolvedCount = 0;
  let ambiguousCount = 0;
  const unresolvedRecords = [];
  const ambiguousRecords = [];

  for (const version of pendingVersions) {
    const matchFilter = {
      academicYear: version.academicYear,
      semester: version.semester,
      department: version.department,
      ...(version.year ? { year: version.year } : {}),
      ...(version.section ? { section: version.section } : {}),
    };

    const matchingContexts = await AcademicContext.find(matchFilter);

    if (matchingContexts.length === 0) {
      unresolvedCount++;
      unresolvedRecords.push({
        versionId: version._id,
        versionLabel: version.versionLabel,
        criteria: matchFilter,
        reason: 'No matching AcademicContext found for 5-field tuple',
      });
      console.warn(`[Migration:timetable-context] UNRESOLVED: Version ${version._id} (${version.versionLabel || 'No Label'}) has no matching AcademicContext.`);
    } else if (matchingContexts.length > 1) {
      ambiguousCount++;
      ambiguousRecords.push({
        versionId: version._id,
        versionLabel: version.versionLabel,
        criteria: matchFilter,
        matchingContextIds: matchingContexts.map((c) => c._id),
        reason: `Ambiguous match: found ${matchingContexts.length} candidate contexts`,
      });
      console.warn(`[Migration:timetable-context] AMBIGUOUS: Version ${version._id} matches ${matchingContexts.length} contexts. Skipping (will not guess).`);
    } else {
      const canonicalContext = matchingContexts[0];
      await TimetableVersion.updateOne(
        { _id: version._id },
        { $set: { academicContextId: canonicalContext._id } }
      );
      migratedCount++;
      console.log(`[Migration:timetable-context] ANCHORED: Version ${version._id} (${version.versionLabel || 'v'}) -> AcademicContext ${canonicalContext._id} (${canonicalContext.department} ${canonicalContext.year}-${canonicalContext.section})`);
    }
  }

  console.log('========================================================');
  console.log('[Migration:timetable-context] MIGRATION SUMMARY:');
  console.log(`  - Total inspected : ${pendingVersions.length}`);
  console.log(`  - Successfully anchored : ${migratedCount}`);
  console.log(`  - Unresolved (no match) : ${unresolvedCount}`);
  console.log(`  - Ambiguous (>1 match)  : ${ambiguousCount}`);
  console.log('========================================================');

  if (unresolvedRecords.length > 0) {
    console.warn('[Migration:timetable-context] Unresolved records detail:', JSON.stringify(unresolvedRecords, null, 2));
  }
  if (ambiguousRecords.length > 0) {
    console.warn('[Migration:timetable-context] Ambiguous records detail:', JSON.stringify(ambiguousRecords, null, 2));
  }

  if (options.closeConnection) {
    await disconnectDB();
    console.log('[Migration:timetable-context] DB connection closed.');
  }

  return {
    total: pendingVersions.length,
    migrated: migratedCount,
    unresolved: unresolvedCount,
    ambiguous: ambiguousCount,
    unresolvedRecords,
    ambiguousRecords,
  };
}

if (require.main === module) {
  migrateVersionContext({ closeConnection: true }).catch((err) => {
    console.error('[Migration:timetable-context] Fatal migration error:', err);
    process.exit(1);
  });
}

module.exports = { migrateVersionContext };
