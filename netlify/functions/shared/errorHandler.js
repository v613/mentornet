import { logError, logSecurityEvent } from './logger.js';
import { serverError, validationError, authError, permissionError } from './response.js';

/**
 * Enhanced error handling utilities for Netlify Functions
 */

/**
 * Handle and categorize different types of errors
 * @param {Error} error Error object
 * @param {string} operation Operation being performed
 * @param {Object} context Additional context
 * @returns {Object} Appropriate error response
 */
export function handleError(error, operation = 'operation', context = {}) {
  // Log the error
  logError(`Error in ${operation}`, error, context);
  
  // Database errors
  if (isDatabaseError(error)) {
    return handleDatabaseError(error, operation);
  }
  
  // JWT/Authentication errors
  if (isAuthError(error)) {
    return handleAuthError(error);
  }
  
  // Validation errors
  if (isValidationError(error)) {
    return handleValidationError(error);
  }
  
  // Network/timeout errors
  if (isNetworkError(error)) {
    return handleNetworkError(error);
  }
  
  // Security-related errors
  if (isSecurityError(error)) {
    return handleSecurityError(error, context);
  }
  
  // Generic server error
  return serverError('An unexpected error occurred');
}

/**
 * Check if error is a database-related error
 * @param {Error} error Error object
 * @returns {boolean} True if database error
 */
function isDatabaseError(error) {
  const dbErrorCodes = ['23505', '23503', '23514', '08003', '08006'];
  return error.code && dbErrorCodes.includes(error.code);
}

/**
 * Handle database-specific errors
 * @param {Error} error Database error
 * @param {string} operation Operation name
 * @returns {Object} Error response
 */
function handleDatabaseError(error, operation) {
  switch (error.code) {
    case '23505': // Unique constraint violation
      if (error.constraint?.includes('email')) {
        return validationError('Email address already exists', null, 'EMAIL_EXISTS');
      }
      if (error.constraint?.includes('userid')) {
        return validationError('Username already exists', null, 'USERNAME_EXISTS');
      }
      return validationError('Resource already exists', null, 'DUPLICATE_RESOURCE');
      
    case '23503': // Foreign key violation
      return validationError('Referenced resource does not exist', null, 'INVALID_REFERENCE');
      
    case '23514': // Check constraint violation
      return validationError('Data validation failed', null, 'CONSTRAINT_VIOLATION');
      
    case '08003': // Connection does not exist
    case '08006': // Connection failure
      logError('Database connection error', error, { operation });
      return serverError('Service temporarily unavailable');
      
    default:
      return serverError('Database operation failed');
  }
}

/**
 * Check if error is authentication-related
 * @param {Error} error Error object
 * @returns {boolean} True if auth error
 */
function isAuthError(error) {
  const authErrorMessages = [
    'jwt malformed',
    'jwt expired',
    'invalid signature',
    'invalid token',
    'authentication failed'
  ];
  
  return authErrorMessages.some(msg => 
    error.message?.toLowerCase().includes(msg)
  );
}

/**
 * Handle authentication errors
 * @param {Error} error Auth error
 * @returns {Object} Error response
 */
function handleAuthError(error) {
  if (error.message?.includes('expired')) {
    return authError('Token has expired, please login again');
  }
  
  if (error.message?.includes('malformed') || error.message?.includes('invalid')) {
    return authError('Invalid authentication token');
  }
  
  return authError('Authentication failed');
}

/**
 * Check if error is a validation error
 * @param {Error} error Error object
 * @returns {boolean} True if validation error
 */
function isValidationError(error) {
  const validationKeywords = [
    'validation',
    'invalid input',
    'missing required',
    'invalid format',
    'out of range'
  ];
  
  return validationKeywords.some(keyword => 
    error.message?.toLowerCase().includes(keyword)
  );
}

/**
 * Handle validation errors
 * @param {Error} error Validation error
 * @returns {Object} Error response
 */
function handleValidationError(error) {
  return validationError(error.message || 'Validation failed', null, 'VALIDATION_ERROR');
}

/**
 * Check if error is network-related
 * @param {Error} error Error object
 * @returns {boolean} True if network error
 */
function isNetworkError(error) {
  const networkErrorCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'];
  return networkErrorCodes.includes(error.code) || 
         error.message?.includes('timeout') ||
         error.message?.includes('network');
}

/**
 * Handle network errors
 * @param {Error} error Network error
 * @returns {Object} Error response
 */
function handleNetworkError(error) {
  logError('Network error occurred', error);
  return serverError('Service temporarily unavailable');
}

/**
 * Check if error might be security-related
 * @param {Error} error Error object
 * @returns {boolean} True if potential security issue
 */
function isSecurityError(error) {
  const securityKeywords = [
    'sql injection',
    'script injection',
    'unauthorized access',
    'privilege escalation',
    'brute force'
  ];
  
  return securityKeywords.some(keyword => 
    error.message?.toLowerCase().includes(keyword)
  );
}

/**
 * Handle security-related errors
 * @param {Error} error Security error
 * @param {Object} context Error context
 * @returns {Object} Error response
 */
function handleSecurityError(error, context) {
  // Log as security event
  logSecurityEvent(`Potential security issue: ${error.message}`, {
    ...context,
    userAgent: context.userAgent,
    ip: context.ip,
    timestamp: new Date().toISOString()
  });
  
  // Return generic error to not reveal security details
  return serverError('Access denied');
}

/**
 * Enhanced error handler for async functions
 * @param {Function} fn Async function to wrap
 * @param {string} operation Operation name for logging
 * @returns {Function} Wrapped function with error handling
 */
export function withErrorHandler(fn, operation) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return handleError(error, operation, {
        arguments: args.length,
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Rate limiting error (too many requests)
 * @param {string} message Custom message
 * @param {number} retryAfter Seconds to wait before retry
 * @returns {Object} Rate limit error response
 */
export function rateLimitError(message = 'Too many requests', retryAfter = 60) {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Retry-After': retryAfter.toString()
    },
    body: JSON.stringify({
      success: false,
      error: message,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter
    })
  };
}

/**
 * Service unavailable error (maintenance, overload, etc.)
 * @param {string} message Custom message
 * @returns {Object} Service unavailable response
 */
export function serviceUnavailableError(message = 'Service temporarily unavailable') {
  return {
    statusCode: 503,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Retry-After': '300' // 5 minutes
    },
    body: JSON.stringify({
      success: false,
      error: message,
      errorCode: 'SERVICE_UNAVAILABLE'
    })
  };
}