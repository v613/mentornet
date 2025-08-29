import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)
const TOKEN_EXPIRY = '1m' // 1 minute

export const tokenService = {
  async generateToken(user) {
    try {
      const payload = {
        id: user.id,
        userid: user.userid,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isBlocked: user.isBlocked
      }
      
      return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1m')
        .sign(JWT_SECRET)
    } catch (error) {
      console.error('Token generation error:', error)
      return null
    }
  },

  async verifyToken(token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      return { valid: true, user: payload }
    } catch (error) {
      if (error.code === 'ERR_JWT_EXPIRED') {
        return { valid: false, error: 'Token expired' }
      }
      return { valid: false, error: 'Token verification failed' }
    }
  },

  storeToken(token) {
    document.cookie = `auth_token=${token}; path=/; max-age=60; SameSite=Strict`
  },

  getToken() {
    const cookies = document.cookie.split(';')
    const authCookie = cookies.find(cookie => cookie.trim().startsWith('auth_token='))
    return authCookie ? authCookie.split('=')[1] : null
  },

  removeToken() {
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    localStorage.removeItem('userData')
    localStorage.removeItem('loginTime')
    localStorage.removeItem('lastActivity')
  },

  async isTokenValid() {
    const token = this.getToken()
    if (!token) return false
    
    const verification = await this.verifyToken(token)
    return verification.valid
  },

  async getCurrentUser() {
    const token = this.getToken()
    if (!token) return null
    
    const verification = await this.verifyToken(token)
    return verification.valid ? verification.user : null
  }
}