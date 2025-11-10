import toast from "react-hot-toast";
import { showEmailToast } from "../../notifications/components/EmailToast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export async function handleBookingRequest(participantId, bookingData) {
  try {
    const response = await fetch(`${API_URL}/api/bookings/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...bookingData,
        participantId,
        roomName: "customer-service",
      }),
    });

    const result = await response.json();
    if (result.success) {
      toast.success("Appointment booked successfully! 📅");
    } else {
      toast.error("Failed to book appointment");
    }
  } catch (error) {
    toast.error("Failed to create booking");
  }
}

export async function handleEmailRequest(participantId, helpRequestId) {
  showEmailToast(async (email) => {
    if (email) {
      try {
        const emailResponse = await fetch(`${API_URL}/api/agent/store-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantId,
            email,
            helpRequestId,
          }),
        });

        if (emailResponse.ok) {
          toast.success(`Email saved! We'll notify you at ${email}`);
        } else {
          toast.error("Failed to save email");
        }
      } catch (error) {
        toast.error("Failed to save email");
      }
    }
  });
}

export async function sendMessageToAgent(userMessage, participantId) {
  const response = await fetch(`${API_URL}/api/webhooks/customer-input`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: userMessage, participantId }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}
