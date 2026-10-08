/**
 * CLONE: copies nec_faculty_db (READ-ONLY source) into the DISPOSABLE
 * nec_faculty_test_db (write target). The source is opened read-only and is
 * never written. This gives the validation runtime realistic data without
 * touching the shared database.
 */
const { MongoClient } = require('mongodb');

const SRC = 'mongodb://127.0.0.1:27017/?directConnection=true';
const DST = 'mongodb://127.0.0.1:27018/?directConnection=true';
const SRC_DB = 'nec_faculty_db';
const DST_DB = 'nec_faculty_test_db';

(async () => {
  const src = new MongoClient(SRC, { serverSelectionTimeoutMS: 8000 });
  const dst = new MongoClient(DST, { serverSelectionTimeoutMS: 8000 });
  await src.connect();
  await dst.connect();

  const sdb = src.db(SRC_DB);
  const ddb = dst.db(DST_DB);

  const names = (await sdb.listCollections().toArray()).map((c) => c.name);
  console.log('Source collections:', names.join(', '));

  for (const name of names) {
    const docs = await sdb.collection(name).find({}).toArray();
    await ddb.collection(name).deleteMany({});           // only the TEST db
    if (docs.length) await ddb.collection(name).insertMany(docs);
    console.log(`  ${name.padEnd(28)} copied ${docs.length}`);
  }

  console.log('\nClone complete. Source DB untouched (read-only client usage).');
  await src.close();
  await dst.close();
})().catch((e) => { console.error('CLONE FAILED:', e.message); process.exit(1); });