const express = require('express')
const router = express.Router()

const incidentController = require('../controller/incident.controller')
const authMiddleware = require('../middlewares/auth.middleware')
const multer = require('multer')
const upload = multer({
    storage: multer.memoryStorage(),
})

router.post(
    '/report',
    authMiddleware,
    upload.single('image'),
    incidentController.reportIncident
)
router.post('/report-demo', authMiddleware, incidentController.reportDemoIncident)
router.post('/translate-description', authMiddleware, incidentController.translateOperationalDetails)
router.get('/history', authMiddleware, incidentController.getCitizenHistory)
router.get('/active-trip', authMiddleware, incidentController.getActiveTrip)
router.get('/reports/:id', authMiddleware, incidentController.getTripReport)
router.get('/profile', authMiddleware, incidentController.getCitizenProfile)
router.get('/leaderboard', authMiddleware, incidentController.getLeaderboard)
router.post('/trip-assistant', authMiddleware, incidentController.tripAssistant)

module.exports = router 
