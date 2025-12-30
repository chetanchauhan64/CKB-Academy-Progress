## Week 13

**Date:** 28th – 30th December, 2025

### Tasks Completed

### Module 4: Backend API & Server Setup
- Implemented backend server for **CKBFS Blog Platform** using **Node.js + Express**.
- Structured backend into clean layers:
  - `routes/` – API routing logic
  - `services/` – CKBFS service layer
  - `middleware/` – environment validation & error handling
- Added `/api/health` endpoint to verify backend availability.
- Configured environment variables using `.env` for local development.

---

### Module 5: CKBFS Service Layer (CID-Based Logic)
- Implemented a **CKBFS-style service layer** on the backend.
- Added logic to:
  - Generate CID-like identifiers for content
  - Store blog content in an in-memory store
  - Fetch blog content using CID
- Ensured content-addressed storage behavior similar to CKBFS.
- Prepared service layer for easy replacement with real CKBFS SDK later.

<table style="width:100%; text-align:center;">
  <tr>
    <td style="width:33.3%; vertical-align:top; text-align:center;">
     <img width="1470" height="923" alt="Screenshot 2025-12-30 at 10 11 08 PM" src="https://github.com/user-attachments/assets/c24ab919-ea14-4616-8d82-fc543b21e46f" />
      <p style="text-align:center;">1. Backend Server Running</p>
    </td>
    <td style="width:33.3%; vertical-align:top; text-align:center;">
 <img width="1470" height="923" alt="Screenshot 2025-12-30 at 11 22 23 PM" src="https://github.com/user-attachments/assets/a757a095-f66f-458d-ad5c-5e3e152811dd" />
      <p style="text-align:center;">2. CKBFS Service Layer</p>
    </td>
    <td style="width:33.3%; vertical-align:top; text-align:center;">
     <img width="1470" height="923" alt="Screenshot 2025-12-30 at 11 12 31 PM" src="https://github.com/user-attachments/assets/b16fe122-b0e6-4812-998a-60e94ee6e036" />
      <p style="text-align:center;">3. Local Setup & Installation</p>
    </td>
  </tr>
</table>

---

### Module 6: Frontend & Backend Integration
- Integrated **React frontend** with backend APIs.
- Replaced mock logic with real API calls for:
  - Publishing blog posts
  - Fetching metadata
  - Retrieving blog content using CID
- Verified complete data flow from UI → Backend → CKBFS service layer.
- Ensured blog listing updates dynamically after publishing.

<table style="width:100%; text-align:center;">
  <tr>
    <td style="width:50%; vertical-align:top; text-align:center;">
     <img width="1470" height="923" alt="Screenshot 2025-12-30 at 11 27 17 PM" src="https://github.com/user-attachments/assets/0874a2de-108f-48c7-981c-c551467010c7" />
      <p style="text-align:center;">4. Blog Listing Page</p>
    </td>
    <td style="width:50%; vertical-align:top; text-align:center;">
   <img width="1470" height="923" alt="Screenshot 2025-12-30 at 11 36 16 PM" src="https://github.com/user-attachments/assets/e8b4e587-df62-4a0c-8397-f29d08304c61" />
      <p style="text-align:center;">5. Publish Success</p>
    </td>
  </tr>
</table>

---

### Module 7: Debugging & Stability Improvements
- Debugged and fixed:
  - Environment variable issues
  - React export/import errors
  - Undefined props in components
  - API connection errors
- Improved frontend stability during data loading.
- Ensured smooth local development workflow.

---

### Next Steps (Week 14)

- **Module 8: Real CKBFS SDK Integration**
  - Replace simulated CID logic with actual CKBFS upload & fetch.
- **Module 9: Enhancements**
  - Improve markdown rendering
  - Optimize error handling & loading states
  - Prepare demo-ready documentation







