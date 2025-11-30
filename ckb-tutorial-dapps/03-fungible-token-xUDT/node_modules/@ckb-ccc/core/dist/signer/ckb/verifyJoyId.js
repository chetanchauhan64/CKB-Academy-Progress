import { verifySignature } from "@joyid/ckb";
import { hexFrom } from "../../hex/index.js";
/**
 * @public
 */
export function verifyMessageJoyId(message, signature, identity) {
    const challenge = typeof message === "string" ? message : hexFrom(message).slice(2);
    const { publicKey, keyType } = JSON.parse(identity);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return verifySignature({
        challenge,
        pubkey: publicKey,
        keyType,
        ...JSON.parse(signature),
    });
}
