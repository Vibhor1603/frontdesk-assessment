import { useEffect, useRef, useState } from "react";

export function useDeepgramSTT(onTranscript, options = {}) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState(""); // For showing interim results
  const socketRef = useRef(null);

  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const finalTranscriptRef = useRef("");

  const startListening = async () => {
    try {
      // Get Deepgram API key from backend
      const response = await fetch(
        "http://localhost:3000/api/deepgram/api-key"
      );
      const { apiKey } = await response.json();

      if (!apiKey) {
        throw new Error("Deepgram API key not available");
      }

      console.log("[Deepgram] Starting with API key");

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

      const socket = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params.toString()}`,
        ["token", apiKey]
      );

      socketRef.current = socket;

      socket.onopen = () => {
        console.log("[Deepgram] ✅ WebSocket Connected");
        setIsListening(true);

        // Use AudioContext to get raw PCM data
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (socket.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);

            // Convert Float32Array to Int16Array (PCM)
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

        console.log("[Deepgram] Audio processing started");
      };

      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);

          // Handle speech started/ended events
          if (data.type === "SpeechStarted") {
            console.log("[Deepgram] 🎤 Speech started");
            finalTranscriptRef.current = "";
            setInterimText("");
            return;
          }

          const transcript = data.channel?.alternatives?.[0]?.transcript;
          const isFinal = data.is_final;
          const speechFinal = data.speech_final; // End of utterance

          if (transcript && transcript.trim()) {
            if (isFinal) {
              // This is a finalized segment
              finalTranscriptRef.current +=
                (finalTranscriptRef.current ? " " : "") + transcript;
              console.log("[Deepgram] ✅ Final segment:", transcript);

              // If speech is complete, send the full transcript
              if (speechFinal) {
                console.log(
                  "[Deepgram] 🎯 Complete utterance:",
                  finalTranscriptRef.current
                );
                if (onTranscript && finalTranscriptRef.current.trim()) {
                  onTranscript(finalTranscriptRef.current.trim());
                }
                finalTranscriptRef.current = "";
                setInterimText("");
              }
            } else {
              // Interim result - for display/feedback
              setInterimText(transcript);
              console.log("[Deepgram] 💬 Interim:", transcript);
            }
          }
        } catch (error) {
          console.error("[Deepgram] Error parsing message:", error);
        }
      };

      socket.onerror = (error) => {
        console.error("[Deepgram] WebSocket Error:", error);
        stopListening();
      };

      socket.onclose = (event) => {
        console.log("[Deepgram] Disconnected:", event.code, event.reason);
        setIsListening(false);
      };
    } catch (error) {
      console.error("[Deepgram] Failed to start:", error);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    console.log("[Deepgram] Stopping...");

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
