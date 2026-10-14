/**
 * Master E2E Test Suite Runner for Heritage Hunt (Melaka Heritage Photo Hunt).
 * Supports execution via `node tests/runner.ts` or `node --test tests`.
 */

import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const TESTS_ROOT = resolve(process.cwd(), 'tests');

function discoverTestFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (entry !== 'framework' && entry !== 'node_modules') {
        files.push(...discoverTestFiles(fullPath));
      }
    } else if (entry.endsWith('.test.ts') || entry.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function run() {
  console.log('='.repeat(70));
  console.log('   HERITAGE HUNT E2E TEST SUITE — 4-TIER SPECIFICATION RUNNER');
  console.log('='.repeat(70));

  const testFiles = discoverTestFiles(TESTS_ROOT);
  console.log(`Discovered ${testFiles.length} test suites under tests/\n`);

  // Group files by tier
  const tier1Files = testFiles.filter(f => f.includes('tier1_features'));
  const tier2Files = testFiles.filter(f => f.includes('tier2_boundaries'));
  const tier3Files = testFiles.filter(f => f.includes('tier3_pairwise'));
  const tier4Files = testFiles.filter(f => f.includes('tier4_workload'));

  console.log(`  • Tier 1 (Feature Coverage):     ${tier1Files.length} suites (35 Features, >=5 tests each)`);
  console.log(`  • Tier 2 (Boundary & Corner):    ${tier2Files.length} suites (Ceilings, PINs, Bounds, EXIF, Offline)`);
  console.log(`  • Tier 3 (Cross-Feature Flows):  ${tier3Files.length} suites (Pairwise flow sequences)`);
  console.log(`  • Tier 4 (Workload Simulation):  ${tier4Files.length} suites (Full Melaka match simulation)`);
  console.log('='.repeat(70));
  console.log('Executing test runner via Node.js...\n');

  const startTime = Date.now();

  const child = spawn(
    process.execPath,
    ['--test', ...testFiles],
    {
      stdio: 'inherit',
      env: process.env,
    }
  );

  child.on('close', (code) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(70));
    if (code === 0) {
      console.log(`✅ ALL TEST SUITES PASSED CLEANLY (${duration}s)`);
      console.log('='.repeat(70));
      process.exit(0);
    } else {
      console.error(`❌ TEST SUITE FAILED with exit code ${code} (${duration}s)`);
      console.log('='.repeat(70));
      process.exit(code || 1);
    }
  });
}

run();
