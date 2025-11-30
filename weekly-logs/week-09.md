## Week 06

**Date:** 25th - 30th Nov, 2025

### Tasks Completed

### CKB Development Progress - Fungible Token (xUDT)

Studied xUDT implementation & learned to issue and transfer custom tokens.

- Understood that in CKB, tokens are **User-Defined Tokens (UDTs)** and that the [xUDT (extensible UDT)](https://docs.nervos.org/docs/tech-explanation/xudt) standard builds upon the simpler [sUDT spec (RFC-0025)](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0025-simple-udt/0025-simple-udt.md).

- Followed the [Create a Fungible Token - xUDT tutorial](https://docs.nervos.org/docs/dapp/create-token) to build a simple dApp that allows issuing and transferring xUDT tokens.
  - Setup up the devnet node and ran it using `offckb node`.
  - Generated local devnet accounts using `offckb accounts` in a new terminal.
  - Performed the transaction on the local devnet.
  - Further, created an `.env` file with `NETWORK=testnet` and switched to testnet environment
  - Re-deployed, and successfully reproduced the same transaction flow using faucet-funded accounts.
- Implemented and studied the following functions from `lib.ts`:

  - `issueToken()` - Creates a new xUDT Cell:

    - Generates a lock script from the issuer’s private key.
    - Builds the xUDT Type Script with `args = <issuer lock hash> + 00000000`.
    - Stores the token amount as a 16-byte little-endian integer in `outputsData`.
    - Completes, signs, and broadcasts the transaction.

  - `queryIssuedTokenCells()` - Retrieves live xUDT Cells by Type Script to list token holders.

  - `transferTokenToAddress()` - Transfers tokens by replacing the token Cell’s Lock Script with the receiver’s, calculating change balances, and sending the signed transaction.

- Related screenshots:
    <table style="width:100%; text-align:center;">
    <tr><td style="width:33.3%; vertical-align:top; text-align:center;">
    <img src="../assets/fungible-token-xUDT-tutorial-dapp-local-setup.png" alt="Fungible Token xUDT Tutorial dApp - Local Setup" width="100%">
    <p style="text-align:center;">1. <a href="https://docs.nervos.org/docs/dapp/create-token">Fungible Token (xUDT) - Local Setup</a></p>
    </td>
    <td style="width:33.3%; vertical-align:top; text-align:center;">
    <img src="../assets/issued-and-viewed-custom-token-fungible-token-xUDT-tutorial-dapp.png" alt="Issued and Viewed Custom Token - Fungible Token xUDT Tutorial dApp" width="100%">
    <p style="text-align:center;">2. Issued and Viewed Custom Token</p>
    </td>
    <td style="width:33.3%; vertical-align:top; text-align:center;">
    <img src="../assets/transferred-custom-token-fungible-token-xUDT-tutorial-dapp.png" alt="Transferred Custom Token - Fungible Token xUDT Tutorial dApp" width="100%">
    <p style="text-align:center;">3. Transferred Custom Token</p>
    </td></tr>
    </table>

### Rust Learning and Practice

- Continued learning on [Cyfrin Updraft](https://updraft.cyfrin.io/courses/rust-programming-basics).
- Completed lessons on `Vectors`, `HashMaps`, and `Control Flow`.
- Explored dynamic collections using `Vec<T>` and `HashMap<K, V>`.
- Practiced inserting, updating, and iterating over data structures.
- Learned conditional logic with `if/else`, looping with `for`, `while`, and `loop`, and pattern matching using `match` and `if let`.
- Finished related exercises and quizzes for all topics.

### References

- [Create a Fungible Token - xUDT](https://docs.nervos.org/docs/dapp/create-token)
- [xUDT Specs (RFC-0052)](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0052-extensible-udt/0052-extensible-udt.md) | [sUDT Specs (RFC-0025)](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0025-simple-udt/0025-simple-udt.md)
- [Faucet](https://faucet.nervos.org/) | [Testnet Explorer](https://testnet.explorer.nervos.org/)
