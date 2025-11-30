import { SignerDummy } from "./dummy.js";
/**
 * @public
 */
export class SignerOpenLink extends SignerDummy {
    constructor(client, type, link) {
        super(client, type);
        this.link = link;
    }
    async connect() {
        window.open(this.link, "_blank")?.focus();
    }
}
