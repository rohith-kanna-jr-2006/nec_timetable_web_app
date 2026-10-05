/**
 * Migration: AC ? TC (TimeTable Coordinator)
 *
 * Purpose : Change all User documents with role 'AC' to role 'TC'.
 * Safety  : Idempotent — running this script multiple times produces the same
 *           result. No users are deleted.
 * When    : Run this script ONCE after deploying Phase 1 and BEFORE removing
 *           'AC' from the User.role enum in a future Phase.
 *
 * Usage   : node backend/src/migrations/migrateACtoTC.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { connectDB, disconnectDB } = require('../config/db');

async function migrateACtoTC() {
  console.log('[Migration] AC ? TC: Starting migration...');

  await connectDB();

  // Dry run: list all AC users before updating
  const acUsers = await User.find({ role: 'AC' }).select('name email facultyId role').lean();

  if (acUsers.length === 0) {
    console.log('[Migration] No users with role AC found. Nothing to migrate. (Already migrated or clean state.)');
    await disconnectDB();
    return;
  }

  console.log(`[Migration] Found ${acUsers.length} user(s) with role AC:`);
  for (const u of acUsers) {
    console.log(`  - ${u.name} <${u.email}> (facultyId: ${u.facultyId})`);
  }

  // Execute update
  const result = await User.updateMany({ role: 'AC' }, { $set: { role: 'TC' } });

  console.log(`[Migration] Updated ${result.modifiedCount} user(s) from role AC ? TC.`);

  // Verify
  const remaining = await User.countDocuments({ role: 'AC' });
  if (remaining > 0) {
    console.error(`[Migration] WARNING: ${remaining} user(s) still have role AC after migration. Check manually.`);
  } else {
    console.log('[Migration] Verification passed. No users remain with role AC.');
  }

  await disconnectDB();
  console.log('[Migration] Done.');
}

migrateACtoTC().catch((err) => {
  console.error('[Migration] Fatal error:', err);
  process.exit(1);
});
