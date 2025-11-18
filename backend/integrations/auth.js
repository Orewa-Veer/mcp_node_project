import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '24h';

/**
 * Sign a JWT token
 */
export function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify a JWT token
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

/**
 * Express middleware to verify JWT from Authorization header
 */
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ ok: false, error: 'Missing authorization header' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        return res.status(401).json({ ok: false, error: 'Invalid authorization header format' });
    }

    const token = parts[1];
    const payload = verifyToken(token);

    if (!payload) {
        return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
    }

    req.user = payload;
    next();
}

/**
 * Express middleware to verify doctor role
 */
export function doctorMiddleware(req, res, next) {
    if (!req.user || req.user.role !== 'doctor') {
        return res.status(403).json({ ok: false, error: 'Forbidden: doctor access required' });
    }
    next();
}

/**
 * Express middleware to verify patient role
 */
export function patientMiddleware(req, res, next) {
    if (!req.user || req.user.role !== 'patient') {
        return res.status(403).json({ ok: false, error: 'Forbidden: patient access required' });
    }
    next();
}

/**
 * Create a doctor token
 */
export function createDoctorToken(doctorId, doctorName, doctorEmail) {
    return signToken({
        role: 'doctor',
        doctorId,
        doctorName,
        doctorEmail,
        iat: Math.floor(Date.now() / 1000),
    });
}

/**
 * Create a patient token/session
 */
export function createPatientToken(patientId, patientName, patientEmail) {
    return signToken({
        role: 'patient',
        patientId: patientId || null,
        patientName,
        patientEmail,
        iat: Math.floor(Date.now() / 1000),
    });
}
