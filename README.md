# Intelligent Email Assistant

A full-stack, AI-powered Gmail client that allows you to connect your personal Gmail account, manage your inbox from a custom modern dashboard, generate executive AI summaries of long email threads, and draft context-aware replies with edit-before-send control.

Built strictly in accordance with [Intelligent_Email_Assistant_SDD_Spec.md](./Intelligent_Email_Assistant_SDD_Spec.md).

---

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Google Cloud OAuth Setup](#google-cloud-oauth-setup)
- [Environment Configuration](#environment-configuration)
- [Local Setup & Running](#local-setup--running)
- [Application Flow & Features](#application-flow--features)
- [API Reference](#api-reference)
- [Security & Token Isolation](#security--token-isolation)

---

## Architecture Overview

The system strictly follows a layered service-oriented architecture:
```
Routes (HTTP routing & validation only)
   ↓
Controllers (Thin request parsers & response shapers)
   ↓
Services (Business logic, Gmail API, AI integration, OAuth)
   ↓
Models (Mongoose schemas & token-isolated methods)
   ↓
MongoDB (Database & session store)
```

### Folder Structure
```
AI-Automation/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js               # Environment variables validation & config
│   │   │   └── db.js                # Mongoose database connection
│   │   ├── models/
│   │   │   ├── User.js              # User schema with token isolation
│   │   │   └── Email.js             # Synced email schema with labels, aiSummary & reserved embedding
│   │   ├── services/
│   │   │   ├── googleAuthService.js # OAuth2 client, auth URL, callback exchange & auto-refresh
│   │   │   ├── gmailService.js      # Gmail API sync, thread parsing, label modify, trash, send
│   │   │   └── aiService.js         # AI Summarization with MongoDB caching & reply drafting
│   │   ├── controllers/
│   │   │   ├── authController.js    # Thin auth controller
│   │   │   ├── emailController.js   # Thin email management controller
│   │   │   └── aiController.js      # Thin AI controller
│   │   ├── routes/
│   │   │   ├── authRoutes.js        # /api/auth/*
│   │   │   ├── emailRoutes.js       # /api/emails/*
│   │   │   └── aiRoutes.js          # /api/ai/*
│   │   ├── middleware/
│   │   │   ├── requireAuth.js       # Session authentication check
│   │   │   └── errorHandler.js      # Centralized error & Google token expiry handler
│   │   ├── app.js                   # Express app setup with Helmet, CORS, and connect-mongo
│   │   └── server.js                # Server entry point
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx           # Top navigation with Gmail sync button & user profile
│   │   │   ├── Sidebar.jsx          # Folder navigation (Inbox, Starred, Sent, Trash, Compose)
│   │   │   ├── EmailList.jsx        # Paginated email list view
│   │   │   ├── EmailItem.jsx        # Email preview row with quick actions
│   │   │   ├── EmailDetail.jsx      # Message card with sanitized HTML rendering
│   │   │   ├── AISummaryCard.jsx    # AI summary badge, loading skeleton & cached card
│   │   │   ├── ReplyDraftPanel.jsx  # Context-aware AI reply panel with edit-before-send
│   │   │   └── LoadingSkeleton.jsx  # Shimmer loading placeholders
│   │   ├── pages/
│   │   │   ├── Login.jsx            # Single 'Connect Gmail' OAuth button page
│   │   │   ├── Dashboard.jsx        # Inbox list view with pagination & filters
│   │   │   ├── Thread.jsx           # Thread view with AI Summarize & AI Reply
│   │   │   └── Compose.jsx          # Simple compose: Recipient, Subject, Message, Send
│   │   ├── services/
│   │   │   └── api.js               # Axios instance with credentials: true & re-auth interceptor
│   │   ├── store/
│   │   │   └── AuthContext.jsx      # Authentication state store
│   │   ├── App.jsx                  # React Router configuration
│   │   ├── main.jsx                 # React root
│   │   └── index.css                # Tailwind CSS styling
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── .env.example
│   └── package.json
├── Intelligent_Email_Assistant_SDD_Spec.md # Single Source of Truth
├── README.md
└── package.json
```

---

## Tech Stack

- **Frontend:** React 18 (Vite), Tailwind CSS, Axios, React Router DOM, Lucide Icons, DOMPurify.
- **Backend:** Node.js (ES Modules), Express 4, MongoDB (Mongoose 8), `express-session` with `connect-mongo`, `googleapis` (Gmail API + OAuth 2.0), `helmet`, `cors`, `dotenv`.
- **AI Integration:** OpenAI API (`gpt-4o-mini` default) / Anthropic Claude API (`claude-3-5-sonnet`) for thread summarization and context-aware reply drafting.

---

## Prerequisites

Ensure you have the following installed on your development machine:
1. **Node.js**: `v18.0.0` or higher (tested on Node v24).
2. **MongoDB**: A running local MongoDB instance (`mongodb://localhost:27017`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) connection string.
3. **Google Cloud Account**: To create OAuth 2.0 Client ID and enable the Gmail API.
4. **AI API Key**: An [OpenAI API Key](https://platform.openai.com) or [Anthropic API Key](https://console.anthropic.com).

---

## Google Cloud OAuth Setup

To enable your app to connect to real Gmail accounts, configure a project in Google Cloud Console:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. **Create a New Project** (e.g. `Intelligent Email Assistant`).
3. **Enable APIs**:
   - Go to **APIs & Services > Library**.
   - Search for **Gmail API** and click **Enable**.
   - Search for **Google People API** (or Google+ API) and click **Enable**.
4. **Configure OAuth Consent Screen**:
   - Go to **APIs & Services > OAuth consent screen**.
   - Select User Type: **External** and click **Create**.
   - Enter App Name (`Intelligent Email Assistant`), User support email, and Developer contact information.
   - Under **Scopes**, click **Add or Remove Scopes** and add:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
   - Under **Test users**, click **Add Users** and add your personal Gmail address (e.g. `yourname@gmail.com`).
5. **Create OAuth 2.0 Credentials**:
   - Go to **APIs & Services > Credentials**.
   - Click **Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Email Assistant Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
   - **Authorized redirect URIs**:
     - `http://localhost:5000/api/auth/google/callback`
   - Click **Create**.
6. Copy the generated **Client ID** and **Client Secret**.

---

## Environment Configuration

### 1. Backend Configuration
Create a `.env` file inside the `backend/` directory (you can copy from `backend/.env.example`):

```bash
# In backend/.env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# MongoDB Connection String
MONGODB_URI=mongodb://127.0.0.1:27017/intelligent_email_assistant

# Session Secret (random 32+ character string)
SESSION_SECRET=dev_secret_session_key_replace_with_random_string_in_production

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# AI Provider Configuration (openai or anthropic)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-api-key
AI_MODEL=gpt-4o-mini
```

### 2. Frontend Configuration
Create a `.env` file inside the `frontend/` directory (you can copy from `frontend/.env.example`):

```bash
# In frontend/.env
VITE_API_URL=http://localhost:5000/api
```

---

## Local Setup & Running

### Option A: Using Root Helper Commands
From the project root directory (`AI-Automation/`):

1. **Install all dependencies:**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   cd ..
   ```

2. **Start Backend Server:**
   ```bash
   npm run dev:backend
   ```
   *Backend starts on `http://localhost:5000`.*

3. **In a separate terminal, start Frontend:**
   ```bash
   npm run dev:frontend
   ```
   *Frontend starts on `http://localhost:5173`.*

4. **Open your browser and navigate to:**
   ```
   http://localhost:5173
   ```

---

### Option B: Running Manually

1. **Start Backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

---

## Application Flow & Features

### 1. Connect Gmail Account (`/login`)
- Navigate to `http://localhost:5173/login`.
- Click the single **"Connect Gmail Account"** button.
- You will be redirected to Google's consent screen. Sign in with your Google account (ensure the email is in your Google Cloud Test Users list).
- Once granted, Google redirects back to `/api/auth/google/callback`, which starts a secure session in MongoDB and redirects to `/dashboard`.

### 2. Inbox Dashboard (`/dashboard`)
- View all your emails synced from Gmail.
- Click **"Sync Gmail"** in the top bar to fetch the latest messages via the Gmail API.
- Filter by folder: **Inbox**, **Starred**, **Sent**, **Trash**.
- Quick search / filter by sender or subject.
- Star/Unstar, Mark Read/Unread, Archive, and Delete with immediate optimistic UI feedback.

### 3. Thread View (`/thread/:threadId`)
- Click any email to open the full conversational thread.
- Email bodies are safely rendered with HTML sanitization via DOMPurify.
- **AI Thread Summary:**
  - Click **"Summarize Thread"**.
  - The AI reads and synthesizes the thread history into an executive structured summary.
  - The summary is cached directly on the `Email` document in MongoDB as `aiSummary` to prevent unnecessary regeneration on repeat views.
- **AI Reply Drafting (Edit-Before-Send):**
  - Click **"Draft AI Reply"**.
  - Generates a context-aware reply draft based on the thread conversation.
  - Loaded into an editable text area.
  - Review or make custom edits, then click **"Send Reply"** to send directly through the Gmail API.

### 4. Compose & Send (`/compose`)
- Click **"Compose"** in the sidebar.
- Enter Recipient (`To`), `Subject`, and `Message body`.
- Click **"Send Email"** to dispatch via RFC 2822 base64url encoding through `gmail.users.messages.send`.
- Sent emails are automatically persisted to your MongoDB database with the `SENT` label.

---

## API Reference

### Auth Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/google` | Initiates Google OAuth 2.0 consent flow |
| `GET` | `/api/auth/google/callback` | Exchanges authorization code for tokens, upserts user, starts session |
| `GET` | `/api/auth/me` | Returns current authenticated user profile (tokens excluded) |
| `POST` | `/api/auth/logout` | Destroys server-side session and clears cookie |

### Email Management Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/emails` | Paginated list of emails (`?page=1&limit=20&folder=INBOX&search=`) |
| `POST` | `/api/emails/sync` | Triggers fetch & upsert of emails from Gmail API |
| `GET` | `/api/emails/:threadId` | Fetches all messages in a thread sorted chronologically |
| `PATCH` | `/api/emails/:id` | Modifies read/starred/archived state (syncs with Gmail API labels) |
| `DELETE` | `/api/emails/:id` | Trashes email via Gmail API and updates MongoDB |
| `POST` | `/api/emails/send` | Composes and sends RFC 2822 email via Gmail API |

### AI Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ai/summarize/:emailId` | Generates & caches executive summary of email or thread |
| `POST` | `/api/ai/draft-reply/:emailId` | Generates context-aware reply draft (single draft, editable) |

### Health Check
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check endpoint returning service status and timestamp |

---

## Security & Token Isolation

1. **Session-Based Authentication:** Tokens are strictly stored server-side in MongoDB via `connect-mongo`. No JWT or OAuth tokens are exposed to client JavaScript.
2. **Custom `toJSON` Sanitization:** The `User` Mongoose model excludes `googleTokens` (`accessToken`, `refreshToken`, `expiryDate`) from any serialization.
3. **Session Cookies:** Configured with `httpOnly: true`, `sameSite`, and `secure: true` in production environments.
4. **Token Expiration Handling:** When Google OAuth tokens expire or are revoked, the backend intercepts the error and returns a clean `{ error: 'GoogleAuthExpired', requiresReauth: true }` (HTTP 401) prompt instead of a silent failure or 500 error.
5. **HTML Sanitization:** All email HTML payloads are sanitized client-side with `DOMPurify` before rendering to prevent XSS.
