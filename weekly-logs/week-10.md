## Week 10

**Date:** 4th - 11th Dec, 2025

### Tasks Completed

### CKB Development Progress - Created DOB (Digital Object) dApp

Followed the [Create a DOB (Digital Object) – dApp tutorial](https://docs.nervos.org/docs/dapp/create-dob) to build a simple dApp that allows creating on-chain Digital Objects (DOBs) using the Spore protocol.

- Set up the devnet node and ran it using `offckb node`.
- Got the [lumos-scripts.json](../ckb-tutorial-dapps/04-create-dob/lumos-scripts.json) file by exporting system scripts using the command:
  ```bash
  offckb system-scripts --export-style lumos > lumos-scripts.json
  ```
- Replaced the entire `lumosConfig` object in `spore-config.ts` with the freshly exported scripts.
- Performed DOB creation transactions on the local devnet using the [Cube](../assets/cube-image-used-to-create-DOB.jpg) image.
- Created an `.env` file with `NETWORK=testnet`, switched to testnet, and successfully created the DOB with Txn Hash: [0x69f0f77a20a641dc572d9decfeb1b1bb9ecd89afba5a5a1d090ea9f204b46f34](https://testnet.explorer.nervos.org/transaction/0x69f0f77a20a641dc572d9decfeb1b1bb9ecd89afba5a5a1d090ea9f204b46f34)

- Implemented and studied the following functions from `lib.ts`:

  1. **`generateAccountFromPrivateKey()`**

     - Uses CCC (`@ckb-ccc/core`) signer to:
       - Derive lock script
       - Derive address
       - Expose public key

  2. **`capacityOf()`**

     - Reads total CKB balance for an address using `cccClient.getBalance()`.

  3. **`createSporeDOB()` - Core functionality**

     - Creates a new Spore (Digital Object) on-chain.
     - Builds a `toLock` from the wallet’s default lock script.
     - Passes DOB data into `createSpore()`:
       ```ts
       data: {
         contentType: "image/jpeg",
         content,
       }
       ```
     - Uses:
       - `fromInfos: [wallet.address]`
       - `toLock: wallet.lock`
       - `config: SPORE_CONFIG`
     - Signs and broadcasts the transaction using:
       ```ts
       wallet.signAndSendTransaction(txSkeleton);
       ```
     - Logs:
       - Transaction hash where the DOB was created
       - Spore ID (output type script `args`)

  4. **`showSporeContent()`**

     - Fetches the DOB cell using `txHash` and output index.
     - Parses DOB data using:
       ```ts
       unpackToRawSporeData(cell.outputData);
       ```
     - Returns:
       - `contentType`
       - Raw `content` buffer (used by frontend to render the image)

  5. **`shannonToCKB()`**
     - Utility function to convert on-chain balance from Shannon → CKB.

- Related screenshots:
    <table style="width:100%; text-align:center;">
    <tr><td style="width:33.3%; vertical-align:top; text-align:center;">
   <img width="1582" height="945" alt="Screenshot 2025-12-18 at 9 59 29 PM" src="https://github.com/user-attachments/assets/7a8fc006-6d79-45a1-8791-ccd8e2accf51" />
    <p style="text-align:center;">1. <a href="https://docs.nervos.org/docs/dapp/create-dob">DOB (Digital Object) - Local Setup</a></p>
    </td>
    <td style="width:33.3%; vertical-align:top; text-align:center;">
   <img width="1470" height="923" alt="Screenshot 2025-12-18 at 9 53 33 PM" src="https://github.com/user-attachments/assets/e03f35cb-77b3-4b23-83e5-a5fd7579e956" />
    <p style="text-align:center;">2. Creating a Digital Object (DOB)</p>
    </td>
    <td style="width:33.3%; vertical-align:top; text-align:center;">
  <img width="1117" height="567" alt="Screenshot 2025-12-18 at 10 31 50 PM" src="https://github.com/user-attachments/assets/faeae19b-a7bc-44a6-aafa-64d40c90de99" />
    <p style="text-align:center;">3. <a href="https://testnet.explorer.nervos.org/transaction/0x69f0f77a20a641dc572d9decfeb1b1bb9ecd89afba5a5a1d090ea9f204b46f34">DOB Created & Spore Content Displayed</a></p>
    </td></tr>
    </table>
    
### References

- [Create a DOB (Digital Object) - dApp tutorial](https://docs.nervos.org/docs/dapp/create-dob)
- Spore Protocol: [Official Docs](https://docs.spore.pro/) | [Nervos Docs](https://docs.nervos.org/docs/ecosystem-scripts/spore-protocol)
- [Faucet](https://faucet.nervos.org/) | [Testnet Explorer](https://testnet.explorer.nervos.org/)













