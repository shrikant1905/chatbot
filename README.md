# Kiaan AI — Complete Local Full-Stack Architecture

Full-stack AI developer workspace integrating a React + Vite frontend with an Express + Node.js backend and MySQL (MariaDB) database persistence.

---

## Architecture Overview

```
kiaan-ai/
├── backend/                       # Node.js + Express API Server
│   ├── src/
│   │   ├── config/                # Environment configuration loader
│   │   ├── controllers/           # HTTP Request controllers
│   │   ├── db/
│   │   │   ├── migrations/        # SQL migration files
│   │   │   ├── migrate.js         # Migration runner
│   │   │   └── pool.js            # MySQL connection pool
│   │   ├── middleware/            # Multer upload, auth, and error handlers
│   │   ├── routes/                # Express API router (/api/...)
│   │   ├── services/
│   │   │   ├── ai/                # AI Provider Abstraction (Ollama, Gemini, OpenAI)
│   │   │   ├── attachmentService.js
│   │   │   ├── conversationService.js
│   │   │   ├── feedbackService.js
│   │   │   ├── memoryService.js
│   │   │   ├── messageService.js
│   │   │   └── searchService.js
│   │   ├── tests/                 # Automated test suite (13 integration tests)
│   │   ├── app.js                 # Express application definition
│   │   └── index.js               # Server entry point
│   ├── uploads/                   # Local storage for attachments
│   ├── .env                       # Backend environment variables
│   └── package.json
│
├── frontend/                      # React + Vite Frontend
│   ├── src/
│   │   ├── api/                   # Centralized API client (client.js)
│   │   ├── components/            # Header, Composer, Message, Sidebar, Modals
│   │   ├── hooks/                 # Theme hook
│   │   ├── pages/                 # ChatPage main page
│   │   └── styles/                # CSS variable tokens & layout
│   ├── .env                       # Frontend environment variables
│   └── package.json
│
└── package.json                   # Workspace root script runner
```

---

## 1. Prerequisites (Windows)

- **Node.js**: v18.0.0+ (Tested on Node.js v22.19.0)
- **MySQL / MariaDB**: Port 3306 (e.g. XAMPP MySQL or standalone MySQL)

---

## 2. Environment Variables

### Backend (`backend/.env`):
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# MySQL Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=kiaan_ai
DB_CONNECTION_LIMIT=10

# AI Provider Configuration
# Options: ollama, openai, gemini, mock_test
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_DEFAULT_MODEL=llama3:latest

# Alternative Providers (optional)
GEMINI_API_KEY=
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1

# Storage
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=25
```

### Frontend (`frontend/.env`):
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 3. Database Setup & Migrations

1. Ensure MySQL is running on port 3306.
2. Create databases:
   ```sql
   CREATE DATABASE IF NOT EXISTS kiaan_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE DATABASE IF NOT EXISTS kiaan_ai_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Run versioned migrations:
   ```powershell
   npm run migrate
   ```

---

## 4. Running the Application (Local Development)

### Run Backend:
```powershell
# From root
npm run dev:backend

# Or directly in backend folder
cd backend
npm run dev
```
Backend will start on: `http://localhost:5000`  
Health check URL: `http://localhost:5000/api/health`

### Run Frontend:
```powershell
# In another terminal from root
npm run dev:frontend

# Or directly in frontend folder
cd frontend
npm run dev
```
Frontend will open on: `http://localhost:5173`

---

## 5. Running Automated Backend Tests

The test suite runs against the isolated `kiaan_ai_test` database so user data is never modified.

```powershell
npm run test:backend
```

All 13 integration tests verify:
- Backend startup and `/api/health`
- Models availability
- Conversation CRUD, rename validation, cascade deletion
- Message persistence and bounded context window
- Attachment validation and rejection of dangerous executables (.exe, .bat, etc.)
- Multi-user attachment access isolation
- Search and search history persistence
- Conversational memory and sensitive credential protection guardrails
- AI provider offline error normalization without fake answers

---

## 6. How to Configure a Genuine AI Provider Later

### Option A: Local or VPS Ollama (Recommended)
1. Install Ollama: https://ollama.ai/
2. Start Ollama:
   ```bash
   ollama serve
   ```
3. Pull desired model:
   ```bash
   ollama pull llama3:latest
   ```
4. In `backend/.env`, set:
   ```env
   AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_DEFAULT_MODEL=llama3:latest
   ```
   *(For future VPS Ollama, simply point `OLLAMA_BASE_URL` to your VPS IP/domain).*

### Option B: Google Gemini
1. Get an API key from Google AI Studio.
2. In `backend/.env`:
   ```env
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

### Option C: OpenAI / OpenAI-Compatible (Groq, vLLM, OpenRouter)
1. In `backend/.env`:
   ```env
   AI_PROVIDER=openai
   OPENAI_API_KEY=your_api_key_here
   OPENAI_BASE_URL=https://api.openai.com/v1
   ```

---

## 7. Known Behaviors When AI Provider Is Offline

When no local or VPS Ollama instance is currently running:
- The system correctly transparently reports provider offline status via `/api/health` and the UI model status dot.
- User messages, conversations, and attachments are reliably saved in the database.
- A genuine, actionable error notification is displayed to the user explaining that Ollama is unreachable at the configured URL.
- **Strict Guardrail**: Under no circumstance does the backend fabricate fake or mock AI responses. Real model output appears as soon as Ollama or an API key is connected.

