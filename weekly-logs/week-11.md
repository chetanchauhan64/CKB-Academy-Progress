## Week 11

**Date:** 12th – 19th December, 2025

### Tasks Completed
- Finalized the project idea: a decentralized WordPress-style blog publishing platform using CKBFS.
- Opened the CKB Builder Academy repository in VS Code and created a new project directory at the repository root:
  
  ```bash
  mkdir ckbfs-decentralized-blog
  cd ckbfs-decentralized-blog

 - Verified the development environment inside VS Code:
   
 ```bash
node -v
npm -v
 ```
- Initialized the project configuration using Node.js:

 ```bash
npm init -y
```
- Created the base project structure required for development:

 ```bash
mkdir contracts frontend scripts assets
 ```
- Verified the folder structure and ensured the project directory is cleanly separated from existing tutorial dApps.

### Next Steps

- Upload a sample blog post to CKBFS and generate a content identifier (CID).
- Implement basic content retrieval from CKBFS using the generated CID.
- Define metadata structure for blog posts (title, author, CID, timestamp).
- Start documenting the storage and retrieval flow for the decentralized blog platform.
