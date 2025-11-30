import { hexFrom } from "../../hex/index.js";
import { SignerEvm } from "./signerEvm.js";
/**
 * A class extending SignerEvm that provides read-only access to an EVM address.
 * This class does not support signing operations.
 * @public
 */
export class SignerEvmAddressReadonly extends SignerEvm {
    /**
     * Creates an instance of SignerEvmAddressReadonly.
     *
     * @param client - The client instance used for communication.
     * @param address - The EVM address associated with the signer.
     */
    constructor(client, address) {
        super(client);
        this.address = hexFrom(address);
    }
    /**
     * Connects to the client. This implementation does nothing as the class is read-only.
     *
     * @returns A promise that resolves when the connection is complete.
     *
     * @example
     * ```typescript
     * await signer.connect();
     * ```
     */
    async connect() { }
    /**
     * Check if the signer is connected.
     *
     * @returns A promise that resolves the connection status.
     */
    async isConnected() {
        return true;
    }
    /**
     * Gets the EVM account associated with the signer.
     *
     * @returns A promise that resolves to a string representing the EVM account.
     *
     * @example
     * ```typescript
     * const account = await signer.getEvmAccount(); // Outputs the EVM account
     * ```
     */
    async getEvmAccount() {
        return this.address;
    }
}
