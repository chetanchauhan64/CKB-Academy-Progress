/**
 * wallet/Wallet.js — CKBFS Production Wallet
 *
 * A value object that encapsulates everything derived from a private key:
 *   - Public key (33-byte compressed secp256k1)
 *   - Lock script args (Blake160 of public key = 20 bytes)
 *   - Lock script (Secp256k1/Blake160 on Aggron4)
 *   - CKB address (bech32m encoded)
 *   - Lock hash (Blake2b of serialized lock script)
 *   - Signing capability (sign a 32-byte message digest)
 *
 * SECURITY:
 *   - Private key is read from process.env.PRIVATE_KEY by default.
 *   - Never logged, never serialized.
 *   - The Wallet object is not JSON-serializable (no toJSON).
 *
 * Usage:
 *   const wallet = Wallet.fromEnv();              // reads process.env.PRIVATE_KEY
 *   const wallet = new Wallet('0xdeadbeef...');   // explicit key
 */

import { hd, helpers, config, utils } from '@ckb-lumos/lumos';
import { CkbfsError } from '../utils/errors.js';

// ── Wallet Class ──────────────────────────────────────────────────────────────

export class Wallet {
  // #privateKey is kept as a private field — not enumerable, not JSON-serializable.
  #privateKey;

  /**
   * @param {string} privateKey - 0x-prefixed 32-byte hex private key.
   */
  constructor(privateKey) {
    // ── 1. Validate format ─────────────────────────────────────────────────
    if (typeof privateKey !== 'string') {
      throw new CkbfsError('Private key must be a string');
    }
    const normalised = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
    const hex = normalised.slice(2);
    if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
      throw new CkbfsError(
        'Invalid private key: must be 0x-prefixed 32-byte hex (64 hex characters)'
      );
    }

    this.#privateKey = normalised;

    // ── 2. Derive public key (33-byte compressed secp256k1) ───────────────
    // In Lumos 0.22, privateToPublic(key) → '0x...' 33-byte hex string.
    this.publicKey = hd.key.privateToPublic(normalised);

    // ── 3. Derive lock script args (Blake160 of public key = 20 bytes) ────
    // privateKeyToBlake160(key) → '0x...' 20-byte blake160 string (args directly).
    this.args = hd.key.privateKeyToBlake160(normalised);

    // ── 4. Build lock script from AGGRON4 config ──────────────────────────
    const secp = config.getConfig().SCRIPTS.SECP256K1_BLAKE160;
    this.lockScript = {
      codeHash: secp.CODE_HASH,
      hashType: secp.HASH_TYPE,
      args: this.args,
    };

    // ── 5. Encode human-readable CKB address ─────────────────────────────
    this.address = helpers.encodeToAddress(this.lockScript);

    // ── 6. Compute lock hash (Blake2b of serialised lock script) ──────────
    // Used as `owner_lock_hash` in CKBFS Type Script args.
    this.lockHash = utils.computeScriptHash(this.lockScript);

    // Freeze public properties — the wallet is immutable after construction.
    Object.freeze(this);
  }

  // ── Signing ────────────────────────────────────────────────────────────────

  /**
   * Sign a 32-byte message digest with the private key.
   *
   * CKB uses recoverable secp256k1 signatures (65 bytes):
   *   bytes [0]     = recovery id (0 or 1)
   *   bytes [1..64] = (r, s)
   *
   * @param {string} messageHex - 0x-prefixed 32-byte message digest.
   * @returns {string} 0x-prefixed 65-byte recoverable signature hex.
   */
  sign(messageHex) {
    return hd.key.signRecoverable(messageHex, this.#privateKey);
  }

  // ── Prevent serialization of the private key ───────────────────────────────

  toJSON() {
    return {
      publicKey: this.publicKey,
      args: this.args,
      address: this.address,
      lockHash: this.lockHash,
      // privateKey is intentionally excluded
    };
  }

  // ── Static Factories ───────────────────────────────────────────────────────

  /**
   * Create a Wallet from process.env.PRIVATE_KEY.
   * Throws CkbfsError if the env var is missing or malformed.
   *
   * @returns {Wallet}
   */
  static fromEnv() {
    const key = process.env.PRIVATE_KEY;
    if (!key) {
      throw new CkbfsError(
        'PRIVATE_KEY environment variable is not set. ' +
          'Copy sdk/.env.example to sdk/.env and fill in your testnet private key.'
      );
    }
    return new Wallet(key);
  }

  /**
   * Create a Wallet from an explicit private key string.
   * Alias for `new Wallet(privateKey)` — provided for readability.
   *
   * @param {string} privateKey
   * @returns {Wallet}
   */
  static fromPrivateKey(privateKey) {
    return new Wallet(privateKey);
  }
}
