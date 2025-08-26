# MentorNet Platform
[![Netlify Status](https://api.netlify.com/api/v1/badges/448ea9dc-ad24-4d1f-bbd9-d8f2cb9ce8bf/deploy-status)](https://app.netlify.com/projects/mentoras/deploys)

**Connecting learners with mentors, forming a network for personalized guidance and training.**

MentorNet is a comprehensive platform that enables users to find mentorship, share knowledge, and grow together. It builds a supportive community for skill development and professional growth, featuring a complete course management system with role-based access control.

## 🌟 Features

### 🔐 **Role-Based System**
- **3-Tier User Roles**: Mentee (learners) → Mentor (course creators) → Admin (full management)
- **ABAC Security**: Attribute-Based Access Control with granular permissions
- **Dynamic Permissions**: Context-aware access based on user attributes, capacity, and time constraints
- **Auto-logout**: Automatic session termination after 30 minutes of inactivity

### 📚 **Course Management**
- **Course Creation**: Mentors can create comprehensive courses with skills, prerequisites, and objectives
- **Enrollment System**: Application-based course enrollment with approval workflows
- **Course Lifecycle**: Draft → Published → Archived status management
- **Capacity Management**: Automatic enforcement of mentor capacity limits

### 💬 **Session Management**
- **Scheduled Sessions**: Time-based session scheduling with working hours enforcement
- **Real-time Updates**: Live session status updates and messaging
- **Feedback System**: Post-session ratings and reviews
- **Participant Management**: Secure access control for session participants

### 🎯 **User Experience**
- **User Authentication**: Secure Firebase-based authentication with email/password
- **Responsive Design**: Mobile-first responsive interface with modern UI/UX
- **Multilingual Support**: i18n support for authentication pages (Romanian, English, Russian)
- **Role-Based UI**: Dynamic interface adaptation based on user permissions
- **Real-time Data**: Firebase-powered live updates across all components

## 🚀 Tech Stack

- **Frontend**: Vue 3 with Composition API
- **Build Tool**: Vite 7.x for fast development and optimized builds
- **Database**: Firebase Firestore NoSQL database with advanced security rules
- **Authentication**: Firebase Authentication with role-based extensions
- **Access Control**: Custom ABAC (Attribute-Based Access Control) implementation
- **Real-time**: Firebase real-time subscriptions and live updates
- **Internationalization**: Vue i18n for multi-language support (auth pages only)
- **Styling**: Modern CSS with responsive design principles and mobile-first approach

## 🛠️ Installation & Setup

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm or yarn package manager
- Firebase project with Authentication and Firestore enabled
- Environment variables configured (see below)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd mentornet
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory with your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Deploy Firestore Security Rules

Deploy the enhanced security rules to your Firebase project:

```bash
firebase deploy --only firestore:rules
```

## 🚀 Development

### Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or next available port).

### Build for Production

```bash
npm run build
```

## 👥 User Roles & Permissions

### **Mentee (Default Role)**
- Browse and apply to published courses
- Participate in assigned sessions
- Leave reviews and feedback
- View mentor profiles and course details

### **Mentor**
- All mentee capabilities +
- Create and manage courses (draft → publish → archive)
- Review and approve/reject course applications
- Schedule and conduct mentoring sessions
- Set availability and capacity limits (default: 5 mentees)

### **Admin**
- All mentor + mentee capabilities +
- User role management (promote mentee ↔ mentor)
- Course moderation and oversight
- System analytics and reporting
- User account management

## 🔐 Security Features

### **ABAC (Attribute-Based Access Control)**
The platform implements a comprehensive ABAC system with:

- **User Attributes**: Role, experience, skills, capacity, permissions
- **Resource-Based Access**: Different permissions for courses, sessions, users
- **Contextual Constraints**: Time-based (working hours), capacity-based limits
- **Dynamic Evaluation**: Real-time permission checking based on current state

### **Firestore Security Rules**
Advanced server-side security with:
- Role-based access control
- Attribute validation
- Temporal constraints (future scheduling only)
- Capacity enforcement
- Audit trail support

## 🌍 Internationalization

Multilingual support is available for authentication pages only:

- **Romanian (RO)**: Default language
- **Russian (RU)**: Fallback language support  
- **English (EN)**: Additional language

Language files are located in `src/i18n/locales/`. The main application interface uses English for consistency across roles and features.

## 🏗️ Architecture

### **Database Collections**
- `users` - User profiles with roles and attributes
- `courses` - Course information with creator and enrollment data
- `course_applications` - Course enrollment applications
- `sessions` - Mentoring sessions with participants
- `reviews` - User reviews and ratings
- `analytics` - System analytics (admin-only)
- `audit_logs` - Access control audit trail (admin-only)

### **Key Services**
- `authService` - Authentication and role management
- `databaseService` - Firestore operations with role validation
- `abacService` - Client-side access control policy evaluation

### **Components Structure**
- **Course Management**: `CourseManagement`, `CourseList`, `CreateCourse`, `CourseDetails`
- **Session Management**: `SessionManagement`, `SessionList`, `SessionDetails`
- **Authentication**: `AuthForm`, `LanguageSwitcher`

## 🛡️ Production Deployment

### Firebase Configuration
1. Configure Firebase project with Authentication and Firestore
2. Deploy security rules: `firebase deploy --only firestore:rules`
3. Set up environment variables in your hosting platform
4. Enable required authentication providers in Firebase Console

### Security Checklist
- ✅ Firestore security rules deployed
- ✅ Environment variables secured
- ✅ ABAC policies validated
- ✅ Audit logging enabled
- ✅ Session timeout configured (30min)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the ABAC security model
4. Test role-based access controls
5. Run security checks: `npm audit`
6. Submit a pull request

## 🆘 Support

For support and questions, please contact the development team or create an issue in the repository.

## 📝 License

This project is part of the MentorNet ecosystem. Please refer to the license file for usage terms and conditions.
