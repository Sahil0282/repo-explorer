# Top 15 High-Leverage Improvements — Impact × Effort Matrix

> **Goal:** Transform Repo Explorer from functional prototype to portfolio piece that makes hiring managers pause and explore.
> **Philosophy:** A portfolio project is judged in 30 seconds. The first 10 seconds are visual impact. The next 10 are "does it actually work?" The last 10 are code quality. We optimize for all three.

---

## The Matrix

Each improvement is scored on **Impact (1–10)** averaged across four axes, and **Effort** in engineering hours. The **Leverage Score** = Impact ÷ Effort — higher means more bang per hour invested.

```
                        IMPACT
             Low (1-4)          High (7-10)
           ┌─────────────────┬─────────────────────┐
    Low    │                 │  🏆 QUICK WINS       │
  (1-3h)   │   (empty —      │                     │
           │    we excluded   │  #2  Syntax Highlighting
           │    low-value     │  #5  Survive Refresh │
  EFFORT   │    items)        │  #6  API Client Layer│
           │                 │  #8  Kill Dead Infra │
           │                 │  #10 Error Boundary  │
           ├─────────────────┼─────────────────────┤
   High    │                 │  🚀 STRATEGIC BETS   │
  (4-10h)  │                 │                     │
           │                 │  #1  Real Focus Map  │
           │                 │  #3  Streaming AI    │
           │                 │  #4  Async Pipeline  │
           │                 │  #7  BM25 Cache      │
           │                 │  #9  Responsive Chat │
           │                 │  #11 Chat Persistence│
           │                 │  #12 README + Demo   │
           │                 │  #13 Docker Compose  │
           │                 │  #14 Security Layer  │
           │                 │  #15 Code Blocks     │
           └─────────────────┴─────────────────────┘
```

> [!NOTE]
> Every item on this list is high-impact. The "Quick Wins vs Strategic Bets" distinction is purely about effort. There are no low-value items here — those were already excluded per your request.

---

## Ranked Improvements

### 🥇 #1 — Real Focus Map with React Flow
| Axis | Score | Why |
|---|---|---|
| UX | **10** | This is the visual centerpiece. It's literally the product name. |
| Performance | 5 | Neutral — React Flow handles virtualization internally |
| Maintainability | 6 | Replaces ad-hoc list with a proper graph abstraction |
| Scalability | 7 | React Flow handles 1000+ nodes with viewport culling |
| **Avg Impact** | **7.0** | **Effort: 8h** · Leverage: 0.88 |

**Why #1 despite lower leverage ratio:** This is the single feature a portfolio reviewer will remember. The landing page promises *"Visual map of exactly which functions answer your question"* — the current implementation is a bulleted list. This is a credibility gap.

**Before:** Flat card list grouped by file → **After:** Interactive node graph — file nodes contain function nodes, edges show call relationships, zoom/pan, click-to-inspect. The AI response highlights relevant nodes in indigo.

**Key files:**
- [FocusMap.jsx](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/components/FocusMap.jsx) — complete rewrite using `@xyflow/react` (already installed, never imported)
- [ChatPage.jsx](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/pages/ChatPage.jsx) — wire up node highlighting on AI response

---

### 🥈 #2 — Syntax Highlighting Everywhere
| Axis | Score | Why |
|---|---|---|
| UX | **10** | A code tool without syntax highlighting is like a text editor without fonts |
| Performance | 5 | Shiki is WASM-based, fast enough for single files |
| Maintainability | 7 | Centralizes code rendering into one reusable component |
| Scalability | 5 | No impact |
| **Avg Impact** | **6.8** | **Effort: 3h** · Leverage: 2.25 |

**Before:** Raw monochrome text in a `<table>` → **After:** Language-detected, theme-matched highlighted code in FileViewer, FocusMap tooltips, and ChatMessage code blocks. Use the same dark theme (e.g., `github-dark`) consistently.

**Key files:**
- [FileViewer.jsx](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/components/FileViewer.jsx) — replace raw `<table>` with highlighted renderer
- [FocusMap.jsx](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/components/FocusMap.jsx) — same for hover tooltips
- [ChatMessage.jsx](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/components/ChatMessage.jsx) — handle fenced code blocks from markdown

---

### 🥉 #3 — Streaming AI Responses (SSE)
| Axis | Score | Why |
|---|---|---|
| UX | **10** | The "ChatGPT effect" — text appearing word-by-word feels alive and fast |
| Performance | 8 | Perceived latency drops from 5-15s (full wait) to ~200ms (first token) |
| Maintainability | 5 | Adds SSE complexity but it's a well-understood pattern |
| Scalability | 6 | Reduces memory — no need to buffer full response server-side |
| **Avg Impact** | **7.3** | **Effort: 5h** · Leverage: 1.45 |

**Before:** User stares at bouncing dots for 5-15 seconds, then full answer appears → **After:** Text streams in token-by-token, "View in Focus Map" button appears when stream completes.

**Implementation path:**
- [main.py](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/service/main.py) `/query` → use Gemini's `generate_content(stream=True)` + FastAPI `StreamingResponse`
- [repoController.js](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/backend/controllers/repoController.js) `queryRepo` → pipe the SSE stream through to the client
- [ChatPage.jsx](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/pages/ChatPage.jsx) → `EventSource` or `fetch` with `ReadableStream`, append tokens to message state

---

### #4 — Async Analysis Pipeline with Real Progress
| Axis | Score | Why |
|---|---|---|
| UX | **9** | Fake progress spinners damage trust. Real progress builds it. |
| Performance | 8 | Unblocks the Express event loop for concurrent users |
| Maintainability | 7 | Forces clean separation of job management from HTTP handling |
| Scalability | 9 | Prerequisite for multi-user support — can't have 5-min blocking requests |
| **Avg Impact** | **8.3** | **Effort: 8h** · Leverage: 1.03 |

**Before:** Single HTTP request blocks for 60-300 seconds. Fake 5-step spinner. 5-minute timeout. → **After:** `POST /analyze` returns `{ jobId }` immediately. Client polls `GET /jobs/:id` or subscribes to SSE. Each real step (clone → parse → extract → embed → index) emits a progress event with percentage.

**Key changes:**
- [repoController.js](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/backend/controllers/repoController.js) — split `analyzeRepo` into a job queue (even a simple in-memory `Map<jobId, status>` works for MVP)
- [LandingPage.jsx](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/pages/LandingPage.jsx#L99-L123) — replace fake steps with real SSE-driven progress

---

### #5 — Survive Page Refresh (State Persistence)
| Axis | Score | Why |
|---|---|---|
| UX | **9** | Refreshing the page and losing everything is the #1 "this feels broken" moment |
| Performance | 3 | Marginal — reads from localStorage/sessionStorage |
| Maintainability | 6 | Forces a proper data layer |
| Scalability | 5 | Neutral |
| **Avg Impact** | **5.8** | **Effort: 3h** · Leverage: 1.92 |

**Before:** F5 on `/chat` → all state gone → redirect to `/` → re-analyze from scratch → **After:** Analysis results cached by `repoName` in `sessionStorage`. Chat messages persisted to `localStorage`. Page refresh restores full state instantly.

**Key files:**
- [ChatPage.jsx](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/pages/ChatPage.jsx#L13) — on mount, check storage before redirecting
- [LandingPage.jsx](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/pages/LandingPage.jsx#L22) — save to storage before navigating

---

### #6 — Centralized API Client + Environment Fix
| Axis | Score | Why |
|---|---|---|
| UX | 3 | Invisible to users |
| Performance | 2 | Neutral |
| Maintainability | **10** | 4 hardcoded URLs with a wrong port is a landmine |
| Scalability | 8 | Prerequisite for deployment to any non-localhost environment |
| **Avg Impact** | **5.8** | **Effort: 1.5h** · Leverage: 3.83 |

**Before:** `http://localhost:8000` hardcoded in 4 components. `.env` says port 5000. Neither is used. → **After:** Single `src/lib/api.js` module exports typed functions (`analyzeRepo()`, `queryRepo()`, `getFileContent()`). Base URL reads from `VITE_API_URL`. All components import from this module.

**Key files:** New `frontend/src/lib/api.js` + update all 4 consumer components + fix [.env](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/.env)

---

### #7 — BM25 Index Caching
| Axis | Score | Why |
|---|---|---|
| UX | 6 | Queries feel faster |
| Performance | **10** | Current: rebuild BM25 from scratch every query (fetch ALL docs, tokenize ALL, compute). Fixed: O(1) lookup. |
| Maintainability | 5 | Simple dict cache, easy to reason about |
| Scalability | 9 | Without this, query time grows linearly with corpus size |
| **Avg Impact** | **7.5** | **Effort: 3h** · Leverage: 2.50 |

**Before:** Every `/query` fetches all documents from ChromaDB, tokenizes them, builds BM25, scores, discards. For 3000 chunks = ~2s wasted per query. → **After:** BM25 index built once after `/index`, stored in a module-level `dict[repo_name, BM25Okapi]`. Invalidated on re-index.

**Key file:** [vector_store.py](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/service/vector_store.py#L247-L262) — add a `_bm25_cache: dict[str, tuple[BM25Okapi, list, list]]` module-level cache

---

### #8 — Kill Dead Infrastructure
| Axis | Score | Why |
|---|---|---|
| UX | 4 | Slightly faster startup |
| Performance | 3 | Removes MongoDB connection overhead |
| Maintainability | **9** | Dead code confuses every future contributor. Mongoose is a major dep for nothing. |
| Scalability | 6 | Eliminates an unnecessary external dependency for deployment |
| **Avg Impact** | **5.5** | **Effort: 1h** · Leverage: 5.50 |

**Remove:**
- MongoDB/Mongoose from [server.js](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/backend/server.js#L2) and [package.json](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/backend/package.json#L21) — no model/schema/query exists anywhere
- [RepoHeader.jsx](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/components/RepoHeader.jsx) — empty file, never imported
- [App.css](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/App.css) — 185 lines of Vite scaffold CSS, none used
- Root-level `axios` in [package.json](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/package.json#L14) — never imported from root

---

### #9 — Responsive Chat Layout
| Axis | Score | Why |
|---|---|---|
| UX | **8** | Currently unusable below 1024px. Portfolio reviewers often check mobile. |
| Performance | 2 | Neutral |
| Maintainability | 5 | Cleaner layout code with proper breakpoints |
| Scalability | 3 | Neutral |
| **Avg Impact** | **4.5** | **Effort: 3h** · Leverage: 1.50 |

**Before:** `w-[60%]` / `w-[40%]` side-by-side at all widths. On phone = two squished unusable columns. → **After:** Below `md` breakpoint: full-width chat with a bottom tab bar to switch between Chat / File Tree / Focus Map. Swipe-friendly panel transitions.

**Key file:** [ChatPage.jsx](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/pages/ChatPage.jsx#L122-L208) — restructure layout with responsive breakpoints

---

### #10 — Error Boundary + 404 Route
| Axis | Score | Why |
|---|---|---|
| UX | **7** | White screen of death → helpful error message with retry option |
| Performance | 1 | Neutral |
| Maintainability | 6 | Catches render errors before they propagate |
| Scalability | 2 | Neutral |
| **Avg Impact** | **4.0** | **Effort: 1h** · Leverage: 4.00 |

**Before:** Any render error = blank white page, no recovery. Unknown routes = blank page. → **After:** Error boundary catches throws, shows "Something went wrong" with a "Retry" button. Wildcard route shows a styled 404 with link back to home.

**Key files:**
- New `frontend/src/components/ErrorBoundary.jsx`
- [App.jsx](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/App.jsx) — add catch-all `<Route path="*">` and wrap with boundary

---

### #11 — Chat History Persistence
| Axis | Score | Why |
|---|---|---|
| UX | **8** | "I asked this yesterday" — being able to return to a conversation is expected in 2026 |
| Performance | 2 | localStorage read on mount |
| Maintainability | 4 | Simple read/write, but needs a storage key strategy |
| Scalability | 4 | Local-only, but a stepping stone to server-side history |
| **Avg Impact** | **4.5** | **Effort: 2h** · Leverage: 2.25 |

**Before:** Navigate away = entire conversation destroyed → **After:** Messages saved per `repoName` in `localStorage`. On return to the same repo, previous conversation loads. "Clear history" button in chat header.

**Key file:** [ChatPage.jsx](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/pages/ChatPage.jsx#L15-L22) — `useEffect` to load/save messages

---

### #12 — README + Architecture Diagram + Demo Recording
| Axis | Score | Why |
|---|---|---|
| UX | **10** | The README IS the first page of your portfolio. It's seen before any code. |
| Performance | 1 | N/A |
| Maintainability | 7 | Onboards future contributors, documents decisions |
| Scalability | 2 | Neutral |
| **Avg Impact** | **5.0** | **Effort: 3h** · Leverage: 1.67 |

**Before:** The only README is the Vite scaffold default in `frontend/README.md`. No root README. → **After:**

A root `README.md` with:
- Hero screenshot / demo GIF showing the Focus Map in action
- One-paragraph value prop
- Architecture diagram (Mermaid) showing React → Express → FastAPI → ChromaDB / Gemini
- Quick start guide (3 commands)
- Feature list with screenshots
- Tech stack badges
- API documentation summary

---

### #13 — Dockerize with `docker-compose.yml`
| Axis | Score | Why |
|---|---|---|
| UX | 3 | Invisible to end users |
| Performance | 2 | Neutral |
| Maintainability | **8** | "Works on my machine" → works everywhere |
| Scalability | **9** | Prerequisite for any cloud deployment |
| **Avg Impact** | **5.5** | **Effort: 3h** · Leverage: 1.83 |

**Before:** Requires Node.js, Python, pip, npm installs across 3 directories, correct env vars, correct ports. → **After:** `docker compose up` starts all 3 services with correct networking, environment, and health checks.

**New files:**
- `Dockerfile` for backend (Node.js)
- `Dockerfile` for service (Python)
- `Dockerfile` for frontend (Vite build + nginx)
- `docker-compose.yml` orchestrating all three

---

### #14 — Security Hardening Layer
| Axis | Score | Why |
|---|---|---|
| UX | 2 | Invisible when working, critical when attacked |
| Performance | 2 | Rate limiting adds negligible overhead |
| Maintainability | 7 | Security middleware is well-isolated |
| Scalability | **8** | Without rate limiting, one bad actor can DoS the service |
| **Avg Impact** | **4.8** | **Effort: 3h** · Leverage: 1.58 |

**Bundle of fixes:**
- Path traversal protection in [repoController.js:129](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/backend/controllers/repoController.js#L129)
- Proper URL validation (parse with `new URL()`, check `hostname === 'github.com'`)
- CORS origin allowlist in [server.js:10](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/backend/server.js#L10)
- `express-rate-limit` on `/analyze` (2 req/min) and `/query` (20 req/min)
- Request body size cap (`express.json({ limit: '1mb' })`)
- Credential rotation + `git rm --cached` (this should happen RIGHT NOW, before everything else)

---

### #15 — Rich Code Blocks in Chat Messages
| Axis | Score | Why |
|---|---|---|
| UX | **8** | AI responses frequently contain code. Currently rendered as inline `<code>` with no block distinction. |
| Performance | 2 | Neutral |
| Maintainability | 5 | Extends the ChatMessage component cleanly |
| Scalability | 2 | Neutral |
| **Avg Impact** | **4.3** | **Effort: 2h** · Leverage: 2.13 |

**Before:** All code in AI responses rendered as inline purple `<code>` spans, even multi-line blocks. No copy button. → **After:** Fenced code blocks render with syntax highlighting (same highlighter as #2), a language label, and a "Copy" button. Inline code stays as-is.

**Key file:** [ChatMessage.jsx](file:///Users/sahilarundhawane/Desktop/Desktop_Docs/frontend/REPO/frontend/src/components/ChatMessage.jsx#L21-L25) — add `pre` + `code` handler to ReactMarkdown components

---

## Summary Ranking Table

| Rank | Improvement | Impact | Effort | Leverage | Quadrant |
|---:|---|:---:|:---:|:---:|---|
| 1 | Real Focus Map (React Flow) | 7.0 | 8h | 0.88 | 🚀 Strategic — but the visual crown jewel |
| 2 | Syntax Highlighting | 6.8 | 3h | 2.25 | 🏆 Quick Win |
| 3 | Streaming AI Responses | 7.3 | 5h | 1.45 | 🚀 Strategic |
| 4 | Async Pipeline + Real Progress | 8.3 | 8h | 1.03 | 🚀 Strategic |
| 5 | Survive Page Refresh | 5.8 | 3h | 1.92 | 🏆 Quick Win |
| 6 | API Client + Env Fix | 5.8 | 1.5h | 3.83 | 🏆 Quick Win |
| 7 | BM25 Index Cache | 7.5 | 3h | 2.50 | 🏆 Quick Win |
| 8 | Kill Dead Infrastructure | 5.5 | 1h | 5.50 | 🏆 Quick Win |
| 9 | Responsive Chat Layout | 4.5 | 3h | 1.50 | 🚀 Strategic |
| 10 | Error Boundary + 404 | 4.0 | 1h | 4.00 | 🏆 Quick Win |
| 11 | Chat History Persistence | 4.5 | 2h | 2.25 | 🏆 Quick Win |
| 12 | README + Demo | 5.0 | 3h | 1.67 | 🚀 Strategic |
| 13 | Docker Compose | 5.5 | 3h | 1.83 | 🚀 Strategic |
| 14 | Security Layer | 4.8 | 3h | 1.58 | 🚀 Strategic |
| 15 | Rich Code Blocks | 4.3 | 2h | 2.13 | 🏆 Quick Win |

**Total estimated effort: ~49 hours**

---

## Recommended Execution Order

> [!TIP]
> This order is **not** sorted by rank. It's sorted by **dependency chain** and **maximum visible progress at every checkpoint.** After each sprint, the project should look noticeably better than before.

### Sprint 1 — Foundation Clean (Day 1) · ~8h
*Goal: Remove all embarrassments. A reviewer looking at code sees professionalism.*

```
#14 → Credential rotation (do this FIRST, before any commit)
 #8 → Kill dead infrastructure (MongoDB, App.css, RepoHeader.jsx)
 #6 → API client module + env fix
#10 → Error boundary + 404 route
#14 → Path traversal + CORS + rate limiting
```

**Checkpoint:** Code is clean, secure, and properly abstracted. No dead weight.

---

### Sprint 2 — Core UX Leap (Days 2-4) · ~24h
*Goal: The app feels alive. Every interaction is responsive and visual.*

```
 #2 → Syntax highlighting (sets up shared code renderer)
#15 → Rich code blocks in chat (builds on #2's renderer)
 #7 → BM25 cache (queries become fast)
 #3 → Streaming AI responses (biggest "wow" moment per effort)
 #5 → Survive refresh + #11 Chat persistence (reliability)
 #1 → Real Focus Map with React Flow (the signature feature)
```

**Checkpoint:** Demo the app to anyone — it looks and feels like a real product.

---

### Sprint 3 — Production Polish (Days 5-6) · ~17h
*Goal: Deployable, documentable, demo-ready.*

```
 #4 → Async analysis pipeline + real progress
 #9 → Responsive layout
#13 → Docker Compose
#12 → README + architecture diagram + demo GIF
```

**Checkpoint:** `docker compose up`, send the GitHub link to anyone, they understand and can run it.

---

> [!IMPORTANT]
> **The single highest-ROI action** if you do nothing else: implement **#2 (Syntax Highlighting) + #1 (Focus Map) + #3 (Streaming)**. These three items alone transform the perception from "college project" to "this person builds real tools." Everything else is important but these are the portfolio differentiators.
