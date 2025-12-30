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
     <img width="1470" height="923" alt="Screenshot 2025-12-30 at 10 02 14 PM" src="https://github.com/user-attachments/assets/ce6286a2-8d66-46eb-9b41-36c1f28b6843" />
      <p style="text-align:center;">2. CKBFS Service Layer</p>
    </td>
    <td style="width:33.3%; vertical-align:top; text-align:center;">
      <img
        width="1470"
        height="919"
        alt="Local Setup & Installation"
        src="./week-13/terminal-install.png"
      />
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
      <img
        width="1470"
        height="919"
        alt="Blog Listing Page"
        src="./week-13/ui-home.png"
      />
      <p style="text-align:center;">4. Blog Listing Page</p>
    </td>
    <td style="width:50%; vertical-align:top; text-align:center;">
      <img
        width="1470"
        height="919"
        alt="Publish Success"
        src="./week-13/publish-success.png"
      />
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




