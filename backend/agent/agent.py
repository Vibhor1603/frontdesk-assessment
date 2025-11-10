import asyncio
import os
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import deepgram, openai, silero
import aiohttp
import json

load_dotenv()

# Configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ELEVEN_LABS_API_KEY = os.getenv("ELEVEN_LABS_API_KEY")


async def send_to_backend(participant_id: str, text: str):
    """Send transcribed text to backend for processing"""
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                f"{BACKEND_URL}/api/webhooks/customer-input",
                json={"participantId": participant_id, "text": text},
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("message", {}).get("text", "")
                else:
                    print(f"Backend error: {response.status}")
                    return "I'm having trouble processing that. Please try again."
        except Exception as e:
            print(f"Error sending to backend: {e}")
            return "I'm experiencing technical difficulties. Please try again."


async def entrypoint(ctx: JobContext):
    """Main entry point for the LiveKit agent"""
    
    # Wait for participant to join
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    participant = await ctx.wait_for_participant()
    participant_id = participant.identity or participant.sid
    
    print(f"Participant joined: {participant_id}")
    
    # Setup speech-to-text (Deepgram)
    stt = deepgram.STT(api_key=DEEPGRAM_API_KEY)
    
    # Setup text-to-speech (ElevenLabs or OpenAI)
    if ELEVEN_LABS_API_KEY:
        # Use ElevenLabs for TTS
        tts = openai.TTS(api_key=OPENAI_API_KEY)  # Fallback to OpenAI for now
    else:
        tts = openai.TTS(api_key=OPENAI_API_KEY)
    
    # Setup Voice Activity Detection
    vad = silero.VAD.load()
    
    # Create a simple LLM function that calls our backend
    class BackendLLM(llm.LLM):
        def __init__(self, participant_id: str):
            self.participant_id = participant_id
            
        async def chat(
            self,
            *,
            chat_ctx: llm.ChatContext,
            fnc_ctx: llm.FunctionContext | None = None,
            temperature: float | None = None,
            n: int | None = 1,
        ) -> llm.ChatChunk:
            # Get the last user message
            user_message = chat_ctx.messages[-1].content if chat_ctx.messages else ""
            
            # Send to backend
            response_text = await send_to_backend(self.participant_id, user_message)
            
            # Return as LLM response
            return llm.ChatChunk(
                choices=[
                    llm.Choice(
                        delta=llm.ChoiceDelta(
                            content=response_text,
                            role="assistant",
                        ),
                        index=0,
                    )
                ]
            )
    
    # Create voice assistant
    assistant = VoiceAssistant(
        vad=vad,
        stt=stt,
        llm=BackendLLM(participant_id),
        tts=tts,
        chat_ctx=llm.ChatContext().append(
            role="system",
            text="You are a friendly AI receptionist for Luxe Salon and Spa.",
        ),
    )
    
    # Start the assistant
    assistant.start(ctx.room, participant)
    
    # Send initial greeting
    await assistant.say("Hi! Welcome to Luxe Salon and Spa. How can I help you today?")
    
    print(f"Voice assistant started for {participant_id}")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
