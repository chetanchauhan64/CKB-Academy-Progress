## Week 16

**Date:** 24th – 31st December, 2026

### Tasks Completed

- Implemented **On-Chain Blog Publishing (CKBFS Integration)**.
  - Built publish flow using CKBFS witness-based storage.
  - Encoded blog data (title, content, metadata) into transaction witnesses.
  - Added Adler32 checksum validation for data integrity.
  - Successfully stored and retrieved posts from Nervos CKB testnet.

<table>
  <tr>
    <td align="center">
      <img width="1470" height="923" alt="publish flow " src="https://github.com/user-attachments/assets/ef6bb2bf-e930-4214-944e-e409f5e55867" />
      <p>1. On-Chain Publish Flow</p>
    </td>
  </tr>
</table>

---

- Implemented **Versioning & Append-Only System**.
  - Created immutable version chain using append transactions.
  - Linked previous blog versions via transaction hashes.
  - Enabled edit functionality without overwriting original content.
  - Built version tree structure for tracking history and forks.

<table>
  <tr>
    <td align="center" width="50%">
      <img width="1470" height="923" alt="tree" src="https://github.com/user-attachments/assets/8c1c7a87-d33b-40a9-b048-1e2eb8f0ecc3" />
      <p>2. Version Tree Visualization</p>
    </td>
    <td align="center" width="50%">
      <img width="1470" height="923" alt="fork" src="https://github.com/user-attachments/assets/8bc7b19a-e61b-4d0c-95b6-5fa0d8cf893b" />
      <p>3. Fork & Append Flow</p>
    </td>
  </tr>
</table>

---

- Integrated **AI Writing Assist (OpenRouter)**.
  - Connected Claude 3 Haiku via OpenRouter API.
  - Implemented:
    - Content improvement
    - Title generation
    - Summary generation
  - Added fallback to mock AI mode when API key is not present.

<table>
  <tr>
    <td align="center">
      <img width="1470" height="923" alt="ai" src="https://github.com/user-attachments/assets/467228c0-767b-4859-af68-d8698f4c3212" />
      <p>4. AI Writing Assist</p>
    </td>
  </tr>
</table>

---

- Built **Frontend Dashboard & Core Pages (Next.js 14)**.
  - Developed pages:
    - Feed (homepage)
    - Write (editor)
    - Dashboard
    - Profile
  - Implemented Zustand for global state management.
  - Added responsive UI with smooth navigation and loading states.

<table>
  <tr>
    <td align="center" width="33%">
      <img width="1470" height="923" alt="feed" src="https://github.com/user-attachments/assets/b3a9b250-5237-415d-8d5a-1c69b45541cf" />
      <p>5. Feed Page</p>
    </td>
    <td align="center" width="33%">
      <img width="1470" height="923" alt="editor" src="https://github.com/user-attachments/assets/4374a4cf-1c52-469d-9dbc-cdf5866ba496" />
      <p>6. Editor Page</p>
    </td>
    <td align="center" width="33%">
      <img width="1470" height="923" alt="Dash" src="https://github.com/user-attachments/assets/d2f864d5-a979-43dd-a86d-cd1bfbc41da9" />
      <p>7. Dashboard Page</p>
    </td>
  </tr>
</table>

---

### Wallet Connection Implementation

- Integrated **Multi-Wallet Connection (JoyID / MetaMask / OKX)**:
  - Enabled users to connect their wallet securely.
  - Displayed connected wallet address in the UI.
  - Restricted publishing and interactions until wallet is connected.
  - Ensured seamless wallet switching and session persistence.

<table>
  <tr>
    <td align="center">
      <img width="1470" height="923" alt="wallet" src="https://github.com/user-attachments/assets/48effc9c-8d66-4b54-9bb5-e53110c6520e" />
      <p>9. Wallet Connection Interface</p>
    </td>
  </tr>
</table>

- Implemented **On-Chain Interaction Validation**:
  - Ensured only connected users can publish or interact with posts.
  - Verified transaction flow before submission to CKB testnet.

<table>
  <tr>
    <td align="center">
      <img width="1494" height="951" alt="Screenshot 2026-04-01 at 1 23 59 AM" src="https://github.com/user-attachments/assets/69fb251d-5a3f-4be5-a677-c8fad9ae9745" />
      <p>10. Wallet Connected State</p>
    </td>
  </tr>
</table>

- Deploy final version and conduct **end-to-end testing on testnet**.





