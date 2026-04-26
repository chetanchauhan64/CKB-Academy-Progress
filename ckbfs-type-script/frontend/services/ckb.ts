/**
 * services/ckb.ts — Centralized CKB / Lumos network configuration
 *
 * CRITICAL: Lumos defaults to mainnet (LINA). All testnet address parsing
 * MUST use AGGRON4, otherwise parseAddress throws "Invalid checksum".
 *
 * We hard-force AGGRON4 for all ckt1… addresses as a safety measure.
 */

import { helpers, config } from '@ckb-lumos/lumos';

const RPC = process.env.NEXT_PUBLIC_CKB_RPC_URL ?? '';
const isTestnet =
  RPC.includes('testnet') ||
  RPC.includes('ckbapp') ||
  RPC.includes('pudge') ||
  RPC === '';           // default / dev = testnet

export const CKB_CONFIG = isTestnet ? config.predefined.AGGRON4 : config.predefined.LINA;

/**
 * Parse any CKB address safely using the correct network config.
 * ckt1… → AGGRON4, ckb1… → LINA.
 * Never throws a raw Lumos error — always includes the address in the message.
 */
export function parseCkbAddress(address: string) {
  const trimmed = address.trim();

  if (!trimmed) throw new Error('Address is empty');

  // Auto-select config from prefix to avoid "Invalid checksum"
  const cfg = trimmed.startsWith('ckt1')
    ? config.predefined.AGGRON4
    : trimmed.startsWith('ckb1')
    ? config.predefined.LINA
    : CKB_CONFIG;

  try {
    return helpers.parseAddress(trimmed, { config: cfg });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Failed to parse address "${trimmed.slice(0, 20)}…": ${msg}\n` +
      'Ensure you are using a valid CKB Aggron4 testnet address (starts with ckt1).'
    );
  }
}

/**
 * Convert any CKB address → internal { codeHash, hashType, args }.
 */
export function toLockScript(address: string) {
  const s = parseCkbAddress(address);
  return {
    codeHash: s.codeHash,
    hashType: s.hashType as string,
    args: s.args,
  };
}

export const RPC_URL   = process.env.NEXT_PUBLIC_CKB_RPC_URL    ?? 'https://testnet.ckbapp.dev';
export const CODE_HASH = process.env.NEXT_PUBLIC_CKBFS_CODE_HASH ?? '';
export const TX_HASH   = process.env.NEXT_PUBLIC_CKBFS_TX_HASH   ?? '';
export const OUT_INDEX = process.env.NEXT_PUBLIC_CKBFS_OUT_INDEX  ?? '0x0';
export const EXPLORER  = 'https://pudge.explorer.nervos.org';
