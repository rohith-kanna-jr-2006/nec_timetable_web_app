/**
 * Cross-project verification script for NEC Timetable Web App (Web + Backend)
 */
const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
console.log('==============================================');
console.log('NEC Timetable Web App: Full System Verification');
console.log('==============================================\n');

try {
  console.log('[1/2] Running Backend Test Suites...');
  execSync('npm test', { cwd: path.join(rootDir, 'backend'), stdio: 'inherit' });
  console.log('\n✓ Backend Test Suites Passed!\n');

  console.log('[2/2] Running Web Frontend Test Suites...');
  execSync('npm test', { cwd: path.join(rootDir, 'web'), stdio: 'inherit' });
  console.log('\n✓ Web Frontend Test Suites Passed!\n');

  console.log('==============================================');
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('==============================================');
} catch (error) {
  console.error('\n❌ Verification Failed:', error.message);
  process.exit(1);
}
