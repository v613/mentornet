import * as jose from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
const secret = new TextEncoder().encode(JWT_SECRET);

/**
 * Generate JWT token for user
 * @param {Object} user User object
 * @returns {Promise<string>} JWT token
 */
export async function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName
  };
  
  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
  
  return token;
}

/**
 * Verify JWT token
 * @param {string} token JWT token
 * @returns {Promise<Object|null>} Decoded user data or null
 */
export async function verifyToken(token) {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Middleware to authenticate requests
 * @param {Object} event Netlify event object
 * @param {Function} handler Request handler function
 * @returns {Promise<Object>} Response object
 */
export async function withAuth(event, handler) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({ 
        success: false, 
        error: 'Authentication required',
        errorCode: 'AUTH_REQUIRED'
      })
    };
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = await verifyToken(token);
  
  if (!user) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({ 
        success: false, 
        error: 'Invalid or expired token',
        errorCode: 'AUTH_INVALID'
      })
    };
  }
  
  return handler(event, user);
}

/**
 * Check if user has required role
 * @param {Object} user User object from token
 * @param {Array<string>} allowedRoles Array of allowed roles
 * @returns {boolean} Whether user has permission
 */
export function hasRole(user, allowedRoles) {
  return allowedRoles.includes(user.role);
}

/**
 * Middleware to check user roles
 * @param {Array<string>} allowedRoles Required roles
 * @param {Function} handler Request handler
 * @returns {Function} Middleware function
 */
export function requireRole(allowedRoles) {
  return (event, user, handler) => {
    if (!hasRole(user, allowedRoles)) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          success: false, 
          error: 'Insufficient permissions',
          errorCode: 'INSUFFICIENT_PERMISSIONS'
        })
      };
    }
    
    return handler(event, user);
  };
}