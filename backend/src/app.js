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

app.use(cors({
    origin: (origin, callback) => {
        const allowed = !origin ||
            origin.startsWith('http://localhost:') ||
            origin.startsWith('http://127.0.0.1:') ||
            /^http:\/\/192\.168\./.test(origin) ||
            /^http:\/\/10\./.test(origin) ||
            /^http:\/\/172\.(1[6-9]|2\d|3[01])\./.test(origin);

        if (allowed) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
    credentials: true
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