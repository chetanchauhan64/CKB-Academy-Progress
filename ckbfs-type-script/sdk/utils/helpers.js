/**
 * utils/helpers.js — Backward Compatibility Shim
 *
 * Phase 1 callers imported helpers from here. Phase 2 moves these to:
 *   wallet/Wallet.js       — key derivation, signing
 *   builder/InputSelector.js — cell queries, indexer
 *   executor/Sender.js     — getRpc()
 *   executor/Confirmer.js  — waitForTransaction → waitForCommit
 *
 * This shim re-exports from the new locations so any existing code
 * referencing utils/helpers.js continues to work unchanged.
 *
 * @deprecated Import directly from the new modules for production use.
 */

export { getRpc } from '../executor/Sender.js';
export { getIndexer } from '../builder/InputSelector.js';

export {
  findCkbfsCells,
  findCkbfsCellsByFileId,
} from '../builder/InputSelector.js';

export { waitForCommit as waitForTransaction } from '../executor/Confirmer.js';

// Wallet utilities — re-exported as named functions for compatibility
import { Wallet } from '../wallet/Wallet.js';
import { utils } from '@ckb-lumos/lumos';

export function privateKeyToAccount(privateKey) {
  const w = Wallet.fromPrivateKey(privateKey);
  return {
    privateKey,
    publicKey: w.publicKey,
    args: w.args,
    address: w.address,
    lockScript: w.lockScript,
    lockHash: w.lockHash,
  };
}

export function computeLockHash(lockScript) {
  return utils.computeScriptHash(lockScript);
}

// computeCellCapacity is now in builder/FeeCalculator.js
export { computeCkbfsCellMinCapacity as computeCellCapacity } from '../builder/FeeCalculator.js';

// signAndSendTransaction is split into Signer + Sender; provide a simple bridge
import { signTransaction } from '../executor/Signer.js';
import { sendTransaction } from '../executor/Sender.js';

export async function signAndSendTransaction({ txSkeleton, privateKey }) {
  throw new Error(
    'signAndSendTransaction() is deprecated in Phase 2. ' +
      'Use signTransaction() from executor/Signer.js and sendTransaction() from executor/Sender.js.'
  );
}
