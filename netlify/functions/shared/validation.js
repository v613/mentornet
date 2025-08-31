/**
 * Common validation functions for API endpoints
 */

/**
 * Validate email format
 * @param {string} email Email address
 * @returns {boolean} Is valid email
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password Password
 * @returns {Object} Validation result
 */
export function validatePassword(password) {
  if (!password || password.length < 6) {
    return { 
      valid: false, 
      error: 'Password must be at least 6 characters long'
    };
  }
  
  return { valid: true };
}

/**
 * Validate required fields in request body
 * @param {Object} body Request body
 * @param {Array<string>} requiredFields Required field names
 * @returns {Object} Validation result
 */
export function validateRequiredFields(body, requiredFields) {
  const missing = [];
  
  for (const field of requiredFields) {
    if (!body[field] && body[field] !== 0) {
      missing.push(field);
    }
  }
  
  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missing.join(', ')}`,
      errorCode: 'MISSING_FIELDS',
      missingFields: missing
    };
  }
  
  return { valid: true };
}

/**
 * Sanitize string input
 * @param {string} input Input string
 * @param {number} maxLength Maximum length
 * @returns {string} Sanitized string
 */
export function sanitizeString(input, maxLength = 255) {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ''); // Basic XSS prevention
}

/**
 * Validate pagination parameters
 * @param {Object} queryParams Query parameters
 * @returns {Object} Validated pagination object
 */
export function validatePagination(queryParams) {
  const page = parseInt(queryParams.page) || 1;
  const pageSize = Math.min(parseInt(queryParams.pageSize) || 10, 100); // Max 100 items per page
  
  return {
    page: Math.max(page, 1),
    pageSize: Math.max(pageSize, 1),
    offset: (Math.max(page, 1) - 1) * Math.max(pageSize, 1)
  };
}

/**
 * Validate course data
 * @param {Object} courseData Course data object
 * @returns {Object} Validation result
 */
export function validateCourseData(courseData) {
  const requiredValidation = validateRequiredFields(courseData, ['title', 'description']);
  if (!requiredValidation.valid) {
    return requiredValidation;
  }
  
  // Validate specific course fields
  if (courseData.title && courseData.title.length > 255) {
    return {
      valid: false,
      error: 'Course title must be 255 characters or less',
      errorCode: 'TITLE_TOO_LONG'
    };
  }
  
  if (courseData.maxEnrollment && (courseData.maxEnrollment < 1 || courseData.maxEnrollment > 1000)) {
    return {
      valid: false,
      error: 'Max enrollment must be between 1 and 1000',
      errorCode: 'INVALID_MAX_ENROLLMENT'
    };
  }
  
  if (courseData.duration && (courseData.duration < 1 || courseData.duration > 52)) {
    return {
      valid: false,
      error: 'Duration must be between 1 and 52 weeks',
      errorCode: 'INVALID_DURATION'
    };
  }
  
  return { valid: true };
}

/**
 * Validate UUID format
 * @param {string} uuid UUID string
 * @returns {boolean} Is valid UUID
 */
export function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}