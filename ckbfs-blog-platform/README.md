# CKBFS Decentralized Blog Platform

A production-ready, internship-level decentralized blog publishing platform built using **Nervos CKB** and **CKBFS (CKB File System)**.

> This project demonstrates how decentralized storage can be used to build a censorship-resistant, immutable blogging platform similar to WordPress.

---

## Table of Contents

- Overview  
- Why CKBFS?  
- Architecture  
- Tech Stack  
- Project Structure  
- Getting Started  
- How It Works  
- Scripts Documentation  
- Future Improvements  

---

## Overview

The **CKBFS Decentralized Blog Platform** is a Web3 blogging application where blog posts, metadata, and media are designed to be stored immutably on **CKBFS**, leveraging the **Nervos CKB Cell Model**.

The goal of this project is to demonstrate:
- Real-world usage of decentralized file systems
- Clean frontend architecture for Web3 apps
- A scalable foundation for future blockchain integrations

---

## Why CKBFS?

### Problems with Traditional Blogging Platforms

| Traditional Platforms | CKBFS Solution |
|----------------------|---------------|
| ❌ Centralized servers | ✅ Distributed network |
| ❌ Content can be censored | ✅ Censorship-resistant |
| ❌ Platform lock-in | ✅ True data ownership |
| ❌ Data can be deleted | ✅ Permanent storage |

### CKBFS Advantages

- **Immutability** – Once stored, content cannot be altered  
- **Verifiability** – Cryptographic proofs ensure data integrity  
- **Availability** – Content remains accessible via CID  
- **Ownership** – Users control their data, not platforms  

---

## Architecture

The platform is divided into three major layers:

1. **Frontend (React + Tailwind)**  
   - Displays blog list, details, and publish UI  
   - Fetches content using CIDs  

2. **Scripts Layer (Node.js)**  
   - Uploads content and metadata to CKBFS  
   - Fetches stored data  

3. **Storage Layer (CKBFS + Nervos CKB)**  
   - Stores blog content as immutable cells  

For more details, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Tech Stack

### Frontend
- **React 18**
- **Vite**
- **Tailwind CSS**
- **Lucide React (Icons)**

### Backend / Scripts
- **Node.js**
- **CKBFS SDK** (to be integrated)
- **CKB SDK**

### Blockchain
- **Nervos CKB**
- **CKB File System (CKBFS)**

---


