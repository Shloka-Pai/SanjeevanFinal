// create server

const express = require('express')
const cookieParser = require('cookie-parser')
const authRoutes = require('./routes/auth.routes')
const citizenRoutes = require('./routes/citizen.routes')
const ambulanceRoutes = require('./routes/ambulance.routes')
const hospitalRoutes = require('./routes/hospital.routes')
const mlRoutes = require('./routes/ml.routes')
const cors = require('cors')

const app = express()

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8081',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8081',
    process.env.WEBSITE_URL,
    process.env.MOBILEAPP_URL,
].filter(Boolean)

const normalizeOrigin = (value) => {
    if (!value) return ''
    try {
        return new URL(value).origin
    } catch {
        return value.replace(/\/api$/, '').replace(/\/$/, '')
    }
}

const normalizedAllowedOrigins = new Set(
    allowedOrigins.map(normalizeOrigin).concat([
        'http://localhost:5173',
        'http://localhost:8081',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8081',
    ])
)

app.use(cors({
    origin: (origin, callback) => {
        const incomingOrigin = normalizeOrigin(origin || '')
        if (!origin || normalizedAllowedOrigins.has(incomingOrigin)) {
            callback(null, true)
            return
        }

        if (/^http:\/\/192\.168\./.test(incomingOrigin) || /^http:\/\/10\./.test(incomingOrigin) || /^http:\/\/172\.(1[6-9]|2\d|3[01])\./.test(incomingOrigin)) {
            callback(null, true)
            return
        }

        callback(null, false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}))
app.use(express.json())
app.use(cookieParser())

app.get('/', (req, res) => {
    res.send('Hellooooooooooo')
})

app.use('/api/auth', authRoutes)
app.use('/api/citizen', citizenRoutes)
app.use('/api/ambulance', ambulanceRoutes)
app.use('/api/hospital', hospitalRoutes)
app.use('/api/ml', mlRoutes)

module.exports = app