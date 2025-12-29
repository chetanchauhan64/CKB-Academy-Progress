# Architecture Documentation

## System Overview
```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│                      (React Frontend)                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ├──── View Posts
                        ├──── Create Post
                        └──── Upload Media
                        │
┌───────────────────────┴─────────────────────────────────────┐
│                    Service Layer (JS)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ ckbfsService│  │ metadataAPI │  │  storageAPI  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────────┐
│                   CKBFS Storage Layer                        │
│  ┌────────────────────────────────────────────────┐         │
│  │  Content Cells (Immutable Blog Posts)          │         │
│  │  CID: bafkrei...                                │         │
│  └────────────────────────────────────────────────┘         │
│  ┌────────────────────────────────────────────────┐         │
│  │  Metadata Cell (Searchable Index)              │         │
│  │  CID: bafybei...                                │         │
│  └────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

## Data Models

### Post Metadata
```json
{
  "id": "string",
  "cid": "string (CKBFS Content ID)",
  "title": "string",
  "author": "string",
  "timestamp": "ISO 8601 string",
  "excerpt": "string",
  "tags": ["string"]
}
```

### Content Storage
- **Format**: Markdown
- **Storage**: CKBFS Cell
- **Retrieval**: By CID

## Security Considerations

1. **Content Immutability**: Once uploaded, content cannot be modified
2. **Access Control**: Future: Implement wallet-based authentication
3. **Data Privacy**: Public by default (consider encryption for private posts)