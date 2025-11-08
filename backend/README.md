# AI-Powered Front Desk Agent Backend

This backend provides intelligent responses using AI and semantic search on a knowledge base.

## Features

- **Semantic Search**: Uses Voyage AI embeddings for intelligent question matching
- **AI Responses**: Groq LLM generates contextual answers from knowledge base
- **Automatic Escalation**: Unknown questions are escalated to supervisors
- **Learning System**: Supervisor answers are automatically added to knowledge base

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Make sure your `.env` file has:

```
GROQ_API_KEY=your_groq_api_key
VOYAGE_API_KEY=your_voyage_api_key
ELEVEN_LABS_API_KEY=your_elevenlabs_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### 3. Database Setup

First, run this SQL in your Supabase SQL editor:

```bash
npm run setup-db
```

If the script fails, manually run the SQL from `sql/create_match_function.sql` in Supabase.

### 4. Populate Knowledge Base

```bash
npm run populate-kb
```

### 5. Test the System

```bash
npm run test-kb
```

### 6. Start Development Server

```bash
npm run dev
```

## How It Works

1. **User asks a question** → System generates embedding for the query
2. **Semantic search** → Finds similar questions in knowledge base using vector similarity
3. **AI processing** → Groq AI generates response based on found context
4. **Confident answer** → Returns AI-generated response
5. **Uncertain/No match** → Escalates to supervisor and stores in help_requests table

## API Endpoints

### POST /api/knowledge/query

Query the knowledge base with AI-powered responses.

```json
{
  "query": "What are your hours?",
  "participantId": "user123",
  "roomName": "room456"
}
```

### POST /api/knowledge/store

Store new Q&A pairs (generates embeddings automatically).

```json
{
  "question": "Do you offer manicures?",
  "answer": "Yes, we offer basic manicures for $25."
}
```

### GET /api/knowledge/help-requests

List pending help requests for supervisor dashboard.

### POST /api/knowledge/help-requests/:id/resolve

Resolve a help request and add to knowledge base.

```json
{
  "answer": "Yes, we offer gift certificates that can be purchased online or in-store."
}
```

## Database Schema

The system uses these Supabase tables:

- `knowledge_base`: Stores Q&A pairs with embeddings
- `help_requests`: Stores escalated questions for supervisors

## Customization

- Adjust `SIMILARITY_THRESHOLD` in `knowledgeBase.js` to tune matching sensitivity
- Modify AI prompts in `processQuery()` for different response styles
- Update initial Q&A data in `scripts/populateKnowledgeBase.js`
