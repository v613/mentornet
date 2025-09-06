/**
 * Frontend API Service Layer
 * Replaces direct database calls with Netlify Function API calls
 */

class ApiService {
  constructor() {
    // Handle both browser (Vite) and Node.js environments
    this.baseURL = (typeof window !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) 
      || process.env.VITE_API_BASE_URL 
      || '/.netlify/functions';
    this.token = this.getStoredToken();
  }

  /**
   * Get stored JWT token from localStorage
   * @returns {string|null} JWT token
   */
  getStoredToken() {
    // Handle Node.js environment where localStorage is not available
    if (typeof localStorage === 'undefined') {
      return this._nodeToken || null;
    }
    return localStorage.getItem('authToken');
  }

  /**
   * Store JWT token in localStorage
   * @param {string} token JWT token
   */
  setToken(token) {
    this.token = token;
    
    // Handle Node.js environment where localStorage is not available
    if (typeof localStorage === 'undefined') {
      this._nodeToken = token;
      return;
    }
    
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  /**
   * Get authorization headers
   * @returns {Object} Headers object
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  /**
   * Make HTTP request to API endpoint
   * @param {string} endpoint API endpoint
   * @param {Object} options Request options
   * @returns {Promise<Object>} API response
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Return structured error response instead of throwing
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          errorCode: data.errorCode || null,
          status: response.status
        };
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      // Return structured error response for network/parsing errors
      return {
        success: false,
        error: error.message || 'Network or parsing error',
        errorCode: null,
        status: null
      };
    }
  }

  /**
   * GET request
   * @param {string} endpoint API endpoint
   * @returns {Promise<Object>} API response
   */
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   * @param {string} endpoint API endpoint
   * @param {Object} data Request body
   * @returns {Promise<Object>} API response
   */
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * PUT request
   * @param {string} endpoint API endpoint
   * @param {Object} data Request body
   * @returns {Promise<Object>} API response
   */
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * DELETE request
   * @param {string} endpoint API endpoint
   * @returns {Promise<Object>} API response
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // ============================================
  // AUTHENTICATION METHODS
  // ============================================

  /**
   * Authenticate user and get JWT token
   * @param {string} userid Username
   * @param {string} password Password
   * @returns {Promise<Object>} Authentication result with token and user data
   */
  async authenticateUser(userid, password) {
    const response = await this.post('/auth?action=login', { userid, password });
    
    // Only set token if authentication was successful
    if (response.success && response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  /**
   * Register new user
   * @param {string} userid Username
   * @param {string} email Email address
   * @param {string} password Password
   * @returns {Promise<Object>} Registration result
   */
  async registerUser(userid, email, password, role = 'mentee') {
    return this.post('/auth?action=register', { userid, email, password, role });
  }

  /**
   * Authenticate user with TOTP
   * @param {string} userid Username
   * @param {string} code TOTP code
   * @returns {Promise<Object>} Authentication result with token and user data
   */
  async authenticateUserTotp(userid, code) {
    const response = await this.post('/auth?action=totp', { userid, code });
    
    if (response.success && response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  /**
   * Setup TOTP for current user
   * @returns {Promise<Object>} Setup result with QR code and secret
   */
  async setupTotp() {
    return this.post('/totp?action=setup', {});
  }

  /**
   * Verify TOTP setup with code
   * @param {string} code TOTP verification code
   * @returns {Promise<Object>} Verification result
   */
  async verifyTotpSetup(code) {
    return this.post('/totp?action=verify', { code });
  }

  /**
   * Disable TOTP for current user
   * @param {string} password User's password for confirmation
   * @returns {Promise<Object>} Disable result
   */
  async disableTotp(password) {
    return this.post('/totp?action=disable', { password });
  }

  /**
   * Logout user (clear token)
   */
  logout() {
    this.setToken(null);
  }

  // ============================================
  // USER MANAGEMENT METHODS
  // ============================================

  /**
   * Get current user profile with roles
   * @returns {Promise<Object>} User profile data
   */
  async getUserWithRoles() {
    const response = await this.get('/users');
    return response.user;
  }

  /**
   * Update user profile
   * @param {Object} profileData Profile data to update
   * @returns {Promise<Object>} Update result
   */
  async updateUserProfile(profileData) {
    return this.put('/users', profileData);
  }

  /**
   * Change user password
   * @param {string} currentPassword Current password
   * @param {string} newPassword New password
   * @returns {Promise<Object>} Password change result
   */
  async changePassword(currentPassword, newPassword) {
    return this.post('/users?action=change-password', { currentPassword, newPassword });
  }

  /**
   * Get mentee's enrolled courses
   * @returns {Promise<Array>} List of enrolled courses
   */
  async getMenteeEnrolledCourses() {
    const response = await this.get('/user-courses?type=enrolled');
    return response.courses || [];
  }

  /**
   * Get mentor's created courses
   * @returns {Promise<Array>} List of mentor's courses
   */
  async getMentorCourses() {
    const response = await this.get('/user-courses?type=created');
    return response.courses || [];
  }

  // ============================================
  // ADMIN MANAGEMENT METHODS
  // ============================================

  /**
   * Get all users (admin only)
   * @param {number} page Page number (default: 1)
   * @param {number} pageSize Page size (default: 20)
   * @param {string} role Role filter (optional: mentee, mentor, admin)
   * @param {string} search Search term (optional)
   * @returns {Promise<Object>} Users with pagination and filter info
   */
  async getAllUsers(page = 1, pageSize = 20, role = null, search = null) {
    const params = new URLSearchParams({ 
      action: 'list',
      page: page.toString(), 
      pageSize: pageSize.toString() 
    });
    if (role) params.append('role', role);
    if (search && search.trim()) params.append('search', search.trim());
    
    const response = await this.get(`/users?${params.toString()}`);
    return {
      users: response.users || [],
      pagination: response.pagination || {},
      filters: response.filters || {}
    };
  }

  /**
   * Block/unblock a user (admin only)
   * @param {string} userId User ID to block/unblock
   * @param {boolean} blocked Block status
   * @returns {Promise<Object>} Update result
   */
  async updateUserBlockStatus(userId, blocked) {
    return this.request(`/users?action=block&userId=${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ blocked }),
    });
  }

  /**
   * Update any user's profile (admin only)
   * @param {string} userId User ID to update
   * @param {Object} profileData Profile data to update
   * @returns {Promise<Object>} Update result
   */
  async updateAnyUserProfile(userId, profileData) {
    return this.put(`/users-profile/${userId}`, profileData);
  }

  /**
   * Get all courses for admin management
   * @returns {Promise<Array>} List of all courses
   */
  async getAllCoursesForAdmin() {
    const response = await this.get('/courses?all=true');
    return response.courses || [];
  }

  /**
   * Update any course (admin only)
   * @param {string} courseId Course ID to update
   * @param {Object} courseData Course data to update
   * @returns {Promise<Object>} Update result
   */
  async updateAnyCourse(courseId, courseData) {
    return this.put(`/courses?courseId=${courseId}`, courseData);
  }

  /**
   * Delete any course (admin only)
   * @param {string} courseId Course ID to delete
   * @returns {Promise<Object>} Delete result
   */
  async deleteAnyCourse(courseId) {
    return this.delete(`/courses?courseId=${courseId}`);
  }

  // ============================================
  // COURSE MANAGEMENT METHODS
  // ============================================

  /**
   * Get all courses with pagination
   * @param {number} page Page number (default: 1)
   * @param {number} pageSize Page size (default: 10)
   * @returns {Promise<Object>} Courses with pagination info
   */
  async getCourses(page = 1, pageSize = 10) {
    const response = await this.get(`/courses?page=${page}&pageSize=${pageSize}`);
    return {
      courses: response.courses || [],
      pagination: response.pagination || {}
    };
  }

  /**
   * Create new course
   * @param {Object} courseData Course data
   * @returns {Promise<Object>} Course creation result
   */
  async createCourse(courseData) {
    return this.post('/courses', courseData);
  }

  /**
   * Update existing course
   * @param {number} courseId Course ID
   * @param {Object} courseData Updated course data
   * @returns {Promise<Object>} Course update result
   */
  async updateCourse(courseId, courseData) {
    return this.put(`/courses?courseId=${courseId}`, courseData);
  }

  /**
   * Apply to a course
   * @param {number} courseId Course ID
   * @param {string} motivation Motivation text
   * @param {string} experience Experience text
   * @param {string} timeSlotId Optional time slot ID
   * @returns {Promise<Object>} Application result
   */
  async applyToCourse(courseId, motivation, experience, timeSlotId = null) {
    return this.post(`/courses-apply?courseId=${courseId}`, {
      motivation,
      experience,
      ...(timeSlotId && { timeSlotId })
    });
  }

  /**
   * Get course applications (for course owner/admin)
   * @param {number} courseId Course ID
   * @returns {Promise<Object>} Applications data
   */
  async getCourseApplications(courseId) {
    return this.get(`/courses-applications?courseId=${courseId}`);
  }

  /**
   * Update application status
   * @param {number} courseId Course ID
   * @param {number} applicationId Application ID
   * @param {string} status New status ('approved' or 'rejected')
   * @returns {Promise<Object>} Status update result
   */
  async updateApplicationStatus(courseId, applicationId, status) {
    return this.put(`/courses-applications?courseId=${courseId}&applicationId=${applicationId}`, { status });
  }

  /**
   * Cancel course application (mentee only)
   * @param {number} courseId Course ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelCourseApplication(courseId) {
    return this.delete(`/courses-cancel-application?courseId=${courseId}`);
  }

  // ============================================
  // MENTOR METHODS
  // ============================================

  /**
   * Get all mentors
   * @returns {Promise<Array>} List of mentors
   */
  async getMentors() {
    const response = await this.get('/mentors');
    return response.mentors || [];
  }

  /**
   * Get specific mentor profile with stats
   * @param {string} mentorId Mentor ID
   * @returns {Promise<Object>} Mentor profile with statistics
   */
  async getMentorProfile(mentorId) {
    const response = await this.get(`/mentors?mentorId=${mentorId}`);
    return response.mentor;
  }

  /**
   * Get mentor image only (for performance)
   * @param {string} mentorId Mentor ID
   * @returns {Promise<Object>} Mentor image data
   */
  async getMentorImage(mentorId) {
    return this.get(`/mentors/${mentorId}/image`);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Check if user is authenticated
   * @returns {boolean} True if user has valid token
   */
  isAuthenticated() {
    return !!this.token;
  }

  /**
   * Get current user from token (basic decode)
   * Note: This is a simple decode, not validation
   * @returns {Object|null} Decoded user data
   */
  getCurrentUserFromToken() {
    if (!this.token) return null;
    
    try {
      const payload = this.token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }
}

// Create and export singleton instance
export const apiService = new ApiService();

// Export class for testing
export { ApiService };