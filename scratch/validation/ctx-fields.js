/** READ-ONLY. Reports AcademicContext field completeness on the shared DB. */
const { MongoClient } = require('mongodb');

(async () => {
  const c = new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true', { serverSelectionTimeoutMS: 8000 });
  await c.connect();
  const all = await c.db('nec_faculty_db').collection('academiccontexts').find({}).toArray();
  console.log('TOTAL=' + all.length);
  const missing = { regulation: 0, fromYear: 0, toYear: 0, academicYearFrom: 0, academicYearTo: 0 };
  all.forEach((x) => {
    for (const k of Object.keys(missing)) if (x[k] === undefined || x[k] === null || x[k] === '') missing[k]++;
  });
  console.log('MISSING counts:', JSON.stringify(missing));
  console.log('SAMPLE doc:', JSON.stringify(all[0], null, 1));
  console.log('COHORTS:', JSON.stringify(all.map((x) => x.year + ' ' + x.section)));
  await c.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });