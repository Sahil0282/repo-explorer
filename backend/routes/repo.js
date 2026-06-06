const express = require('express')
const { analyzeRepo, queryRepo, getFileContent, getFunctionEvolution } = require('../controllers/repoController')

const router = express.Router()

router.post('/analyze', analyzeRepo)
router.post('/query', queryRepo)
router.get('/file', getFileContent)
router.get('/evolution', getFunctionEvolution) 

module.exports = router