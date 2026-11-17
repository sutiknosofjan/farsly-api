import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'farsly-dev-secret-key-change-in-production';

/**
 * Generate a JWT token for an authenticated user.
 * @param {{ id: number, email: string, role: string }} user
 * @returns {string} signed token
 */
export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Express middleware – verifies JWT from Authorization header.
 * Attaches decoded payload to `req.user`.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role, iat, exp }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Express middleware factory – restricts access to specific roles.
 * Must be used after `authenticate`.
 * @param  {...string} roles  allowed roles
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
