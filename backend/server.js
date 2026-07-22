const express = require("express")
const cors = require("cors")
const rateLimit = require("express-rate-limit")
require("dotenv").config()

const repoRoutes = require('./routes/repo')

const app = express();
app.set('trust proxy', 1);

// --- Security: CORS origin allowlist ---
// Only allow requests from the frontend origin, not from any domain.
// Reads from CORS_ORIGIN env var; defaults to Vite's dev server.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map(origin => origin.trim())

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    console.log(`CORS rejected origin: "${origin}" — allowedOrigins: ${JSON.stringify(allowedOrigins)}`)
    return callback(null, false)
  },
  methods: ["GET", "POST", "DELETE"],
  credentials: true
}))

// --- Security: Request body size cap ---
// 1MB is generous for the largest payload (/analyze sends extracted functions).
// Prevents abuse via oversized request bodies.
app.use(express.json({ limit: "1mb" }))

// --- Security: Rate limiting ---
// Global fallback — 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." }
})
app.use(globalLimiter)

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend running" })
})

app.use('/api/repo', repoRoutes)

const PORT = process.env.PORT || 8000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
