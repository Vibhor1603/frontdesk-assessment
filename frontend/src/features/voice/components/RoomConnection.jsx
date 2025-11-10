import { useState, useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function RoomConnection({
  participantIdRef,
  onMessage,
  setParticipantId,
}) {
  const room = useRoomContext();
  const [hasNotified, setHasNotified] = useState(false);

  useEffect(() => {
    if (!room || !room.localParticipant || hasNotified) {
      return;
    }

    setHasNotified(true);

    const timer = setTimeout(async () => {
      const participant = room.localParticipant;
      let participantId =
        participant.identity || participant.sid || `customer-${Date.now()}`;

      participantIdRef.current = participantId;
      setParticipantId(participantId);

      try {
        const response = await fetch(
          `${API_URL}/api/webhooks/participant-joined`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              participantId,
              participantName: participantId,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.message) {
            onMessage(data.message);
          }
        } else {
          toast.error("Failed to connect to Frontdesk Salon Agent");
        }
      } catch (error) {
        toast.error("Connection error. Please try again.");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [room, hasNotified, participantIdRef, setParticipantId, onMessage]);

  return null;
}
