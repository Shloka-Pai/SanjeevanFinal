const express = require('express')
const axios = require('axios')
const path = require('path')
const fs = require('fs')

const router = express.Router()
const ML_URL = process.env.ML_URL || 'http://127.0.0.1:8000'

router.post('/test-ml', async (req, res) => {
    const vitals = req.body
    console.log('[/test-ml] Input sent to ML:', vitals)

    try {
        const response = await axios.post(`${ML_URL}/predict`, vitals)
        console.log('[/test-ml] ML response:', response.data)
        res.status(200).json({ input: vitals, prediction: response.data })
    } catch (err) {
        console.error('[/test-ml] ML service error:', err.message)
        res.status(502).json({ message: 'ML service unreachable', error: err.message })
    }
})

router.get('/metrics', (req, res) => {
    const metricsPath = path.join(__dirname, '../../../ml_service/metrics.json')
    if (!fs.existsSync(metricsPath)) {
        return res.status(404).json({ message: 'metrics.json not found. Run train.py first.' })
    }
    try {
        const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'))
        res.status(200).json(metrics)
    } catch (err) {
        res.status(500).json({ message: 'Failed to read metrics.json', error: err.message })
    }
})

module.exports = router
