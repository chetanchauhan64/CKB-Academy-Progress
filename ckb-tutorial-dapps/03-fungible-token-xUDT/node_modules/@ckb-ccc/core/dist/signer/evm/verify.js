import { verifyMessage } from "ethers";
import { bytesFrom } from "../../bytes/index.js";
/**
 * @public
 */
export function verifyMessageEvmPersonal(message, signature, address) {
    return (address.toLowerCase() ===
        verifyMessage(typeof message === "string" ? message : bytesFrom(message), signature).toLowerCase());
}
