const express = require('express')
const { analyzeRepo, queryRepo, getFileContent } = require('../controllers/repoController')

const router = express.Router()

router.post('/analyze', analyzeRepo)
router.post('/query', queryRepo)
router.get('/file', getFileContent)

module.exports = router