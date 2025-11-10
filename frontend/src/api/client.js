import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const BASE_URL = `${API_URL}/api`;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const auth = {
  getToken: (roomName, participantName) =>
    api.post("/auth/token", { roomName, participantName }),
};

export const voice = {
  processVoice: (roomName, participantId, audioData) =>
    api.post("/voice/voice", { roomName, participantId, audioData }),
  getHelpRequestStatus: (roomName) =>
    api.get(`/voice/help-request/${roomName}`),
};

export const knowledge = {
  query: (query) => api.post("/knowledge/query", { query }),
  store: (question, answer) =>
    api.post("/knowledge/store", { question, answer }),
  getHelpRequests: () => api.get("/knowledge/help-requests"),
  resolveHelpRequest: (id, answer) =>
    api.post(`/knowledge/help-requests/${id}/resolve`, { answer }),
};

export default api;
