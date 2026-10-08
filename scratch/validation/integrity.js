/**
 * READ-ONLY database integrity forensics. Executes ONLY read operations.
 * Target: the DISPOSABLE nec_faculty_test_db clone.
 */
const { MongoClient } = require('mongodb');
const URI = 'mongodb://127.0.0.1:27018/?directConnection=true';
const DB = process.argv[2] || 'nec_faculty_test_db';

(async () => {
  const c = new MongoClient(URI, { serverSelectionTimeoutMS: 8000 });
  await c.connect();
  const db = c.db(DB);
  const P = (s) => console.log(s);

  P(`=== DB INTEGRITY FORENSICS: ${DB} (read-only) ===\n`);

  P('--- 1. Collection counts ---');
  const names = (await db.listCollections().toArray()).map((x) => x.name).sort();
  for (const n of names) P(`  ${n.padEnd(26)} ${await db.collection(n).countDocuments({})}`);

  P('\n--- 2. TimetableSession duplicate detection ---');
  const dupCell = await db.collection('timetablesessions').aggregate([
    { $group: { _id: { v: '$timetableVersionId', c: '$academicContextId', d: '$day', p: '$period', cc: '$courseCode' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: 'dupes' },
  ]).toArray();
  P(`  duplicate (version,context,day,period,course) cells: ${dupCell[0] ? dupCell[0].dupes : 0}`);

  P('\n--- 3. facultyAssignments integrity ---');
  const faHist = await db.collection('timetablesessions').aggregate([
    { $project: { n: { $size: { $ifNull: ['$facultyAssignments', []] } } } },
    { $group: { _id: '$n', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();
  P('  sessions by facultyAssignments length: ' + JSON.stringify(faHist.map((h) => `${h._id}=${h.count}`)));
  const malformed = await db.collection('timetablesessions').aggregate([
    { $match: { facultyAssignments: { $exists: true } } },
    { $project: { bad: { $or: [
      { $not: { $isArray: '$facultyAssignments' } },
      { $any: { $not: { $isArray: '$facultyAssignments' } } },
    ] } } },
    { $match: { bad: true } }, { $count: 'n' },
  ]).toArray().catch(() => [{ n: -1 }]);
  P(`  malformed facultyAssignments: ${malformed[0] ? malformed[0].n : 0}`);

  P('\n--- 4. Multi-faculty sample (22MAN8R) ---');
  const man = await db.collection('timetablesessions').find({ courseCode: '22MAN8R' }).toArray();
  P(`  22MAN8R sessions: ${man.length}`);
  man.slice(0, 3).forEach((s) => P(`   ver=${String(s.timetableVersionId).slice(-6)} ctx=${String(s.academicContextId).slice(-6)} ${s.day} ${s.period} assignments=${(s.facultyAssignments || []).length} roles=${JSON.stringify((s.facultyAssignments || []).map((a) => a.role))}`));

  P('\n--- 5. Version <-> context anchoring ---');
  const unanchored = await db.collection('timetableversions').countDocuments({ $or: [{ academicContextId: { $exists: false } }, { academicContextId: null }] });
  P(`  versions WITHOUT academicContextId: ${unanchored} / ${await db.collection('timetableversions').countDocuments({})}`);
  const orphanSessions = await db.collection('timetablesessions').countDocuments({ timetableVersionId: { $exists: false } });
  P(`  sessions WITHOUT timetableVersionId: ${orphanSessions}`);
  const ctxIds = (await db.collection('academiccontexts').find({}).project({ _id: 1 }).toArray()).map((x) => String(x._id));
  const crossCtx = await db.collection('timetablesessions').aggregate([
    { $addFields: { verCtx: { $arrayElemAt: [{ $map: { input: { $ifNull: ['$timetableVersionId', []] }, as: 'vid', in: null } }, 0] } } },
    { $match: { academicContextId: { $nin: ctxIds } } }, { $count: 'n' },
  ]).toArray().catch(() => [{ n: -1 }]);
  P(`  sessions whose academicContextId is not a real context: ${crossCtx[0] ? crossCtx[0].n : 0}`);

  P('\n--- 6. Version status distribution ---');
  const st = await db.collection('timetableversions').aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray();
  st.forEach((s) => P(`  ${String(s._id).padEnd(14)} ${s.n}`));

  P('\n--- 7. Test fixture contamination scan ---');
  for (const [label, col, field] of [['P12 faculty', 'faculties', 'facultyId'], ['P12 course', 'courses', 'courseCode'], ['TEST users', 'users', 'email'], ['VAL faculty', 'faculties', 'facultyId']]) {
    const re = label.startsWith('P12') ? /^P12/ : label.startsWith('VAL') ? /^(FWL-99|TEST)/ : /(_test@|@test|fixture)/i;
    const n = await db.collection(col).countDocuments({ [field]: { $regex: re } });
    P(`  ${label.padEnd(14)} ${n}`);
  }

  P('\n--- 8. Substitute allocations ---');
  const subs = await db.collection('substituteallocations').find({}).toArray();
  P(`  total: ${subs.length}`);
  subs.slice(0, 5).forEach((s) => P(`   ctx=${String(s.academicContextId).slice(-6)} orig=${s.originalFacultyId} subst=${s.substituteFacultyId} status=${s.status} session=${String(s.timetableSessionId || '').slice(-6)}`));

  await c.close();
})().catch((e) => { console.error('INTEGRITY FAILED:', e.message); process.exit(1); });