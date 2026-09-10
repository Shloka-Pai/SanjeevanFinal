const jwt = require('jsonwebtoken')

function authMiddleware(req, res, next) {
    // Support both cookie-based auth (web) and Bearer token auth (mobile)
    let token = req.cookies.token

    if (!token) {
        const authHeader = req.headers.authorization
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.slice(7)
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Unauthorized" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
        next()
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired session" })
    }
}

module.exports = authMiddleware