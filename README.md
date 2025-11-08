# AI Voice Receptionist System

An AI-powered voice receptionist for salon/spa businesses with real-time voice interaction, appointment booking, and intelligent question answering.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account (PostgreSQL with pgvector)
- LiveKit account
- Groq API key
- OpenAI API key
- Gmail account (for email notifications)
- Google Calendar API credentials (optional)

### Installation

1. **Clone and Install**

```bash
git clone <repository-url>
cd <project-directory>
```

2. **Setup Database**

```bash
cd backend
npm install
npm run setup-db
npm run populate-kb
```

3. **Configure Backend**

```bash
# Create .env file in backend/
cp .env.example .env
# Edit .env with your credentials
```

Required environment variables:

- `SUPABASE_URL` and `SUPABASE_KEY`
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `GROQ_API_KEY` and `OPENAI_API_KEY`
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`

4. **Start Backend**

```bash
npm run dev
# Backend runs on http://localhost:3000
```

5. **Setup Frontend**

```bash
cd ../frontend
npm install
cp .env.example .env
# Edit .env with VITE_API_URL and VITE_LIVEKIT_URL
npm run dev
# Frontend runs on http://localhost:5173
```

6. **Setup Admin Dashboard**

```bash
cd ../admin-dashboard
npm install
cp .env.example .env
# Edit .env with VITE_API_URL
npm run dev
# Dashboard runs on http://localhost:5174
```

### Optional: Google Calendar Integration

```bash
cd backend
node scripts/connectGoogleCalendar.js
# Follow OAuth flow in browser
```

## Verification

- Backend API: http://localhost:3000/api/supervisor/stats
- Customer Frontend: http://localhost:5173
- Admin Dashboard: http://localhost:5174

## Key Features

- **Real-time Voice Chat**: LiveKit-powered AI receptionist
- **Smart Q&A**: RAG system with vector similarity search
- **Appointment Booking**: Google Calendar integration
- **Supervisor Dashboard**: Handle escalated questions
- **Email Notifications**: Automated customer responses
- **Learning System**: AI learns from supervisor answers

## Tech Stack

- **Backend**: Node.js, Express, Supabase, LiveKit, Groq AI
- **Frontend**: React 18, Vite, Tailwind CSS, LiveKit Client
- **Admin**: React 18, Vite, Tailwind CSS

## Documentation

For detailed information about architecture, API endpoints, database schema, user flows, and deployment, see [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md).

## Project Structure

```
├── backend/              # Express API server
│   ├── src/
│   │   ├── core/        # Database, auth
│   │   └── features/    # Voice, knowledge, booking, supervisor
│   ├── scripts/         # Setup and testing scripts
│   └── sql/             # Database schema and migrations
├── frontend/            # Customer-facing React app
│   └── src/features/    # Voice, booking, notifications
├── admin-dashboard/     # Supervisor dashboard React app
└── PROJECT_DOCUMENTATION.md  # Comprehensive documentation
```

## Development Scripts

### Backend

- `npm run dev` - Start development server
- `npm run setup-db` - Initialize database
- `npm run populate-kb` - Populate knowledge base
- `npm run test-kb` - Test knowledge base queries

### Frontend & Admin Dashboard

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Support

For issues, questions, or contributions, please refer to the comprehensive documentation in [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md).
