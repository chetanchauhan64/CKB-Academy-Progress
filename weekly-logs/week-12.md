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
    <td align="center">
      <img src="../assets/ckbfs-blog/week-12-blog-list.png" alt="Blog Listing UI" width="100%" />
      <p>1. Blog Listing Page</p>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="../assets/ckbfs-blog/week-12-publish-form.png" alt="Publish Form UI" width="100%" />
      <p>2. Publish to CKBFS Form</p>
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

### Module 4: Local Testing & Validation
- Successfully ran the full application locally using Vite.
- Verified:
  - UI rendering
  - Navigation flow
  - Blog content loading
  - Publish form behavior
- Confirmed clean build with no runtime or console errors.

---

### Key Learnings
- Practical understanding of **CKBFS concepts (CID-based content addressing)**.
- Translating decentralized storage architecture into real frontend logic.
- Structuring scalable Web3 applications with clear separation of concerns.
- Building clean, user-friendly UI for decentralized applications.

---

### Next Steps (Week 13)

- **Module 5: Real CKBFS Integration**
  - Replace mock CKBFS service with actual CKBFS upload & fetch logic.
  - Store blog content and metadata on CKBFS.
- **Module 6: Backend Scripts**
  - Implement real `uploadContent.js` and `uploadMetadata.js`.
  - Handle CID generation and metadata indexing.
- **Module 7: Enhancements**
  - Improve Markdown rendering.
  - Add better loading states and error handling.
  - Prepare for wallet-based author identity in future iterations.

