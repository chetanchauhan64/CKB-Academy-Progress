import { Signer, SignerSignType } from "../signer/index.js";
/**
 * @public
 */
export class SignerDummy extends Signer {
    get signType() {
        return SignerSignType.Unknown;
    }
    constructor(client, type) {
        super(client);
        this.type = type;
    }
    async isConnected() {
        return false;
    }
    async getInternalAddress() {
        throw new Error("Can't get address from SignerDummy");
    }
    async getAddressObjs() {
        throw new Error("Can't get addresses from SignerDummy");
    }
}
