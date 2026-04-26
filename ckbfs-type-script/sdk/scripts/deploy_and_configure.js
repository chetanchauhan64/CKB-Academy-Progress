#!/usr/bin/env node
/**
 * scripts/deploy_and_configure.js
 *
 * Helper script that:
 *   1. Reads the capsule migration file after deployment
 *   2. Extracts code_hash, tx_hash, tx_index
 *   3. Writes them to sdk/.env automatically
 *
 * Run AFTER: capsule deploy --env testnet
 *
 * Usage:
 *   node scripts/deploy_and_configure.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Capsule writes migration files here after deployment
const MIGRATION_PATHS = [
  path.join(ROOT, 'migrations', 'testnet', '*.json'),
  path.join(ROOT, 'migration', 'testnet', '*.json'),
  path.join(ROOT, 'deployment', 'testnet.json'),
];

const ENV_PATH = path.join(ROOT, 'sdk', '.env');
const ENV_EXAMPLE_PATH = path.join(ROOT, 'sdk', '.env.example');

console.log('\n═══════════════════════════════════════════════════');
console.log('  CKBFS Deployment Configurator');
console.log('═══════════════════════════════════════════════════\n');

// ── Try to find capsule migration file ────────────────────────────────────────
let migrationFile = null;
const { globSync } = await import('fs');

// Manual glob fallback
const checkPaths = [
  path.join(ROOT, 'migrations', 'testnet'),
  path.join(ROOT, 'migration', 'testnet'),
  path.join(ROOT, 'build', 'testnet'),
];

for (const dir of checkPaths) {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    if (files.length > 0) {
      migrationFile = path.join(dir, files[files.length - 1]); // newest
      break;
    }
  }
}

if (migrationFile && fs.existsSync(migrationFile)) {
  console.log(`Found migration file: ${migrationFile}`);
  const migration = JSON.parse(fs.readFileSync(migrationFile, 'utf8'));
  console.log('Migration content:', JSON.stringify(migration, null, 2));

  // Extract values from capsule migration format
  const cells = migration.cell_recipes ?? migration.cells ?? [];
  const cell = cells.find(c =>
    (c.name ?? c.cell_name ?? '').toLowerCase().includes('ckbfs')
  ) ?? cells[0];

  if (cell) {
    const codeHash = cell.type_id ?? cell.code_hash ?? cell.data_hash;
    const txHash   = cell.tx_hash;
    const txIndex  = cell.index ?? cell.tx_index ?? 0;

    console.log(`\nExtracted values:`);
    console.log(`  CKBFS_CODE_HASH = ${codeHash}`);
    console.log(`  CKBFS_TX_HASH   = ${txHash}`);
    console.log(`  CKBFS_TX_INDEX  = ${txIndex}`);

    updateEnv(codeHash, txHash, txIndex);
  } else {
    console.error('❌ Could not find CKBFS cell in migration file.');
    printManualInstructions();
  }
} else {
  console.log('No migration file found. You need to set values manually.\n');
  printManualInstructions();
}

function updateEnv(codeHash, txHash, txIndex) {
  // Read existing .env or create from example
  let envContent = '';
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf8');
  } else if (fs.existsSync(ENV_EXAMPLE_PATH)) {
    envContent = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');
    console.log('  Creating sdk/.env from sdk/.env.example');
  } else {
    envContent = `PRIVATE_KEY=0x\nCKBFS_CODE_HASH=${codeHash}\nCKBFS_TX_HASH=${txHash}\nCKBFS_TX_INDEX=${txIndex}\n`;
  }

  // Replace values
  envContent = envContent
    .replace(/^CKBFS_CODE_HASH=.*/m, `CKBFS_CODE_HASH=${codeHash}`)
    .replace(/^CKBFS_TX_HASH=.*/m, `CKBFS_TX_HASH=${txHash}`)
    .replace(/^CKBFS_TX_INDEX=.*/m, `CKBFS_TX_INDEX=${txIndex}`);

  fs.writeFileSync(ENV_PATH, envContent, 'utf8');
  console.log(`\n✅ sdk/.env updated with deployment values!`);
  console.log(`  Set your PRIVATE_KEY in sdk/.env if not already set.`);
  console.log(`  Then run: npm run test:preflight`);
}

function printManualInstructions() {
  console.log(`\nManual setup steps:
  1. Deploy the CKBFS binary to testnet:
     cd ckbfs-type-script
     capsule build --release
     capsule deploy --env testnet

  2. After deployment, capsule will print output like:
     ✓ Cell: ckbfs-type-script
       data_hash: 0xABCD...
       type_hash: 0x1234...
       tx_hash:   0xDEAD...
       index:     0

  3. Copy those values to sdk/.env:
     CKBFS_CODE_HASH=0x<type_hash_from_above>
     CKBFS_TX_HASH=0x<tx_hash_from_above>
     CKBFS_TX_INDEX=0

  4. Also set your PRIVATE_KEY in sdk/.env

  5. Run: npm run test:preflight
     Then: npm run test:live
`);
}
