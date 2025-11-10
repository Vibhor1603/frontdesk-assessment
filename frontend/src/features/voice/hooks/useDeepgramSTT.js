import { useEffect, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const DEEPGRAM_URL =
  import.meta.env.VITE_DEEPGRAM_URL || "wss://api.deepgram.com/v1/listen";

export function useDeepgramSTT(onTranscript) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const finalTranscriptRef = useRef("");

  const startListening = async () => {
    try {
      const response = await fetch(`${API_URL}/api/deepgram/api-key`);
      const { apiKey } = await response.json();

      if (!apiKey) {
        throw new Error("Deepgram API key not available");
      }

      // Get microphone access with enhanced audio constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true, // Automatic volume adjustment
          sampleRate: 16000,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      // Connect to Deepgram WebSocket with enhanced parameters for better accuracy
      const params = new URLSearchParams({
        encoding: "linear16",
        sample_rate: "16000",
        channels: "1",
        model: "nova-2", // Most accurate model
        language: "en-US",
        punctuate: "true",
        interim_results: "true", // Get partial results for better UX
        endpointing: "300", // Detect end of speech after 300ms silence
        vad_events: "true", // Voice activity detection
        smart_format: "true", // Better formatting
      });

      const socket = new WebSocket(`${DEEPGRAM_URL}?${params.toString()}`, [
        "token",
        apiKey,
      ]);

      socketRef.current = socket;

      socket.onopen = async () => {
        setIsListening(true);

        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)({
          sampleRate: 16000,
          latencyHint: "interactive",
        });
        audioContextRef.current = audioContext;

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (socket.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmData = new Int16Array(inputData.length);

            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }

            socket.send(pcmData.buffer);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      };

      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);

          if (data.type === "SpeechStarted") {
            finalTranscriptRef.current = "";
            setInterimText("");
            return;
          }

          const transcript = data.channel?.alternatives?.[0]?.transcript;
          const isFinal = data.is_final;
          const speechFinal = data.speech_final;

          if (transcript && transcript.trim()) {
            if (isFinal) {
              finalTranscriptRef.current +=
                (finalTranscriptRef.current ? " " : "") + transcript;

              if (speechFinal) {
                if (onTranscript && finalTranscriptRef.current.trim()) {
                  onTranscript(finalTranscriptRef.current.trim());
                }
                finalTranscriptRef.current = "";
                setInterimText("");
              }
            } else {
              setInterimText(transcript);
            }
          }
        } catch (error) {
          // Silent error handling
        }
      };

      socket.onerror = () => {
        stopListening();
      };

      socket.onclose = () => {
        setIsListening(false);
      };
    } catch (error) {
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsListening(false);
  };

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  return {
    isListening,
    startListening,
    stopListening,
    interimText, // Expose interim text for UI feedback
  };
}
