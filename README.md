# Bucks Global

## Overview
Bucks Global is an innovative social platform built on the IPFS (InterPlanetary File System) protocol, enabling decentralized and resilient data storage and sharing. This README provides comprehensive documentation of the platform's architecture, features, setup instructions, and technical specifications.

Quick start: see `LAUNCH.md`.

## Table of Contents
- [Architecture](#architecture)
- [Features](#features)
- [Setup Instructions](#setup-instructions)
- [Technical Specifications](#technical-specifications)
- [Contributions](#contributions)
- [License](#license)

## Architecture
Bucks Global utilizes a microservices architecture with the following components:
- **Frontend**: React-based user interface for a responsive and dynamic user experience.
- **Backend**: Node.js services managing user authentication, data retrieval, and interaction with IPFS.
- **IPFS Nodes**: Responsible for storing and serving user-generated content and application data.

The platform leverages a combination of REST APIs and WebSockets for real-time communication.

### Diagram
![Architecture Diagram](https://example.com/architecture-diagram-url)

## Features
- **Decentralized Storage**: All user data and files are stored on IPFS, making it resistant to censorship and data loss.
- **User Authentication**: Support for both traditional and decentralized authentication methods.
- **Social Networking**: Users can connect, share, and collaborate in a secure and decentralized manner.
- **Content Sharing**: Easily share articles, images, and videos via IPFS links.

## Setup Instructions
To set up the Bucks Global environment locally, follow these steps:

### Prerequisites
- Node.js (v18+ recommended)
- Python (v3.10+ recommended)
- IPFS daemon running locally (or reachable via API)

### Steps
1. **Clone the Repository**:
   ```
   git clone https://github.com/infin8sync69-source/Bucks-global.git
   cd Bucks-global
   ```
2. **Start IPFS**:
   ```
   ipfs daemon
   ```
3. **Start the Backend (FastAPI)**:
   ```
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
4. **Start the Frontend (Next.js)**:
   ```
   cd ../frontend
   npm install
   npm run dev
   ```
5. **Access the Platform**: Open `http://localhost:3000`.

### Hybrid Mode (Supabase)
If you want managed Postgres persistence for production, set `DATABASE_URL` (Supabase connection string) for the backend and apply the schema under `supabase/migrations/`.

## Technical Specifications
- **Frontend**: Next.js
- **Backend**: FastAPI
- **Storage**: IPFS (content), optional Supabase/Postgres (metadata)
- **Deployment**: Vercel/Render/VPS + Supabase (optional)
- **API**: RESTful API endpoints for interaction with the backend services.

## Contributions
We welcome contributions! Please submit a pull request or open an issue to discuss improvements.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
This README will be updated regularly as the project evolves.
