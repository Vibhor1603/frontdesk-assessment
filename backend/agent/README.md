# LiveKit Voice Agent

This agent handles real-time voice processing using LiveKit Agents SDK.

## Setup

1. Install Python 3.9 or higher

2. Create a virtual environment:

```bash
cd backend/agent
python -m venv venv
```

3. Activate the virtual environment:

- Windows: `venv\Scripts\activate`
- Mac/Linux: `source venv/bin/activate`

4. Install dependencies:

```bash
pip install -r requirements.txt
```

5. Make sure your `.env` file has:

```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
DEEPGRAM_API_KEY=your_deepgram_key
OPENAI_API_KEY=your_openai_key (optional, for TTS fallback)
ELEVEN_LABS_API_KEY=your_elevenlabs_key
```

## Running the Agent

```bash
python agent.py dev
```

The agent will:

1. Connect to your LiveKit room
2. Listen for participants joining
3. Transcribe their speech using Deepgram
4. Send the text to your backend API
5. Convert the response to speech using ElevenLabs/OpenAI
6. Stream the audio back to the participant

## How It Works

1. User speaks → Deepgram STT → Text
2. Text → Your Backend API → Response Text
3. Response Text → ElevenLabs TTS → Audio
4. Audio → Streamed to User

This keeps your existing backend logic intact while adding voice capabilities!
