/**
 * executor/Signer.js — Secp256k1 Transaction Signer
 *
 * Implements the full CKB signing pipeline:
 *
 * STEP 1 — Build witnesses array
 *   Every input needs a witness slot. Inputs that need signing get a
 *   WitnessArgs molecule with a 65-byte zero lock placeholder. Others get '0x'.
 *
 * STEP 2 — Compute txHash
 *   txHash = ckbHash(molecule_encode(RawTransaction))
 *
 * STEP 3 — Compute signing message for the signing group
 *   message = ckbHash(txHash || len(witness0) || witness0 || len(witness1) || ...)
 *
 * STEP 4 — Sign
 *   signature = secp256k1.signRecoverable(message, privateKey) → 65 bytes
 *
 * STEP 5 — Seal
 *   Replace 65-byte zero placeholder with real signature in WitnessArgs.
 *
 * Reference: https://github.com/nervosnetwork/ckb/blob/develop/script/src/verify.rs
 */

import { utils } from '@ckb-lumos/lumos';
import { blockchain } from '@ckb-lumos/base';
import { bytes } from '@ckb-lumos/codec';
import { CkbfsError } from '../utils/errors.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const SIGNATURE_LENGTH = 65;
const EMPTY_SIGNATURE = '0x' + '00'.repeat(SIGNATURE_LENGTH);

// ── Main Export ────────────────────────────────────────────────────────────────

/**
 * Sign a raw CKB transaction and return a fully sealed transaction.
 *
 * @param {object}   rawTx         - Raw unsigned transaction (from TxBuilder).
 * @param {number[]} signingInputs - Input indices belonging to the signer's lock group.
 * @param {object}   wallet        - Wallet instance (must have .sign(message)).
 * @returns {object} Signed transaction ready for sendTransaction.
 */
export function signTransaction(rawTx, signingInputs, wallet) {
  if (!signingInputs || signingInputs.length === 0) {
    throw new CkbfsError('signingInputs is empty — nothing to sign');
  }

  // ── STEP 1: Build witnesses ──────────────────────────────────────────────
  const witnesses = new Array(rawTx.inputs.length).fill('0x');
  const witnessArgsPlaceholder = buildWitnessArgsPlaceholder();
  witnesses[signingInputs[0]] = witnessArgsPlaceholder;

  // ── STEP 2: Compute txHash ────────────────────────────────────────────────
  const txHash = computeTxHash(rawTx);

  // ── STEP 3: Compute signing message ──────────────────────────────────────
  const message = computeSigningMessage(txHash, witnesses, signingInputs);

  // ── STEP 4: Sign ─────────────────────────────────────────────────────────
  const signature = wallet.sign(message);

  // ── STEP 5: Seal ─────────────────────────────────────────────────────────
  witnesses[signingInputs[0]] = sealWitnessArgs(signature);

  return { ...rawTx, witnesses };
}

// ── Internal: Molecule / Hash Utilities ───────────────────────────────────────

/**
 * Build a WitnessArgs molecule with a 65-byte zero lock placeholder.
 */
function buildWitnessArgsPlaceholder() {
  try {
    const packed = blockchain.WitnessArgs.pack({
      lock: bytes.bytify(EMPTY_SIGNATURE),
      inputType: undefined,
      outputType: undefined,
    });
    return bytes.hexify(packed);
  } catch (err) {
    throw new CkbfsError(`Failed to build WitnessArgs placeholder: ${err.message}`, {}, err);
  }
}

/**
 * Seal a WitnessArgs by replacing the zero-lock placeholder with the real signature.
 */
function sealWitnessArgs(signatureHex) {
  try {
    const packed = blockchain.WitnessArgs.pack({
      lock: bytes.bytify(signatureHex),
      inputType: undefined,
      outputType: undefined,
    });
    return bytes.hexify(packed);
  } catch (err) {
    throw new CkbfsError(`Failed to seal WitnessArgs: ${err.message}`, {}, err);
  }
}

/**
 * Compute the Blake2b-256 hash of a RawTransaction (without witnesses).
 */
function computeTxHash(rawTx) {
  try {
    // Build a molecule-compatible RawTransaction object
    const packed = blockchain.RawTransaction.pack({
      version: parseInt(rawTx.version, 16),
      cellDeps: rawTx.cellDeps.map((dep) => ({
        outPoint: {
          txHash: dep.outPoint.txHash,
          index: parseInt(dep.outPoint.index, 16),
        },
        depType: dep.depType === 'depGroup' ? 'depGroup' : 'code',
      })),
      headerDeps: rawTx.headerDeps ?? [],
      inputs: rawTx.inputs.map((inp) => ({
        previousOutput: {
          txHash: inp.previousOutput.txHash,
          index: parseInt(inp.previousOutput.index, 16),
        },
        since: BigInt(inp.since),
      })),
      outputs: rawTx.outputs.map((out) => ({
        capacity: BigInt(out.capacity),
        lock: normaliseScript(out.lock),
        type: out.type ? normaliseScript(out.type) : undefined,
      })),
      outputsData: rawTx.outputsData.map((d) => bytes.bytify(d === '0x' ? '0x' : d)),
    });
    return utils.ckbHash(packed);
  } catch (err) {
    throw new CkbfsError(`Failed to compute txHash: ${err.message}`, {}, err);
  }
}

/**
 * Compute the CKB signing message for a lock group.
 *
 * Formula: blake2b(txHash || len_u64le(w0) || w0 || len_u64le(w1) || w1 || ...)
 * where w0..wN are the witnesses in the signing group.
 */
function computeSigningMessage(txHash, witnesses, signingInputs) {
  try {
    const hasher = new utils.CKBHasher();
    // Feed txHash (as raw bytes, not hex string)
    hasher.update(bytes.bytify(txHash));

    for (const idx of signingInputs) {
      const witnessBytes = bytes.bytify(witnesses[idx]);
      // 8-byte little-endian length prefix (u64)
      const lenBuf = Buffer.alloc(8);
      lenBuf.writeBigUInt64LE(BigInt(witnessBytes.length));
      hasher.update(lenBuf);
      hasher.update(witnessBytes);
    }

    return hasher.digestHex();
  } catch (err) {
    throw new CkbfsError(`Failed to compute signing message: ${err.message}`, {}, err);
  }
}

function normaliseScript(script) {
  return {
    codeHash: script.codeHash,
    hashType: script.hashType,
    args: script.args,
  };
}
