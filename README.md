# Chantier360 🏗️

An AI-powered construction management platform built for contractors, engineers, and construction companies in Mali. Chantier360 simplifies project management, contract analysis, and team collaboration while leveraging artificial intelligence to improve productivity and decision-making.

---

## 🏛️ Project Architecture

The repository is organized into two main applications:

- **backend/**: Built with Django & Django REST Framework. Handles authentication, project management, AI contract analysis, email verification, database operations, and REST APIs.
- **frontend/**: Built with React. Provides a modern dashboard for project management, contract uploads, analytics, and user administration.

---

## ✨ Features

- 👷 Construction project management
- 📄 AI-powered contract analysis with Claude AI
- 🔐 Secure authentication with Email OTP & Google OAuth
- 📊 Project dashboards and progress tracking
- 📁 Contract storage and management
- 📧 Email verification and password recovery
- 🇲🇱 Designed specifically for the Malian construction industry

---

## 🛠️ Tech Stack

### Backend

- Django
- Django REST Framework
- PostgreSQL
- Anthropic Claude API
- SendGrid
- Google OAuth
- Python

### Frontend

- React
- JavaScript
- Axios
- CSS

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL

### Installation

Clone the repository:

```bash
git clone https://github.com/tidiani-max/chantier360.git
cd chantier360
```

### Backend

```bash
cd backend

python -m venv venv
source venv/bin/activate

pip install -r requirements.txt

cp .env.example .env

python manage.py migrate

python manage.py runserver
```

### Frontend

```bash
cd frontend

npm install

npm start
```

---

## 🔑 Environment Variables

Create a `.env` file inside the backend directory.

Required services include:

- Anthropic Claude API
- SendGrid
- Google OAuth (optional)

Refer to `.env.example` for the complete configuration.

---

## 📡 Main API Modules

- Authentication
- Projects
- Contracts
- AI Contract Analysis
- User Profiles

---

## 🗺️ Roadmap

- PDF & Word report generation
- Project progress monitoring
- Advanced analytics dashboard
- Team collaboration
- Mobile application
- Construction cost estimation with AI

---

## 📄 License

This project is intended for educational and commercial use.
