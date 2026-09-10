const citizenModel = require('../models/citizen.model')
const hospitalModel = require('../models/hospital.model')
const ambulanceModel = require('../models/ambulance.model')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

function setAuthCookie(res, token) {
    res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    })
}

function clearAuthCookie(res) {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax'
    })
}

async function registerCitizen(req, res) {
    try {
        const { name, email, password } = req.body

        const existingUser = await citizenModel.findOne({ email })

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists"
            })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const citizen = await citizenModel.create({
            name,
            email,
            password: hashedPassword
        })

        const token = jwt.sign(
            { id: citizen._id },
            process.env.JWT_SECRET
        )

        setAuthCookie(res, token)

        res.status(201).json({
            message: "Citizen registered successfully",
            token,
            citizen: {
                id: citizen._id,
                name: citizen.name,
                email: citizen.email,
                totalRewardPoints: citizen.totalRewardPoints
            }
        })

    } catch (err) {
        res.status(500).json({
            message: "Registration failed",
            error: err.message
        })
    }
}

async function loginCitizen(req, res) {
    try {
        const { email, password } = req.body

        const citizen = await citizenModel.findOne({ email })

        if (!citizen) {
            return res.status(400).json({
                message: "Invalid email or password"
            })
        }

        const isMatch = await bcrypt.compare(password, citizen.password)

        if (!isMatch) {
            return res.status(400).json({
                message: "Invalid email or password"
            })
        }

        const token = jwt.sign(
            { id: citizen._id },
            process.env.JWT_SECRET
        )

        setAuthCookie(res, token)

        res.status(200).json({
            message: "Citizen logged in successfully",
            token,
            citizen: {
                id: citizen._id,
                name: citizen.name,
                email: citizen.email,
                totalRewardPoints: citizen.totalRewardPoints
            }
        })

    } catch (err) {
        res.status(500).json({
            message: "Login failed",
            error: err.message
        })
    }
}

function logoutCitizen(req, res) {
    clearAuthCookie(res)

    res.status(200).json({
        message: "Citizen logged out successfully"
    })
}

async function registerAmbulance(req, res) {
    try {
        const { vehicleNumber, password, type} = req.body

        const existing = await ambulanceModel.findOne({ vehicleNumber })

        if (existing) {
            return res.status(400).json({
                message: "Ambulance already registered"
            })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const ambulance = await ambulanceModel.create({
            vehicleNumber,
            password: hashedPassword,
            type,
        })

        const token = jwt.sign(
            { id: ambulance._id, role: 'ambulance' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        )

        setAuthCookie(res, token)

        res.status(201).json({
            message: "Ambulance registered",
            ambulance: {
                id: ambulance._id,
                vehicleNumber: ambulance.vehicleNumber,
                type: ambulance.type,
                status: ambulance.status,
                location: ambulance.location
            }
        })

    } catch (err) {
        res.status(500).json({ message: err.message })
    }
}

async function loginAmbulance(req, res) {
    try {
        const { vehicleNumber, password } = req.body

        const ambulance = await ambulanceModel.findOne({ vehicleNumber })

        if (!ambulance) {
            return res.status(400).json({
                message: "Invalid credentials"
            })
        }

        const isMatch = await bcrypt.compare(password, ambulance.password)

        if (!isMatch) {
            return res.status(400).json({
                message: "Invalid credentials"
            })
        }

        const token = jwt.sign(
            { id: ambulance._id, role: 'ambulance' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        )

        setAuthCookie(res, token)

        res.status(200).json({
            message: "Ambulance logged in",
            ambulance: {
                id: ambulance._id,
                vehicleNumber: ambulance.vehicleNumber,
                type: ambulance.type,
                status: ambulance.status,
                location: ambulance.location
            }
        })

    } catch (err) {
        res.status(500).json({ message: err.message })
    }
}

function logoutAmbulance(req, res) {
    clearAuthCookie(res)
    res.status(200).json({ message: "Logged out" })
}

async function registerHospital(req, res) {
    try {
        const { name, email, password, location, inventory } = req.body

        const existing = await hospitalModel.findOne({ email })

        if (existing) {
            return res.status(400).json({
                message: "Hospital already exists"
            })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const hospital = await hospitalModel.create({
            name,
            email,
            password: hashedPassword,
            location,
            inventory
        })

        const token = jwt.sign(
            { id: hospital._id, role: 'hospital' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        )

        setAuthCookie(res, token)

        res.status(201).json({
            message: "Hospital registered",
            hospital: {
                id: hospital._id,
                name: hospital.name,
                email: hospital.email,
                location: hospital.location,
                inventory: hospital.inventory,
                status: hospital.status
            }
        })

    } catch (err) {
        res.status(500).json({ message: err.message })
    }
}

async function loginHospital(req, res) {
    try {
        const { email, password } = req.body

        const hospital = await hospitalModel.findOne({ email })

        if (!hospital) {
            return res.status(400).json({
                message: "Invalid credentials"
            })
        }

        const isMatch = await bcrypt.compare(password, hospital.password)

        if (!isMatch) {
            return res.status(400).json({
                message: "Invalid credentials"
            })
        }

        const token = jwt.sign(
            { id: hospital._id, role: 'hospital' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        )

        setAuthCookie(res, token)

        res.status(200).json({
            message: "Hospital logged in",
            hospital: {
                id: hospital._id,
                name: hospital.name,
                email: hospital.email,
                location: hospital.location,
                inventory: hospital.inventory,
                status: hospital.status
            }
        })

    } catch (err) {
        res.status(500).json({ message: err.message })
    }
}

function logoutHospital(req, res) {
    clearAuthCookie(res)
    res.status(200).json({ message: "Logged out" })
}


async function getMe(req, res) {
    try {
        // Support both cookie and Bearer token
        let token = req.cookies.token
        if (!token) {
            const authHeader = req.headers.authorization
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.slice(7)
            }
        }
        if (!token) return res.status(401).json({ message: 'No session' })

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const { id, role } = decoded

        if (role === 'ambulance') {
            const ambulance = await ambulanceModel.findById(id).select('-password')
            if (!ambulance) return res.status(401).json({ message: 'Not found' })
            return res.json({ user: { id: ambulance._id, vehicleNumber: ambulance.vehicleNumber, type: ambulance.type, status: ambulance.status, location: ambulance.location, role: 'ambulance' } })
        }
        if (role === 'hospital') {
            const hospital = await hospitalModel.findById(id).select('-password')
            if (!hospital) return res.status(401).json({ message: 'Not found' })
            return res.json({ user: { id: hospital._id, name: hospital.name, email: hospital.email, location: hospital.location, inventory: hospital.inventory, status: hospital.status, role: 'hospital' } })
        }
        // citizen (no role field in token — default)
        const citizen = await citizenModel.findById(id).select('-password')
        if (!citizen) return res.status(401).json({ message: 'Not found' })
        return res.json({ user: { id: citizen._id, name: citizen.name, email: citizen.email, totalRewardPoints: citizen.totalRewardPoints, role: 'citizen' } })
    } catch (err) {
        return res.status(401).json({ message: 'Invalid session' })
    }
}

module.exports = {
    registerCitizen,
    loginCitizen,
    logoutCitizen,
    registerAmbulance,
    loginAmbulance,
    logoutAmbulance,
    registerHospital,
    loginHospital,
    logoutHospital,
    getMe
}
