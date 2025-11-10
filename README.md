# AI Voice Receptionist System

An intelligent voice-powered receptionist for salon/spa businesses with real-time conversation, appointment booking, and supervisor escalation.

## Features

- **Real-time Voice Chat** - Natural conversation with AI using LiveKit
- **Smart Q&A** - RAG-powered knowledge base with vector similarity search
- **Appointment Booking** - Google Calendar integration for scheduling
- **Supervisor Dashboard** - Handle escalated questions and train the AI
- **Email Notifications** - Automated customer responses
- **Learning System** - AI learns from supervisor answers

## Tech Stack

**Backend:** Node.js, Express, Supabase (PostgreSQL + pgvector), Groq AI, LiveKit  
**Frontend:** React, Vite, Tailwind CSS, LiveKit Client, Deepgram STT  
**Admin:** React, Vite, Tailwind CSS

## Database Tables

- `knowledge_base` - Q&A pairs with vector embeddings (1536-dim)
- `help_requests` - Customer questions requiring supervisor help
- `supervisor_responses` - Audit trail of supervisor answers
- `bookings` - Appointment records with Google Calendar sync
- `google_calendar_tokens` - OAuth tokens for calendar integration

## Project Structure

```
├── backend/                 # Express API server
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── db/             # Database connection
│   │   └── index.js        # Entry point
│   └── sql/                # Database schemas
├── frontend/               # Customer voice interface
│   └── src/
│       ├── features/       # Feature modules
│       └── App.jsx
└── admin-dashboard/        # Supervisor admin panel
    └── src/
        ├── components/
        └── App.jsx
```

## Quick Setup

### 1. Prerequisites

- Node.js 18+
- Supabase account
- LiveKit Cloud account
- Groq API key
- Voyage AI API key (for embeddings)
- Deepgram API key (for speech-to-text)
- Gmail account (for notifications)
- Google Cloud project (for Calendar, optional)

### 2. Database Setup

```bash
cd backend
npm install
npm run setup-db
npm run populate-kb
```

### 3. Configure Environment

**Backend** (`backend/.env`):

```env
LIVEKIT_URL=wss://your-instance.livekit.cloud
LIVEKIT_API_KEY=your_key
LIVEKIT_API_SECRET=your_secret
GROQ_API_KEY=your_groq_key
VOYAGE_API_KEY=your_voyage_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_key
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
```

**Frontend** (`frontend/.env`):

```env
VITE_LIVEKIT_URL=wss://your-instance.livekit.cloud
VITE_API_URL=http://localhost:3000
VITE_DEEPGRAM_API_KEY=your_deepgram_key
```

**Admin Dashboard** (`admin-dashboard/.env`):

```env
VITE_API_URL=http://localhost:3000
```

### 4. Start Services

**Backend:**

```bash
cd backend
npm install
npm run dev
```

Runs on `http://localhost:3000`

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`

**Admin Dashboard:**

```bash
cd admin-dashboard
npm install
npm run dev
```

Runs on `http://localhost:5174`

### 5. Connect Google Calendar (Optional)

```bash
cd backend
node scripts/connectGoogleCalendar.js
```

Follow the OAuth flow in your browser.

## Usage

1. Open frontend at `http://localhost:5173`
2. Click "Start Voice Chat" to begin conversation
3. Ask questions or request appointments
4. Unknown questions escalate to supervisor dashboard
5. Supervisor answers at `http://localhost:5174`
6. AI learns from supervisor responses

## API Endpoints

- `POST /api/auth/token` - Get LiveKit access token
- `POST /api/webhooks/customer-input` - Process customer questions
- `GET /api/supervisor/help-requests` - Get pending questions
- `POST /api/supervisor/help-requests/:id/answer` - Submit answer
- `POST /api/bookings/create` - Create appointment
- `GET /api/bookings/connect-calendar` - OAuth URL

## Key Capabilities

- Vector similarity search for intelligent Q&A matching
- Real-time audio streaming with LiveKit
- Speech-to-text with Deepgram Nova-2
- Text generation with Groq LLaMA models
- Automatic knowledge base learning
- Email notifications to customers
- Google Calendar event creation
- Supervisor dashboard with real-time updates
