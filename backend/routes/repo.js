const express = require('express')
const rateLimit = require('express-rate-limit')
const { analyzeRepo, queryRepo, getFileContent, getFunctionEvolution, getIndexStatus } = require('../controllers/repoController')

const router = express.Router()

// Strict limit for /analyze — heavy operation (git clone + AST parse + embedding)
const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Analysis rate limit exceeded. Try again in a few minutes." }
})

// Moderate limit for /query — normal chat usage
const queryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Query rate limit exceeded. Please slow down." }
})

router.post('/analyze', analyzeLimiter, analyzeRepo)
router.post('/query', queryLimiter, queryRepo)
router.get('/file', getFileContent)
router.get('/evolution', getFunctionEvolution)
router.get('/index-status', getIndexStatus)

module.exports = router