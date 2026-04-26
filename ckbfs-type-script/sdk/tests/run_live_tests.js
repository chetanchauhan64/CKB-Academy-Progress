#!/usr/bin/env node
/**
 * tests/run_live_tests.js — Master Live Test Runner
 *
 * Orchestrates all 5 live testnet tests in sequence:
 *   0. Preflight check  (abort if any check fails)
 *   1. CREATE file cell
 *   2. UPDATE file cell  (uses fileId from step 1)
 *   3. CONSUME file cell (uses fileId from step 1)
 *   4. MULTI-CHUNK file  (uses a new fileId)
 *
 * Generates:
 *   sdk/outputs/create_tx.json
 *   sdk/outputs/update_tx.json
 *   sdk/outputs/consume_tx.json
 *   sdk/outputs/multichunk_tx.json
 *   sdk/outputs/explorer_links.md
 *
 * Usage:
 *   node tests/run_live_tests.js
 */

import 'dotenv/config';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateFileId } from '../utils/encoding.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SDK_DIR  = path.resolve(__dirname, '..');
const OUTPUTS  = path.resolve(SDK_DIR, 'outputs');

// Ensure outputs directory exists
fs.mkdirSync(OUTPUTS, { recursive: true });

const EXPLORER = 'https://pudge.explorer.nervos.org/transaction';
const results = [];

// ── Utilities ─────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

function logSection(title) {
  console.log('\n' + '═'.repeat(52));
  console.log(`  ${title}`);
  console.log('═'.repeat(52));
}

/** Run a child Node script and wait for completion. */
function runScript(scriptPath, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [scriptPath], {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    proc.on('close', (code) => {
      if (code === 0) resolve(code);
      else reject(new Error(`Script ${path.basename(scriptPath)} exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

/** Read a JSON output file safely. */
function readOutput(filename) {
  const p = path.join(OUTPUTS, filename);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

/** Record a test result summary entry. */
function record(name, output) {
  if (!output) {
    results.push({ name, status: 'MISSING', txHash: null, explorerUrl: null });
    return;
  }
  results.push({
    name,
    status: output.status ?? 'unknown',
    txHash: output.txHash,
    explorerUrl: output.explorerUrl,
    fileId: output.fileId,
    validation: output.validation ?? output.allValidationsPassed,
    timestamp: output.timestamp,
  });
}

// ── Pre-generate fileId so we can pass it to update and consume ───────────────
// (The create script generates its own, we read it back from the output)

// ─────────────────────────────────────────────────────────────────────────────
//  STEP 0: Preflight
// ─────────────────────────────────────────────────────────────────────────────
logSection('STEP 0 — PREFLIGHT CHECK');
try {
  await runScript(path.join(__dirname, '00_preflight.js'));
  log('✅ Preflight passed — proceeding with live tests');
} catch {
  log('❌ Preflight FAILED. Fix all issues and re-run.');
  log('\nCommon fixes:');
  log('  1. Copy sdk/.env.example → sdk/.env and set PRIVATE_KEY');
  log('  2. Fund your wallet at https://faucet.nervos.org/');
  log('  3. Deploy the CKBFS binary: capsule deploy --env testnet');
  log('  4. Set CKBFS_CODE_HASH, CKBFS_TX_HASH, CKBFS_TX_INDEX in sdk/.env');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
//  STEP 1: CREATE
// ─────────────────────────────────────────────────────────────────────────────
logSection('STEP 1 — CREATE FILE CELL');
try {
  await runScript(path.join(__dirname, '10_live_create.js'));
  log('✅ CREATE test complete');
} catch (err) {
  log(`❌ CREATE test FAILED: ${err.message}`);
  log('Cannot proceed to UPDATE/CONSUME without a created cell.');
  // Generate partial report and exit
  await generateReport(results);
  process.exit(1);
}

// Read back fileId from create output
const createOutput = readOutput('create_tx.json');
record('CREATE', createOutput);
const fileId = createOutput?.fileId;
if (!fileId) {
  log('❌ Could not read fileId from create_tx.json. Aborting.');
  process.exit(1);
}
log(`File ID for subsequent tests: ${fileId}`);

// Give the CKB indexer time to index the newly committed CREATE cell
// before UPDATE and CONSUME try to query for it.
log('Waiting 20s for indexer to catch up…');
await new Promise(r => setTimeout(r, 20_000));


// ─────────────────────────────────────────────────────────────────────────────
//  STEP 2: UPDATE
// ─────────────────────────────────────────────────────────────────────────────
logSection('STEP 2 — UPDATE FILE CELL');
try {
  await runScript(path.join(__dirname, '11_live_update.js'), {
    CKBFS_FILE_ID: fileId,
  });
  log('✅ UPDATE test complete');
} catch (err) {
  log(`❌ UPDATE test FAILED: ${err.message}`);
  // Continue to consume even if update failed (we can consume the original)
}
record('UPDATE', readOutput('update_tx.json'));

// ─────────────────────────────────────────────────────────────────────────────
//  STEP 3: CONSUME
// ─────────────────────────────────────────────────────────────────────────────
logSection('STEP 3 — CONSUME (DESTROY) FILE CELLS');
try {
  await runScript(path.join(__dirname, '12_live_consume.js'), {
    CKBFS_FILE_ID: fileId,
  });
  log('✅ CONSUME test complete');
} catch (err) {
  log(`❌ CONSUME test FAILED: ${err.message}`);
}
record('CONSUME', readOutput('consume_tx.json'));

// ─────────────────────────────────────────────────────────────────────────────
//  STEP 4: MULTI-CHUNK
// ─────────────────────────────────────────────────────────────────────────────
logSection('STEP 4 — MULTI-CHUNK FILE');
try {
  await runScript(path.join(__dirname, '13_live_multichunk.js'));
  log('✅ MULTI-CHUNK test complete');
} catch (err) {
  log(`❌ MULTI-CHUNK test FAILED: ${err.message}`);
}
record('MULTI_CHUNK', readOutput('multichunk_tx.json'));

// ─────────────────────────────────────────────────────────────────────────────
//  STEP 5: Generate Explorer Links & Final Report
// ─────────────────────────────────────────────────────────────────────────────
logSection('STEP 5 — GENERATING REPORT');
await generateReport(results);

// ── Functions ──────────────────────────────────────────────────────────────────

async function generateReport(entries) {
  // ── explorer_links.md ──────────────────────────────────────────────────────
  const now = new Date().toISOString();
  let md = `# CKBFS Testnet Transaction Report\n\n`;
  md += `**Generated:** ${now}\n`;
  md += `**Network:** CKB Aggron4 Testnet\n`;
  md += `**Explorer:** https://pudge.explorer.nervos.org\n\n`;
  md += `---\n\n`;

  md += `## Transaction Links\n\n`;
  md += `| Test | Status | Tx Hash | Explorer |\n`;
  md += `|------|--------|---------|----------|\n`;

  for (const r of entries) {
    const status = r.status === 'committed' ? '✅ committed' :
                   r.status === 'submitted' ? '⏳ submitted' :
                   r.status === 'MISSING'   ? '❌ failed'    : `⚠️ ${r.status}`;
    const hash = r.txHash ? `\`${r.txHash.slice(0, 18)}...\`` : 'N/A';
    const link = r.explorerUrl ? `[View →](${r.explorerUrl})` : 'N/A';
    md += `| ${r.name} | ${status} | ${hash} | ${link} |\n`;
  }

  md += `\n---\n\n`;
  md += `## Detailed Transaction Hashes\n\n`;
  for (const r of entries) {
    if (r.txHash) {
      md += `### ${r.name}\n`;
      md += `- **Tx Hash:** \`${r.txHash}\`\n`;
      md += `- **Status:** ${r.status}\n`;
      md += `- **File ID:** \`${r.fileId ?? 'N/A'}\`\n`;
      md += `- **Explorer:** ${r.explorerUrl}\n`;
      if (r.timestamp) md += `- **Timestamp:** ${r.timestamp}\n`;
      md += '\n';
    }
  }

  md += `---\n\n`;
  md += `## Validation Summary\n\n`;
  for (const r of entries) {
    md += `### ${r.name}\n`;
    if (r.validation && typeof r.validation === 'object') {
      for (const [k, v] of Object.entries(r.validation)) {
        md += `- **${k}:** ${v === true ? '✅' : v === false ? '❌' : v}\n`;
      }
    } else if (r.validation !== undefined) {
      md += `- **All validations passed:** ${r.validation ? '✅' : '❌'}\n`;
    } else {
      md += `- N/A\n`;
    }
    md += '\n';
  }

  md += `---\n\n`;
  md += `## How to Verify Manually\n\n`;
  md += `1. Click any **View →** link above to open the CKB Explorer\n`;
  md += `2. Confirm the transaction status is **Committed**\n`;
  md += `3. Check the **Outputs** tab to see the CKBFS cells (they have a Type Script)\n`;
  md += `4. Decode the cell data to verify the binary format\n\n`;
  md += `\`\`\`bash\n# Verify a specific tx from CLI:\n`;
  md += `curl -s https://testnet.ckbapp.dev -X POST \\\n`;
  md += `  -H 'Content-Type: application/json' \\\n`;
  md += `  -d '{"jsonrpc":"2.0","method":"get_transaction","params":["<TX_HASH>"],"id":1}'\n`;
  md += `\`\`\`\n`;

  fs.writeFileSync(path.join(OUTPUTS, 'explorer_links.md'), md, 'utf8');
  log('Explorer links saved to sdk/outputs/explorer_links.md');

  // ── Print final summary ────────────────────────────────────────────────────
  logSection('FINAL TEST SUMMARY');
  const allCommitted = entries.filter(e => e.status === 'committed').length;
  const total = entries.length;

  for (const r of entries) {
    const icon = r.status === 'committed' ? '✅' :
                 r.status === 'submitted' ? '⏳' : '❌';
    console.log(`  ${icon} ${r.name.padEnd(14)} ${r.txHash ? r.txHash : 'N/A'}`);
    if (r.explorerUrl) console.log(`     ${r.explorerUrl}`);
  }

  console.log(`\n  ${allCommitted}/${total} transactions committed on Aggron4`);
  console.log('  Full report: sdk/outputs/explorer_links.md');
  console.log('═'.repeat(52) + '\n');
}
