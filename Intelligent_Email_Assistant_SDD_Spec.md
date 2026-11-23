# Intelligent Email Assistant — Complete Specification

## Project Overview

Build a full-stack AI-powered Gmail application called the **Intelligent Email Assistant** that lets a user connect their real Gmail account, manage their inbox from a custom dashboard, and use AI to summarize emails, draft replies, and (in Phase 2) search their inbox by meaning rather than exact keywords. The platform is built in two locked phases: **V1 (Core Product)** delivers a complete, independently deployable email management + AI assistant experience; **V2 (Semantic Search)** is added on top of V1's data model without requiring a rewrite of any existing system.

This spec deliberately excludes patterns that don't serve the locked scope — no multi-agent orchestration engine, no background job queue, no real-time event streaming, no third-party integrations beyond Gmail. Those add real engineering surface area without adding proportional value to this project's goals, and were explicitly cut to reduce implementation and demo risk.

## Tech Stack

**Frontend:** React (Vite), Tailwind CSS, Axios, React Router.

**Backend:** Node.js, Express, MongoDB, Mongoose, express-session with connect-mongo (session-based auth, not JWT — session state lives server-side, tied to the Google OAuth login flow), googleapis (Gmail API + OAuth), helmet, cors, dotenv.

**AI Integration:** Claude or GPT API (Node SDK) for summarization, reply generation, and structured extraction. In V2: an embeddings model/API plus MongoDB Atlas Vector Search.

**Integrations:** Gmail only, via OAuth 2.0. Access and refresh tokens are never exposed to the frontend and are excluded from default query projections.

---

## Authentication

The application uses **Google OAuth as the sole authentication method** — there is no separate email/password registration system, since the app's entire purpose requires a connected Gmail account. The flow is:

- `GET /api/auth/google` — redirects to Google's consent screen with the required Gmail scopes (`gmail.readonly`, `gmail.send`, `gmail.modify`, `userinfo.email`, `userinfo.profile`)
- `GET /api/auth/google/callback` — exchanges the authorization code for tokens, upserts the `User` document, and starts a server-side session
- `GET /api/auth/me` — returns the current authenticated user's profile (never tokens)
- `POST /api/auth/logout` — destroys the session

Sessions are stored in MongoDB via `connect-mongo`, cookies are `httpOnly`, and `secure: true` in production. There is no role separation (admin/operator) — this is a single-user-per-account personal tool, not a multi-tenant operations platform.

---

## V1 — Core Product

### Inbox & Email Management

- Fetch and display the user's inbox (paginated) from the Gmail API
- View a single email or full thread, with body rendered safely (sanitized HTML)
- Basic management actions, each mapped to the corresponding Gmail API modify call: mark read/unread, star/unstar, archive, delete
- Compose and send new emails
- All email data fetched from Gmail is persisted into MongoDB (see `Email` model below) so AI features can operate on stored content without re-fetching from Gmail on every request

### AI Summarization

- On opening an email or thread, the user can request an AI-generated summary
- The summary is generated from `bodyText`, cached on the `Email` document as `aiSummary` so it isn't regenerated on every view
- Long threads are summarized per-message and then combined, to stay within model context limits

### AI-Generated Replies

- The user can request an AI-drafted reply to an open email
- The draft is shown in an editable text area — never sent without explicit user action
- On send, the edited (or unedited) reply is sent via the Gmail API and the sent message is also persisted

---

## V2 — Semantic Search (Additive Only)

Semantic search is added strictly on top of the V1 data model:

- The existing `Email` schema already reserves an `embedding: [Number]` field (excluded from default queries via `select: false`) — no schema migration required
- A new `embeddingService.js` generates an embedding for each email's `bodyText` at fetch/sync time (batch, not per-search-request, to keep search latency low and predictable)
- A MongoDB Atlas Vector Search index is created on the `embedding` field (available on the free M0 tier, capped at 512MB storage / 100 ops-per-second — sufficient for a demo mailbox, a known and accepted constraint)
- One new route, `GET /api/search/semantic?q=...`, embeds the query and returns the nearest emails by vector similarity
- No existing V1 route, controller, or model field changes shape to support this — it is purely additive, which was the explicit design goal from Milestone 1 onward

Action item / deadline extraction and inbox priority ranking were considered for V2 and deliberately deferred/cut from this spec (see project history) to keep the reliability surface small and the demo predictable; they are not part of this locked scope.

---

## Frontend Pages

- **`/login`** — single "Connect Gmail" button, initiates the OAuth flow. No password form.
- **`/dashboard`** — inbox list view: sender, subject, snippet, read/starred state, pagination
- **`/thread/:threadId`** — full thread view, AI Summarize button, AI Reply Draft panel with edit-before-send, management actions (star, archive, delete, mark read/unread)
- **`/compose`** — new email composition and send
- **`/search`** *(V2 only)* — semantic search bar, results list rendered the same as the dashboard list

---

## Backend Architecture

- **Routes** — HTTP routing and request validation only
- **Controllers** — request parsing and response shaping; never talk directly to MongoDB
- **Services** — business logic ownership: `googleAuthService.js` (OAuth token exchange/refresh), `gmailService.js` (Gmail API calls), `aiService.js` (summarization/reply generation), `embeddingService.js` (V2 only)
- **Models** — `User`, `Email`
- **Middleware** — `requireAuth.js` (session check)
- **Config** — centralizes env vars and the MongoDB connection

### Database Collections

**Users** — `googleId`, `email`, `name`, `picture`, `googleTokens` (`accessToken`, `refreshToken`, `expiryDate` — excluded from any serialized response via a custom `toJSON`)

**Emails** — `user` (ref), `messageId`, `threadId`, `sender`, `recipients`, `subject`, `bodyText`, `bodyHtml`, `snippet`, `labels`, `isRead`, `isStarred`, `isArchived`, `receivedAt`, `aiSummary`, `embedding` (V2, `select: false` until used)

---

## API Endpoints

**Auth**
- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `GET /api/auth/me`
- `POST /api/auth/logout`

**Inbox & Email Management**
- `GET /api/emails` — list inbox (paginated)
- `GET /api/emails/:threadId` — fetch a thread
- `PATCH /api/emails/:id` — update read/starred/archived state
- `DELETE /api/emails/:id` — delete
- `POST /api/emails/send` — compose and send

**AI**
- `POST /api/ai/summarize/:emailId`
- `POST /api/ai/draft-reply/:emailId`

**Search (V2 only)**
- `GET /api/search/semantic?q=...`

**Health**
- `GET /api/health`

---

## Folder Structure

```
email-assistant/
├── backend/
│   └── src/
│       ├── config/          (env.js, db.js)
│       ├── models/          (User.js, Email.js)
│       ├── services/        (googleAuthService.js, gmailService.js, aiService.js, embeddingService.js*)
│       ├── controllers/     (authController.js, emailController.js, aiController.js, searchController.js*)
│       ├── routes/          (authRoutes.js, emailRoutes.js, aiRoutes.js, searchRoutes.js*)
│       ├── middleware/      (requireAuth.js)
│       ├── app.js
│       └── server.js
└── frontend/
    └── src/
        ├── pages/            (Login, Dashboard, Thread, Compose, Search*)
        ├── components/       (EmailList, EmailDetail, ReplyDraftPanel, SearchBar*)
        ├── services/         (api.js)
        └── store/            (authContext or a lightweight state store)
```
*(files marked `*` are added in V2, not V1)*

---

## Development Phases

**Phase 1** — Project setup: Express + MongoDB connection, Google OAuth flow, session handling, `User` model. *(Completed as Milestone 1.)*

**Phase 2** — Gmail API integration: fetch and persist inbox emails, `Email` model, dashboard list view.

**Phase 3** — Thread view, management actions (read/unread, star, archive, delete), compose and send.

**Phase 4** — AI summarization and AI reply drafting, with edit-before-send.

**Phase 5** — Deployment (frontend → Vercel, backend → Render/Railway, DB → MongoDB Atlas) and a deliberate bug-breaking pass across every flow. **V1 is considered complete and independently demoable at the end of this phase.**

**Phase 6 (V2)** — Embedding pipeline, Atlas Vector Search index, semantic search route and UI — added strictly on top of the Phase 1–5 codebase.

---

## UI & Security Requirements

**UI:** Clean, uncluttered inbox aesthetic with Tailwind; loading states for AI actions (summarization/reply generation are not instant); the AI reply draft is always shown as editable text, never auto-sent; management actions give immediate optimistic UI feedback.

**Security:** OAuth tokens encrypted/excluded from all client-facing responses; `httpOnly` + `secure` session cookies; `helmet` for HTTP headers; `cors` restricted to the frontend origin; every request body validated; no secrets committed to source control (`.env` gitignored from the first commit); expired/invalid Gmail tokens surfaced as a clear re-auth prompt, not a silent failure or generic 500.

## Final Expected Outcome

A user can connect their real Gmail account, browse and manage their inbox from a custom dashboard, get AI-generated summaries and editable reply drafts for any email or thread, and — once V2 lands — search their entire inbox by meaning instead of exact keywords, all backed by a Gmail-synced MongoDB store and a data model designed from Milestone 1 to support that final step without a rewrite.

## Implementation Instructions

Build phase by phase, in the order listed above. Keep controllers thin — all logic in services. Never call MongoDB directly from a controller. Never call the Gmail API directly from a controller — always through `gmailService.js`. Treat every secret as `process.env`, validated at startup (missing required env vars should fail fast, not fail silently at first use). Do not implement V2 fields or routes until V1's Phase 5 is confirmed working end-to-end. Do not add features outside this spec (no calendar integration, no multi-account support, no priority ranking, no third-party integrations beyond Gmail) — this scope is locked.
