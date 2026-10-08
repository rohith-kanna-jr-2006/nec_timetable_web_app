/**
 * READ-ONLY forensic inspection. Executes ONLY read commands.
 * Never writes, never deletes, never drops.
 */
const { MongoClient } = require('mongodb');

const URI = process.argv[2];
const LABEL = process.argv[3] || URI;

const COLLECTIONS = [
  'academiccontexts',
  'courses',
  'faculties',
  'facultyworkloads',
  'hodfacultyallocations',
  'timetableversions',
  'timetablesessions',
  'substituteallocations',
  'users',
  'facultyavailabilities',
  'facultyabsences',
  'coursefacultyhandlers',
  'notifications',
  'classadvisorassignments',
];

(async () => {
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const admin = client.db().admin();
  const dbs = await admin.listDatabases();
  console.log('=== HOST DATABASES ===');
  console.log(JSON.stringify(dbs.databases.map((d) => ({ name: d.name, sizeOnDisk: d.sizeOnDisk })), null, 2));

  for (const dbName of dbs.databases.map((d) => d.name)) {
    if (['admin', 'local', 'config'].includes(dbName)) continue;
    const db = client.db(dbName);
    const names = (await db.listCollections().toArray()).map((c) => c.name);
    console.log(`\n=== DB: ${dbName} (collections: ${names.length}) ===`);
    for (const name of names) {
      let count;
      try {
        count = await db.collection(name).countDocuments({});
      } catch (e) {
        count = `ERR ${e.message}`;
      }
      console.log(`  ${name.padEnd(28)} ${count}`);
    }
  }

  if (LABEL) {
    console.log(`\n=== SAMPLE: ${LABEL} ===`);
  }
  await client.close();
})().catch((e) => {
  console.error('INSPECT FAILED:', e.message);
  process.exit(1);
});