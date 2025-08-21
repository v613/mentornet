# MentorNet Platform
[![Netlify Status](https://api.netlify.com/api/v1/badges/448ea9dc-ad24-4d1f-bbd9-d8f2cb9ce8bf/deploy-status)](https://app.netlify.com/projects/mentoras/deploys)

**Connecting learners with mentors, forming a network for personalized guidance and training.**

MentorNet is a comprehensive platform that enables users to find mentorship, share knowledge, and grow together. It builds a supportive community for skill development and professional growth, where learners can opt in to discover mentors and mentors can guide others on their journey.

## 🌟 Features

- **User Authentication**: Secure Firebase-based authentication with email/password
- **Multilingual Support**: Full i18n support for Romanian (default), English, and Russian
- **Responsive Design**: Mobile-first responsive interface with modern UI/UX
- **Mentorship Network**: Platform designed for connecting learners with experienced mentors
- **Knowledge Sharing**: Community-driven environment for skill development
- **Professional Growth**: Tools and features to support career advancement

## 🚀 Tech Stack

- **Frontend**: Vue 3 with Composition API
- **Build Tool**: Vite 7.x for fast development and optimized builds
- **Database**: Firebase Firestore NoSQL database
- **Authentication**: Firebase Authentication
- **Internationalization**: Vue i18n for multi-language support
- **Styling**: Modern CSS with responsive design principles

## 🛠️ Installation & Setup

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm or yarn package manager
- Firebase project with Authentication and Firestore enabled

### 1. Clone the Repository

```bash
git clone <repository-url>
cd mentornet
```

### 2. Install Dependencies

```bash
npm install
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

## 🌍 Internationalization

The platform supports three languages:

- **Romanian (RO)**: Default language
- **Russian (RU)**: Fallback language support
- **English (EN)**: Additional language

Language files are located in `src/i18n/locales/` and can be easily extended.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run security checks: `npm audit`
5. Submit a pull request

## 🆘 Support

For support and questions, please contact the development team or create an issue in the repository.
