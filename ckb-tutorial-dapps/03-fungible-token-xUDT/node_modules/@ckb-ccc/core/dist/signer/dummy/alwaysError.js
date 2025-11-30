import { SignerDummy } from "./dummy.js";
/**
 * @public
 */
export class SignerAlwaysError extends SignerDummy {
    constructor(client, type, message) {
        super(client, type);
        this.message = message;
    }
    async connect() {
        throw new Error(this.message);
    }
}
