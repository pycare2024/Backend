// authMiddleware.js in the backend

const jwt = require('jsonwebtoken');

function verifyAdmin(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];  // Get token from headers
    if (!token) return res.status(401).json({ message: "No token provided" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Token is not valid" });
        if (user.role !== 'admin') {
            return res.status(403).json({ message: "Access forbidden. Admins only." });
        }
        req.user = user;  // Store user info in the request object for future use
        next();
    });
}

function verifyDoctor(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];  // Get token from headers
    if (!token) return res.status(401).json({ message: "No token provided" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Token is not valid" });
        if (user.role !== 'doctor') {
            return res.status(403).json({ message: "Access forbidden. Doctors only." });
        }
        req.user = user;  // Store user info in the request object for future use
        next();
    });
}

module.exports = { verifyAdmin, verifyDoctor };