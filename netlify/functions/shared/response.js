/**
 * Standardized response helpers for Netlify Functions
 */

/**
 * CORS headers for all responses
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Credentials': 'false',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};

/**
 * Create successful response
 * @param {Object} data Response data
 * @param {number} statusCode HTTP status code (default: 200)
 * @returns {Object} Netlify function response
 */
export function successResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      ...data
    })
  };
}

/**
 * Create error response
 * @param {string} error Error message
 * @param {number} statusCode HTTP status code (default: 400)
 * @param {string} errorCode Error code for client handling
 * @returns {Object} Netlify function response
 */
export function errorResponse(error, statusCode = 400, errorCode = null) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error,
      ...(errorCode && { errorCode })
    })
  };
}

/**
 * Handle CORS preflight requests
 * @returns {Object} CORS preflight response
 */
export function corsResponse() {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: ''
  };
}

/**
 * Create validation error response
 * @param {string} error Validation error message
 * @param {Array<string>} missingFields Missing fields (optional)
 * @returns {Object} Validation error response
 */
export function validationError(error, missingFields = null) {
  return {
    statusCode: 400,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error,
      errorCode: 'VALIDATION_ERROR',
      ...(missingFields && { missingFields })
    })
  };
}

/**
 * Create authentication error response
 * @param {string} error Auth error message (default: 'Authentication required')
 * @returns {Object} Auth error response
 */
export function authError(error = 'Authentication required') {
  return {
    statusCode: 401,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error,
      errorCode: 'AUTH_ERROR'
    })
  };
}

/**
 * Create permission error response
 * @param {string} error Permission error message (default: 'Insufficient permissions')
 * @returns {Object} Permission error response
 */
export function permissionError(error = 'Insufficient permissions') {
  return {
    statusCode: 403,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error,
      errorCode: 'PERMISSION_ERROR'
    })
  };
}

/**
 * Create not found error response
 * @param {string} error Not found message (default: 'Resource not found')
 * @returns {Object} Not found error response
 */
export function notFoundError(error = 'Resource not found') {
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error,
      errorCode: 'NOT_FOUND'
    })
  };
}

/**
 * Create server error response
 * @param {string} error Server error message (default: 'Internal server error')
 * @returns {Object} Server error response
 */
export function serverError(error = 'Internal server error') {
  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error,
      errorCode: 'SERVER_ERROR'
    })
  };
}