###Guide
##  Installation & Setup
```bash
npm install --legacy-peer-deps

###RUnn frontend 
##npm run dev

###Run backend
##npm run server

# --- Server Configuration ---
PORT=5000
SESSION_SECRET=your_secure_session_secret
CORS_ORIGINS=http://localhost:5173

# --- Database Credentials ---
# DATABASE_URL: Combine user, pass, host, and name 
# Format: postgres://DB_USER:DB_PASSWORD@DB_HOST:5432/DB_NAME
DATABASE_URL=
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_NAME=

# --- Email & Communication ---
EMAIL_USER=
EMAIL_PASS=
EMAIL_SENDER_APT_KEY=
EMAIL_API_URL=
VERIFICATION_TTL_MINUTES=10

# --- Network & Integration Links ---
VITE_API_BASE_URL=http://localhost:5000
CONFIRM_LINK=
RESET_LINK=
OSA_MODEL_API=
WEB_RISK_API=