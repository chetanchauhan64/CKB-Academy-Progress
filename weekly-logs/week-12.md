## Week 12

**Date:** 19th – 27th December, 2025

### Tasks Completed

### Module 1: Project Architecture & Setup
- Designed the complete architecture for **CKBFS Blog Platform** (decentralized WordPress-style blogging app).
- Structured the project into clear layers:
  - `frontend/` – React + Vite + Tailwind UI
  - `content/` – posts & media (CKBFS-ready)
  - `scripts/` – upload & fetch logic (Node.js)
- Added `ARCHITECTURE.md` to document data flow and component responsibilities.

---

### Module 2: Frontend UI Development
- Built a professional frontend using **React + Tailwind CSS**.
- Implemented core UI components:
  - Blog listing cards with title, excerpt, tags, author, date, and CID
  - Blog detail view with Markdown-style rendering
  - Publish form to simulate uploading content to CKBFS
- Implemented smooth navigation between:
  - Browse Posts
  - Publish Post
  - Individual Blog View

<table>
  <tr>
    <td align="center" width="50%">
      <img width="1470" height="919" alt="Screenshot 2025-12-29 at 7 09 56 PM" src="https://github.com/user-attachments/assets/a626c66b-3773-47f8-a74d-6ea52343a706" />
      <p>1. Blog Listing Page</p>
    </td>
    <td align="center" width="50%">
     <img width="1470" height="919" alt="Screenshot 2025-12-29 at 7 21 52 PM" src="https://github.com/user-attachments/assets/49914366-fb73-4d06-bdf5-d89d764d2f6d" />
      <p>2. Publish to CKBFS Form</p>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img width="1470" height="919" alt="Screenshot 2025-12-29 at 7 59 21 PM" src="https://github.com/user-attachments/assets/282c055f-07f1-479f-a51f-98b5f067fd1b" />
      <p><strong>3. Local Testing</strong></p>
    </td>
  </tr>
</table>

---

### Module 3: CKBFS Data Flow (Mock Integration)
- Implemented a mock **CKBFS service layer** to simulate:
  - Fetching blog metadata
  - Retrieving full blog content using CIDs
- Demonstrated how decentralized, content-addressed storage integrates with frontend UI.
- Ensured the app is **CKBFS-ready** for future real integration.

---

### Next Steps (Week 13)

- **Module 4: Real CKBFS Integration**
  - Replace mock CKBFS service with actual CKBFS upload & fetch logic.
  - Store blog content and metadata on CKBFS.
- **Module 5: Backend Scripts**
  - Implement real `uploadContent.js` and `uploadMetadata.js`.
  - Handle CID generation and metadata indexing.
- **Module 6: Enhancements**
  - Improve Markdown rendering.
  - Add better loading states and error handling.
  - Prepare for wallet-based author identity in future iterations.
