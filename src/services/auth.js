export const authService = {
  async signUp(email, password, username) {
    // Skip Firebase - simulate successful signup
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate loading
    
    return { 
      success: true, 
      user: { 
        uid: 'dev-user-' + Date.now(),
        email,
        displayName: username
      }
    }
  },

  async signIn(email, password) {
    // Skip Firebase - simulate successful login
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate loading
    
    return { 
      success: true, 
      user: { 
        uid: 'dev-user-' + Date.now(),
        email,
        displayName: email.split('@')[0]
      }
    }
  },

  async signOut() {
    // Skip Firebase - simulate successful signout
    await new Promise(resolve => setTimeout(resolve, 500))
    return { success: true }
  }
}