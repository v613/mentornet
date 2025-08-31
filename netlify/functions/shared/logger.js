/**
 * Centralized logging utility for Netlify Functions
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Format log message with timestamp and context
 * @param {string} level Log level
 * @param {string} message Log message
 * @param {Object} context Additional context data
 * @returns {Object} Formatted log object
 */
function formatLog(level, message, context = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  };
}

/**
 * Log error messages
 * @param {string} message Error message
 * @param {Error|Object} error Error object or additional context
 * @param {Object} context Additional context data
 */
export function logError(message, error = null, context = {}) {
  const logData = formatLog(LOG_LEVELS.ERROR, message, {
    ...context,
    ...(error && {
      error: {
        message: error.message || error,
        stack: error.stack,
        code: error.code
      }
    })
  });
  
  console.error(JSON.stringify(logData, null, 2));
}

/**
 * Log warning messages
 * @param {string} message Warning message
 * @param {Object} context Additional context data
 */
export function logWarn(message, context = {}) {
  const logData = formatLog(LOG_LEVELS.WARN, message, context);
  console.warn(JSON.stringify(logData, null, 2));
}

/**
 * Log info messages
 * @param {string} message Info message
 * @param {Object} context Additional context data
 */
export function logInfo(message, context = {}) {
  const logData = formatLog(LOG_LEVELS.INFO, message, context);
  console.log(JSON.stringify(logData, null, 2));
}

/**
 * Log debug messages (only in development)
 * @param {string} message Debug message
 * @param {Object} context Additional context data
 */
export function logDebug(message, context = {}) {
  if (process.env.NODE_ENV === 'development') {
    const logData = formatLog(LOG_LEVELS.DEBUG, message, context);
    console.log(JSON.stringify(logData, null, 2));
  }
}

/**
 * Log function execution start
 * @param {string} functionName Function name
 * @param {Object} event Netlify event object (sanitized)
 * @param {Object} user User data (if authenticated)
 */
export function logFunctionStart(functionName, event, user = null) {
  logInfo(`Function started: ${functionName}`, {
    function: functionName,
    method: event.httpMethod,
    path: event.path,
    userAgent: event.headers['user-agent'],
    userId: user?.userId,
    userRole: user?.role
  });
}

/**
 * Log function execution end
 * @param {string} functionName Function name
 * @param {number} statusCode Response status code
 * @param {number} duration Execution duration in ms
 */
export function logFunctionEnd(functionName, statusCode, duration) {
  logInfo(`Function completed: ${functionName}`, {
    function: functionName,
    statusCode,
    duration: `${duration}ms`
  });
}

/**
 * Log database operation
 * @param {string} operation Database operation description
 * @param {string} query SQL query (sanitized)
 * @param {boolean} success Whether operation was successful
 * @param {number} duration Query duration in ms
 */
export function logDatabaseOperation(operation, query, success, duration = null) {
  const level = success ? LOG_LEVELS.INFO : LOG_LEVELS.ERROR;
  const message = `Database ${operation}: ${success ? 'SUCCESS' : 'FAILED'}`;
  
  const logData = formatLog(level, message, {
    operation,
    query: sanitizeQuery(query),
    success,
    ...(duration && { duration: `${duration}ms` })
  });
  
  if (success) {
    console.log(JSON.stringify(logData, null, 2));
  } else {
    console.error(JSON.stringify(logData, null, 2));
  }
}

/**
 * Sanitize SQL query for logging (remove sensitive data)
 * @param {string} query SQL query
 * @returns {string} Sanitized query
 */
function sanitizeQuery(query) {
  if (!query) return '';
  
  // Replace potential sensitive data patterns
  return query
    .replace(/crypt\([^,]+,/gi, 'crypt([HIDDEN],')
    .replace(/'[^']*'/g, "'[VALUE]'")
    .substring(0, 200) + (query.length > 200 ? '...' : '');
}

/**
 * Log authentication attempt
 * @param {string} userid User ID attempting to authenticate
 * @param {boolean} success Whether authentication was successful
 * @param {string} reason Reason for failure (if applicable)
 */
export function logAuthAttempt(userid, success, reason = null) {
  const message = `Authentication attempt: ${success ? 'SUCCESS' : 'FAILED'}`;
  const level = success ? LOG_LEVELS.INFO : LOG_LEVELS.WARN;
  
  const logData = formatLog(level, message, {
    userid: userid || 'unknown',
    success,
    ...(reason && { reason })
  });
  
  console.log(JSON.stringify(logData, null, 2));
}

/**
 * Log security event (potential threats, suspicious activity)
 * @param {string} event Security event description
 * @param {Object} context Event context
 */
export function logSecurityEvent(event, context = {}) {
  logError(`SECURITY EVENT: ${event}`, null, {
    securityEvent: true,
    ...context
  });
}

/**
 * Create function wrapper with automatic logging
 * @param {string} functionName Function name for logging
 * @param {Function} handler Function handler
 * @returns {Function} Wrapped handler with logging
 */
export function withLogging(functionName, handler) {
  return async (event, context) => {
    const startTime = Date.now();
    
    try {
      // Log function start
      logFunctionStart(functionName, event);
      
      // Execute handler
      const result = await handler(event, context);
      
      // Log function end
      const duration = Date.now() - startTime;
      logFunctionEnd(functionName, result.statusCode, duration);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log error
      logError(`Function error: ${functionName}`, error, {
        function: functionName,
        duration: `${duration}ms`,
        path: event.path,
        method: event.httpMethod
      });
      
      // Re-throw error
      throw error;
    }
  };
}