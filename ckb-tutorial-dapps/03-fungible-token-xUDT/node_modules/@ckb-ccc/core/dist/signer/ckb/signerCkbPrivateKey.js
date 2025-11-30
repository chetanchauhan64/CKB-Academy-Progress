import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesConcat, bytesFrom } from "../../bytes/index.js";
import { Transaction, WitnessArgs } from "../../ckb/index.js";
import { hexFrom } from "../../hex/index.js";
import { numBeToBytes } from "../../num/index.js";
import { SignerCkbPublicKey } from "./signerCkbPublicKey.js";
import { messageHashCkbSecp256k1 } from "./verifyCkbSecp256k1.js";
/**
 * @public
 */
export class SignerCkbPrivateKey extends SignerCkbPublicKey {
    constructor(client, privateKey) {
        const pk = hexFrom(privateKey);
        if (bytesFrom(pk).length !== 32) {
            throw new Error("Private key must be 32 bytes!");
        }
        super(client, secp256k1.getPublicKey(bytesFrom(pk), true));
        this.privateKey = pk;
    }
    async _signMessage(message) {
        const signature = secp256k1.sign(bytesFrom(message), bytesFrom(this.privateKey));
        const { r, s, recovery } = signature;
        return hexFrom(bytesConcat(numBeToBytes(r, 32), numBeToBytes(s, 32), numBeToBytes(recovery, 1)));
    }
    async signMessageRaw(message) {
        return this._signMessage(messageHashCkbSecp256k1(message));
    }
    async signOnlyTransaction(txLike) {
        const tx = Transaction.from(txLike);
        for (const { script } of await this.getRelatedScripts(tx)) {
            const info = await tx.getSignHashInfo(script, this.client);
            if (!info) {
                return tx;
            }
            const signature = await this._signMessage(info.message);
            const witness = tx.getWitnessArgsAt(info.position) ?? WitnessArgs.from({});
            witness.lock = signature;
            tx.setWitnessArgsAt(info.position, witness);
        }
        return tx;
    }
}
