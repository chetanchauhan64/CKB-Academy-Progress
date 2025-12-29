CKBFS Integration Plan

This directory documents the approach for integrating CKBFS into the decentralized blog platform.

Storage Strategy
- Blog content (markdown files) will be uploaded to CKBFS
- Blog metadata (JSON files) will also be uploaded to CKBFS
- Each upload returns a CID (content identifier)

Planned Flow
1. Upload blog post content to CKBFS
2. Upload metadata JSON to CKBFS
3. Store both CIDs for retrieval
4. Frontend will fetch content using CKBFS gateways

Initial implementation focuses on manual upload and verification.
Automation will be added in later stages.
