/**
 * scripts/check_balance.js — Quick balance checker
 */
import 'dotenv/config';
import { predefined, initializeConfig } from '@ckb-lumos/config-manager';
initializeConfig(predefined.AGGRON4);
import { Wallet } from '../wallet/Wallet.js';
import { getBalance } from '../builder/InputSelector.js';

const wallet = Wallet.fromEnv();
const balance = await getBalance(wallet.address);
const ckb = Number(balance) / 1e8;

console.log('\n══════════════════════════════════════════');
console.log('  CKBFS Wallet Balance Check');
console.log('══════════════════════════════════════════');
console.log(`  Address : ${wallet.address}`);
console.log(`  Balance : ${ckb.toFixed(4)} CKB`);
console.log(`  Shannons: ${balance.toString()}`);
console.log('══════════════════════════════════════════');

const MIN = 55_000;
if (ckb >= MIN) {
  console.log(`  ✅ Sufficient (>= ${MIN} CKB) — ready to deploy\n`);
  process.exit(0);
} else {
  console.log(`  ❌ Insufficient — need ${MIN} CKB, have ${ckb.toFixed(4)} CKB`);
  console.log(`  Fund at: https://faucet.nervos.org/`);
  console.log(`  Address: ${wallet.address}\n`);
  process.exit(1);
}
