import { bech32m } from "bech32";
import { bytesConcat, bytesFrom } from "../bytes/index.js";
import { Script, hashTypeToBytes } from "../ckb/index.js";
import { ADDRESS_BECH32_LIMIT, AddressFormat, addressFromPayload, addressPayloadFromString, } from "./address.advanced.js";
/**
 * Represents a ckb address with associated script and prefix.
 * @public
 */
export class Address {
    /**
     * Creates an instance of Address.
     *
     * @param script - The script associated with the address.
     * @param prefix - The address prefix.
     */
    constructor(script, prefix) {
        this.script = script;
        this.prefix = prefix;
    }
    /**
     * Creates an Address instance from an AddressLike object.
     *
     * @param address - An AddressLike object or an instance of Address.
     * @returns An Address instance.
     */
    static from(address) {
        if (address instanceof Address) {
            return address;
        }
        return new Address(Script.from(address.script), address.prefix);
    }
    /**
     * Creates an Address instance from an address string.
     *
     * @param address - The address string to parse.
     * @param clients - A Client instance or a record of Client instances keyed by prefix.
     * @returns A promise that resolves to an Address instance.
     *
     * @throws Will throw an error if the address prefix is unknown or mismatched.
     */
    static async fromString(address, clients) {
        const { prefix, format, payload } = addressPayloadFromString(address);
        const client = clients[prefix] ?? clients;
        if (!client) {
            throw new Error(`Unknown address prefix ${prefix}`);
        }
        const expectedPrefix = client.addressPrefix;
        if (expectedPrefix !== prefix) {
            throw new Error(`Unknown address prefix ${prefix}, expected ${expectedPrefix}`);
        }
        return Address.from(await addressFromPayload(prefix, format, payload, client));
    }
    /**
     * Creates an Address instance from a script and client.
     *
     * @param script - The script-like object.
     * @param client - The client instance used to fetch the address prefix.
     * @returns A promise that resolves to an Address instance.
     */
    static fromScript(script, client) {
        return Address.from({ script, prefix: client.addressPrefix });
    }
    static async fromKnownScript(client, script, args) {
        return Address.from({
            script: await Script.fromKnownScript(client, script, args),
            prefix: client.addressPrefix,
        });
    }
    /**
     * Converts the Address instance to a string.
     *
     * @returns The address as a string.
     */
    toString() {
        const data = bytesConcat([AddressFormat.Full], bytesFrom(this.script.codeHash), hashTypeToBytes(this.script.hashType), bytesFrom(this.script.args));
        return bech32m.encode(this.prefix, bech32m.toWords(data), ADDRESS_BECH32_LIMIT);
    }
}
