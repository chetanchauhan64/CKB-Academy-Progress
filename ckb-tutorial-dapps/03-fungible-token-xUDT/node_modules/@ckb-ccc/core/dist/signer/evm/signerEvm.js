import { Address } from "../../address/index.js";
import { bytesConcat, bytesFrom } from "../../bytes/index.js";
import { Transaction, WitnessArgs, } from "../../ckb/index.js";
import { KnownScript } from "../../client/index.js";
import { HasherKeecak256 } from "../../hasher/index.js";
import { hexFrom } from "../../hex/index.js";
import { numToBytes } from "../../num/index.js";
import { reduceAsync } from "../../utils/index.js";
import { Signer, SignerSignType, SignerType } from "../signer/index.js";
/**
 * An abstract class extending Signer for Ethereum Virtual Machine (EVM) based signing operations.
 * This class provides methods to get EVM account, internal address, and signing transactions.
 * @public
 */
export class SignerEvm extends Signer {
    get type() {
        return SignerType.EVM;
    }
    get signType() {
        return SignerSignType.EvmPersonal;
    }
    /**
     * Gets the internal address, which is the EVM account in this case.
     *
     * @returns A promise that resolves to a string representing the internal address.
     */
    async getInternalAddress() {
        return this.getEvmAccount();
    }
    /**
     * Gets an array of Address objects representing the known script addresses for the signer.
     *
     * @returns A promise that resolves to an array of Address objects.
     */
    async getAddressObjs() {
        const account = await this.getEvmAccount();
        const addresses = await Promise.all([
            this._getOmniLockAddresses(account),
            this._getPWLockAddresses(account),
        ]);
        return addresses.flat();
    }
    _getOmniLockAddresses(account) {
        return Promise.all([
            this._getOmniLockEvmAddressObj(account),
            this._getOmniLockOldEvmAddressObj(account),
        ]);
    }
    async _getPWLockAddresses(account) {
        const addr = await this._getPWLockEvmAddressObj(account);
        if (!addr) {
            return [];
        }
        return [addr];
    }
    async _getOmniLockEvmAddressObj(account) {
        return Address.fromKnownScript(this.client, KnownScript.OmniLock, hexFrom([0x12, ...bytesFrom(account), 0x00]));
    }
    async _getOmniLockOldEvmAddressObj(account) {
        return Address.fromKnownScript(this.client, KnownScript.OmniLock, hexFrom([0x1, ...bytesFrom(account), 0x00]));
    }
    async _getPWLockEvmAddressObj(account) {
        try {
            return Address.fromKnownScript(this.client, KnownScript.PWLock, hexFrom(bytesFrom(account)));
        }
        catch { }
        return;
    }
    /**
     * prepare a transaction before signing. This method is not implemented and should be overridden by subclasses.
     *
     * @param txLike - The transaction to prepare, represented as a TransactionLike object.
     * @returns A promise that resolves to the prepared Transaction object.
     */
    async prepareTransaction(txLike) {
        const tx = Transaction.from(txLike);
        if ((await tx.findInputIndexByLockId(await this.client.getKnownScript(KnownScript.OmniLock), this.client)) !== undefined) {
            await tx.addCellDepsOfKnownScripts(this.client, KnownScript.OmniLock);
        }
        if ((await tx.findInputIndexByLockId(await this.client.getKnownScript(KnownScript.PWLock), this.client)) !== undefined) {
            await tx.addCellDepsOfKnownScripts(this.client, KnownScript.PWLock);
        }
        const account = await this.getEvmAccount();
        const omniLockAddresses = await this._getOmniLockAddresses(account);
        const pwLockAddresses = await this._getPWLockAddresses(account);
        const omniTx = reduceAsync(omniLockAddresses, (tx, { script }) => tx.prepareSighashAllWitness(script, 85, this.client), tx);
        return reduceAsync(pwLockAddresses, (tx, { script }) => tx.prepareSighashAllWitness(script, 65, this.client), omniTx);
    }
    /**
     * Signs a transaction without modifying it.
     *
     * @param txLike - The transaction to sign, represented as a TransactionLike object.
     * @returns A promise that resolves to a signed Transaction object.
     */
    async signOnlyTransaction(txLike) {
        let tx = Transaction.from(txLike);
        const account = await this.getEvmAccount();
        const { script: evmScript } = await this._getOmniLockEvmAddressObj(account);
        const { script: oldEvmScript } = await this._getOmniLockOldEvmAddressObj(account);
        tx = await this._signOmniLockScriptForTransaction(tx, evmScript, (hash) => `CKB transaction: ${hash}`);
        tx = await this._signOmniLockScriptForTransaction(tx, oldEvmScript, (hash) => bytesFrom(hash));
        const pwAddress = await this._getPWLockEvmAddressObj(account);
        if (pwAddress) {
            tx = await this._signPWLockScriptForTransaction(tx, pwAddress.script, (hash) => bytesFrom(hash));
        }
        return tx;
    }
    async _signOmniLockScriptForTransaction(tx, script, messageTransformer) {
        const info = await this._signPersonalEvmForTransaction(tx, script, messageTransformer);
        if (!info) {
            return tx;
        }
        const witness = WitnessArgs.fromBytes(tx.witnesses[info.position]);
        witness.lock = hexFrom(bytesConcat(numToBytes(5 * 4 + info.signature.length, 4), numToBytes(4 * 4, 4), numToBytes(5 * 4 + info.signature.length, 4), numToBytes(5 * 4 + info.signature.length, 4), numToBytes(info.signature.length, 4), info.signature));
        tx.setWitnessArgsAt(info.position, witness);
        return tx;
    }
    async _signPWLockScriptForTransaction(tx, script, messageTransformer) {
        const info = await this._signPersonalEvmForTransaction(tx, script, messageTransformer, new HasherKeecak256());
        if (!info) {
            return tx;
        }
        const witness = WitnessArgs.fromBytes(tx.witnesses[info.position]);
        witness.lock = hexFrom(info.signature);
        tx.setWitnessArgsAt(info.position, witness);
        return tx;
    }
    async _signPersonalEvmForTransaction(tx, script, messageTransformer, hasher) {
        const info = await tx.getSignHashInfo(script, this.client, hasher);
        if (!info) {
            return;
        }
        const signature = bytesFrom(await this.signMessageRaw(messageTransformer(info.message)));
        if (signature[signature.length - 1] >= 27) {
            signature[signature.length - 1] -= 27;
        }
        return { signature, position: info.position };
    }
}
