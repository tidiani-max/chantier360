# 🏗️ Chantier360 — Plateforme BTP Mali

---

## 🚀 Installation rapide (Mac M1 Pro)

### ✅ Prérequis
- Python 3.11+ (le projet tourne sur Python 3.14 ✅)
- Node.js 18+ → `brew install node`

---

## BACKEND (Django)

```bash
# 1. Aller dans le dossier backend
cd chantier360/backend

# 2. Créer l'environnement virtuel
python3 -m venv venv
source venv/bin/activate

# 3. Installer les dépendances
pip install -r requirements.txt

# 4. Configurer les variables d'environnement
cp .env.example .env
# → Ouvrir .env et remplir (voir section Configuration ci-dessous)

# 5. Initialiser la base de données
python manage.py makemigrations
python manage.py migrate

# 6. (Optionnel) Créer un admin
python manage.py createsuperuser

# 7. Lancer le serveur
python manage.py runserver
# → API disponible sur http://localhost:8000
```

---

## FRONTEND (React)

```bash
# Nouveau terminal
cd chantier360/frontend

npm install
npm start
# → App disponible sur http://localhost:3000
```

---

## ⚙️ Configuration du fichier .env

Ouvrir `backend/.env` et remplir :

### ⚡ Test rapide SANS email (recommandé pour débuter)
```env
EMAIL_BACKEND_OVERRIDE=console
```
→ Les codes OTP s'afficheront dans le terminal Django, pas besoin de SendGrid !

### 🔑 Anthropic (OBLIGATOIRE pour analyse de contrats)
```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```
→ https://console.anthropic.com

### 📧 SendGrid (pour l'envoi réel d'emails OTP)
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
DEFAULT_FROM_EMAIL=noreply@chantier360.com
```
→ https://sendgrid.com (100 emails/jour gratuits)

### 🔐 Google OAuth (optionnel)
```env
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```
→ https://console.cloud.google.com

---

## 📡 Endpoints API

```
POST /api/auth/register/          Inscription
POST /api/auth/verify-otp/        Vérifier OTP
POST /api/auth/resend-otp/        Renvoyer OTP
POST /api/auth/login/             Connexion
POST /api/auth/forgot-password/   Mot de passe oublié
POST /api/auth/reset-password/    Réinitialiser mot de passe
POST /api/auth/google/            Connexion Google
GET  /api/auth/profile/           Profil utilisateur

GET  /api/projects/               Liste projets
POST /api/projects/               Créer projet
GET  /api/projects/:id/           Détail projet
PUT  /api/projects/:id/           Modifier projet
DELETE /api/projects/:id/         Supprimer projet

POST /api/contracts/              Upload + analyse contrat IA
GET  /api/contracts/              Liste contrats
GET  /api/contracts/:id/          Détail + résumé contrat
DELETE /api/contracts/:id/        Supprimer contrat
```

---

## 🏗️ Pages disponibles

```
/                    Landing page
/register            Inscription + OTP
/login               Connexion
/forgot-password     Reset mot de passe
/dashboard           Tableau de bord
/projects/new        Créer un projet
/contracts/upload    Analyser un contrat
```

---

## 🔮 Prochaines fonctionnalités

- [ ] Export résumé PDF et Word
- [ ] Liste et détail des projets
- [ ] Suivi d'avancement des travaux
- [ ] Rapports et statistiques
