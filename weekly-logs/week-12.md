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

<table style="width:100%; text-align:center;">
  <tr>
    <td style="width:33.3%; vertical-align:top; text-align:center;">
      <img
        width="1470"
        height="919"
        alt="Blog Listing Page"
        src="https://github.com/user-attachments/assets/a626c66b-3773-47f8-a74d-6ea52343a706"
      />
      <p style="text-align:center;">1. Blog Listing Page</p>
    </td>
    <td style="width:33.3%; vertical-align:top; text-align:center;">
      <img
        width="1470"
        height="919"
        alt="Publish to CKBFS Form"
        src="https://github.com/user-attachments/assets/49914366-fb73-4d06-bdf5-d89d764d2f6d"
      />
      <p style="text-align:center;">2. Publish to CKBFS Form</p>
    </td>
    <td style="width:33.3%; vertical-align:top; text-align:center;">
      <img
        width="1470"
        height="919"
        alt="Local Testing"
        src="https://github.com/user-attachments/assets/282c055f-07f1-479f-a51f-98b5f067fd1b"
      />
      <p style="text-align:center;">3. Local Testing</p>
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
