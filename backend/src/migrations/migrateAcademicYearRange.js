/**
 * Migration: AcademicContext academic-year range (Phase 8)
 *
 * Purpose : Backfill the canonical academicYearFrom / academicYearTo pair on
 *           every AcademicContext from its existing authoritative record.
 *
 * Safety  : Non-destructive & Idempotent.
 *           - Never deletes or recreates an AcademicContext document.
 *           - Never changes an AcademicContext _id.
 *           - Never touches TimetableVersion / TimetableSession records.
 *           - Contexts whose existing academicYear cannot be parsed
 *             deterministically are reported as UNPARSEABLE and left untouched
 *             rather than guessed.
 *           - Safe to run any number of times.
 *
 * Usage   : node backend/src/migrations/migrateAcademicYearRange.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AcademicContext = require('../models/AcademicContext');
const { connectDB, disconnectDB } = require('../config/db');
const { parseAcademicYear, formatAcademicYear, isValidRange } = require('../utils/academicYearRange');

async function migrateAcademicYearRange(options = {}) {
  const { closeConnection = true, dryRun = false } = options;
  const log = options.silent ? () => {} : (...a) => console.log(...a);

  log('[Migration:academic-year-range] Starting AcademicContext academic-year range migration...');

  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  const before = await AcademicContext.countDocuments();
  log(`[Migration:academic-year-range] AcademicContext records before migration: ${before}`);

  const contexts = await AcademicContext.find({}).sort({ createdAt: 1, _id: 1 });
  const idsBefore = contexts.map((c) => String(c._id));

  let migrated = 0;
  let alreadyCurrent = 0;
  let unparseable = 0;
  const unparseableRecords = [];
for (const ctx of contexts) {
    const from = ctx.academicYearFrom;
    const to = ctx.academicYearTo;

    // Already migrated and internally consistent.
    if (isValidRange(from, to)) {
      const expectedMirror = formatAcademicYear(from, to);
      if (ctx.academicYear !== expectedMirror) {
        // Repair only the derived mirror; the canonical pair is left alone.
        if (!dryRun) await AcademicContext.updateOne({ _id: ctx._id }, { $set: { academicYear: expectedMirror } });
        migrated++;
        log(`[Migration:academic-year-range] MIRROR: Context ${ctx._id} academicYear -> ${expectedMirror}`);
      } else {
        alreadyCurrent++;
      }
      continue;
    }

    // Not yet migrated: derive the canonical pair from the existing record.
    const parsed = parseAcademicYear(ctx.academicYear);

    if (!parsed || !isValidRange(parsed.academicYearFrom, parsed.academicYearTo)) {
      unparseable++;
      unparseableRecords.push({
        contextId: String(ctx._id),
        academicYear: ctx.academicYear === undefined ? null : ctx.academicYear,
        department: ctx.department,
        year: ctx.year,
        section: ctx.section,
        reason: 'academicYear is not in the canonical YYYY-YY format; refusing to guess',
      });
      log(`[Migration:academic-year-range] UNPARSEABLE: Context ${ctx._id} academicYear=${JSON.stringify(ctx.academicYear)} - skipped (not guessing).`);
      continue;
    }

    if (dryRun) {
      migrated++;
      log(`[Migration:academic-year-range] [dry-run] would set Context ${ctx._id} -> ${parsed.academicYearFrom}..${parsed.academicYearTo}`);
      continue;
    }

    // Targeted update by _id: preserves the document and its _id.
    await AcademicContext.updateOne(
      { _id: ctx._id },
      {
        $set: {
          academicYearFrom: parsed.academicYearFrom,
          academicYearTo: parsed.academicYearTo,
          academicYear: formatAcademicYear(parsed.academicYearFrom, parsed.academicYearTo),
        },
      }
    );
    migrated++;
    log(`[Migration:academic-year-range] MIGRATED: Context ${ctx._id} '${ctx.academicYear}' -> ${parsed.academicYearFrom}..${parsed.academicYearTo}`);
  }

const after = dryRun ? before : await AcademicContext.countDocuments();
  const idsAfter = (await AcademicContext.find({}).select('_id').lean()).map((c) => String(c._id));

  const idsPreserved = idsBefore.length === idsAfter.length && idsBefore.every((id) => idsAfter.includes(id));

  const duplicateCandidates = await AcademicContext.aggregate([
    {
      $group: {
        _id: {
          academicYearFrom: '$academicYearFrom',
          academicYearTo: '$academicYearTo',
          semester: '$semester',
          department: '$department',
          year: '$year',
          section: '$section',
        },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  log('========================================================');
  log('[Migration:academic-year-range] MIGRATION SUMMARY:');
  log(`  - Records before        : ${before}`);
  log(`  - Records after         : ${after}`);
  log(`  - Migrated / repaired   : ${migrated}`);
  log(`  - Already current       : ${alreadyCurrent}`);
  log(`  - Unparseable (skipped) : ${unparseable}`);
  log(`  - Duplicate candidates  : ${duplicateCandidates.length}`);
  log(`  - _id values preserved  : ${idsPreserved}`);
  log('========================================================');

  if (unparseableRecords.length > 0) {
    log('[Migration:academic-year-range] Unparseable records detail:', JSON.stringify(unparseableRecords, null, 2));
  }

  if (closeConnection && !dryRun) {
    await disconnectDB();
    log('[Migration:academic-year-range] DB connection closed.');
  }

  return {
    before,
    after,
    migrated,
    alreadyCurrent,
    unparseable,
    unparseableRecords,
    duplicateCandidates,
    idsPreserved,
    dryRun,
  };
}

if (require.main === module) {
  migrateAcademicYearRange({ closeConnection: true })
    .then((r) => {
      process.exit(r.unparseable > 0 || r.duplicateCandidates.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('[Migration:academic-year-range] Fatal migration error:', err);
      process.exit(1);
    });
}

module.exports = { migrateAcademicYearRange };