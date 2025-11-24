import { ccc, Script } from "@ckb-ccc/core";
import { cccClient } from "./ccc-client";

type Account = {
  lockScript: Script;
  address: string;
  pubKey: string;
};

export const generateAccountFromPrivateKey = async (
  privKey: string
): Promise<Account> => {
  const signer = new ccc.SignerCkbPrivateKey(cccClient, privKey);
  const lock = await signer.getAddressObjSecp256k1();
  return {
    lockScript: lock.script,
    address: lock.toString(),
    pubKey: signer.publicKey,
  };
};

export async function capacityOf(address: string): Promise<bigint> {
  const addr = await ccc.Address.fromString(address, cccClient);
  let balance = await cccClient.getBalance([addr.script]);
  return balance;
}

export async function transfer(
  toAddress: string,
  amountInCKB: string,
  signerPrivateKey: string
): Promise<string> {
  const signer = new ccc.SignerCkbPrivateKey(cccClient, signerPrivateKey);
  const { script: toLock } = await ccc.Address.fromString(toAddress, cccClient);

  const tx = ccc.Transaction.from({
    outputs: [{ lock: toLock }],
    outputsData: [],
  });

  tx.outputs.forEach((output, i) => {
    if (output.capacity > ccc.fixedPointFrom(amountInCKB)) {
      alert(`Insufficient capacity at output ${i}`);
      return;
    }
    output.capacity = ccc.fixedPointFrom(amountInCKB);
  });

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);

  const txHash = await signer.sendTransaction(tx);
  console.log(`Explorer: https://pudge.explorer.nervos.org/transaction/${txHash}`);

  return txHash;
}

export async function wait(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export function shannonToCKB(amount: bigint) {
  return amount / 100000000n;
}
