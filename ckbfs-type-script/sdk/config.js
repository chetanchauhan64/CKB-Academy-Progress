/**
 * config.js — CKBFS SDK Network & Script Configuration
 *
 * Sets up Lumos for CKB Testnet (Aggron4).
 * Exports the RPC endpoint, indexer URL, and the CKBFS Type Script descriptor
 * that the transaction builders need.
 *
 * Environment variables (put these in sdk/.env):
 *   PRIVATE_KEY          — 0x-prefixed 32-byte hex private key (NEVER commit!)
 *   CKB_RPC_URL          — optional override (default: Aggron4 public RPC)
 *   CKB_INDEXER_URL      — optional override (default: Aggron4 public indexer)
 *   CKBFS_CODE_HASH      — 0x-prefixed code_hash of the deployed CKBFS binary
 *   CKBFS_TX_HASH        — transaction hash where the CKBFS binary was deployed
 *   CKBFS_TX_INDEX       — output index of the CKBFS binary cell (default: 0)
 */

import 'dotenv/config';
import { predefined, initializeConfig } from '@ckb-lumos/config-manager';

// ── Network Endpoints ──────────────────────────────────────────────────────────

/**
 * Aggron4 public RPC endpoint (read-only, no auth required).
 * Replace with your own node for production workloads.
 */
export const CKB_RPC_URL =
  process.env.CKB_RPC_URL ?? 'https://testnet.ckbapp.dev';

/**
 * Aggron4 public Lumos indexer endpoint.
 * The indexer is required for querying live cells by lock/type script.
 */
export const CKB_INDEXER_URL =
  process.env.CKB_INDEXER_URL ?? 'https://testnet.ckbapp.dev/indexer';

// ── Lumos Config Initialization ───────────────────────────────────────────────

/**
 * Initialize Lumos with the Aggron4 (testnet) predefined config.
 *
 * This must be called once before any Lumos helpers are used.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initLumosConfig() {
  initializeConfig(predefined.AGGRON4);
}

// Auto-initialize on module import so callers don't have to remember.
initLumosConfig();

// ── CKBFS Type Script Descriptor ──────────────────────────────────────────────

/**
 * The deployed CKBFS Type Script cell dep.
 *
 * After you run `capsule deploy` on Aggron4, set the resulting tx_hash and
 * out_index in your .env file. The code_hash is the blake2b hash of the
 * deployed binary (printed by capsule deploy).
 *
 * Until the binary is deployed, the values below are placeholders that will
 * cause transactions to fail — replace them with real values before using.
 */
export const CKBFS_CODE_HASH =
  process.env.CKBFS_CODE_HASH ??
  '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * The out-point of the cell that holds the CKBFS binary.
 * Used as a `cellDep` in every CKBFS transaction.
 */
export const CKBFS_BINARY_OUT_POINT = {
  txHash:
    process.env.CKBFS_TX_HASH ??
    '0x0000000000000000000000000000000000000000000000000000000000000000',
  index: Number(process.env.CKBFS_TX_INDEX ?? 0),
};

/**
 * CellDep entry referencing the deployed CKBFS binary.
 * Include this in every transaction that uses CKBFS cells.
 */
export const CKBFS_CELL_DEP = {
  outPoint: CKBFS_BINARY_OUT_POINT,
  depType: 'code', // the cell holds the executable directly
};

// ── Protocol Constants ─────────────────────────────────────────────────────────

/**
 * Minimum CKB required per CKBFS cell.
 * 61 bytes base + 42-byte header + content = variable.
 * We use a conservative floor; actual capacity is computed per-cell.
 * Unit: shannons (1 CKB = 1e8 shannons).
 */
export const MIN_CELL_CAPACITY = 6100000000n; // 61 CKB in shannons

/** Transaction fee rate in shannons per 1000 bytes. */
export const TX_FEE_RATE = 1000n;

/** Standard transaction fee (shannons). Lumos will auto-compute the exact fee. */
export const DEFAULT_TX_FEE = 100000n; // 0.001 CKB

// ── Aggron4 Well-Known Scripts ─────────────────────────────────────────────────

/** Secp256k1/Blake160 lock script code hash on Aggron4 (type-id). */
export const SECP256K1_CODE_HASH =
  '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8';

/** Secp256k1/Blake160 lock script hash type. */
export const SECP256K1_HASH_TYPE = 'type';
