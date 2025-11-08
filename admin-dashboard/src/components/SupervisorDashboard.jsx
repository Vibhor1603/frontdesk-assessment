import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function SupervisorDashboard() {
  const [activeTab, setActiveTab] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [learnedAnswers, setLearnedAnswers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answerText, setAnswerText] = useState({});
  const [submitting, setSubmitting] = useState(null);
  const [connected, setConnected] = useState(false);

  const eventSourceRef = useRef(null);

  // Fetch data from API
  async function fetchRequests() {
    const statusFilter = activeTab === "pending" ? "?status=pending" : "";
    const response = await fetch(
      `${API_BASE_URL}/api/supervisor/help-requests${statusFilter}`
    );
    return response.json();
  }

  async function fetchStats() {
    const response = await fetch(`${API_BASE_URL}/api/supervisor/stats`);
    return response.json();
  }

  async function fetchLearnedAnswers() {
    const response = await fetch(
      `${API_BASE_URL}/api/supervisor/learned-answers`
    );
    return response.json();
  }

  // Load initial data
  async function loadData() {
    try {
      setLoading(true);

      const [requestsData, statsData] = await Promise.all([
        fetchRequests(),
        fetchStats(),
      ]);

      setRequests(requestsData);
      setStats(statsData);

      if (activeTab === "learned") {
        const learnedData = await fetchLearnedAnswers();
        setLearnedAnswers(learnedData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  // Refresh data (called by SSE events)
  async function refreshData() {
    try {
      const [requestsData, statsData] = await Promise.all([
        fetchRequests(),
        fetchStats(),
      ]);

      setRequests(requestsData);
      setStats(statsData);

      if (activeTab === "learned") {
        const learnedData = await fetchLearnedAnswers();
        setLearnedAnswers(learnedData);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
    }
  }

  // Setup SSE connection
  useEffect(() => {
    const eventSource = new EventSource(
      `${API_BASE_URL}/api/supervisor/events`
    );

    eventSource.onopen = () => {setConnected(true);
      toast.success("Connected to real-time updates");
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") {}
      } catch (error) {
        console.error("[SSE] Error parsing message:", error);
      }
    };

    eventSource.addEventListener("new-request", () => {toast("New help request!", { icon: "🔔" });
      refreshData();
    });

    eventSource.addEventListener("request-answered", () => {refreshData();
    });

    eventSource.addEventListener("request-timeout", () => {refreshData();
    });

    eventSource.onerror = () => {
      console.error("[SSE] Connection error");
      setConnected(false);
    };

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, []);

  // Load data on mount and tab change
  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Submit answer
  async function handleSubmitAnswer(requestId) {
    const answer = answerText[requestId];
    if (!answer || !answer.trim()) {
      toast.error("Please enter an answer");
      return;
    }

    setSubmitting(requestId);
    const loadingToast = toast.loading("Submitting answer...");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/supervisor/help-requests/${requestId}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer: answer.trim() }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit answer");
      }

      setAnswerText((prev) => ({ ...prev, [requestId]: "" }));
      await refreshData();

      toast.dismiss(loadingToast);

      if (result.emailSent) {
        toast.success("Answer submitted and email sent successfully! 📧");
      } else if (result.noEmail) {
        toast.success("Answer submitted! (No email provided by customer)");
      } else {
        toast.success("Answer submitted successfully!");
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast.dismiss(loadingToast);
      toast.error(error.message || "Failed to submit answer");
    } finally {
      setSubmitting(null);
    }
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Supervisor Dashboard</h1>
            <p className="text-gray-400">
              Manage customer questions and help the AI learn
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                connected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm text-gray-400">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-400">
                {stats.pending}
              </div>
              <div className="text-sm text-gray-400">Pending</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">
                {stats.resolved}
              </div>
              <div className="text-sm text-gray-400">Resolved</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-400">
                {stats.timeout}
              </div>
              <div className="text-sm text-gray-400">Timeout</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-400">
                {stats.learnedAnswers}
              </div>
              <div className="text-sm text-gray-400">Learned</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-800">
          <button
            onClick={() => setActiveTab("pending")}
            className={`pb-3 px-4 font-medium transition-colors ${
              activeTab === "pending"
                ? "text-white border-b-2 border-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Pending Requests
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 px-4 font-medium transition-colors ${
              activeTab === "history"
                ? "text-white border-b-2 border-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab("learned")}
            className={`pb-3 px-4 font-medium transition-colors ${
              activeTab === "learned"
                ? "text-white border-b-2 border-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Learned Answers
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <>
            {/* Pending Requests */}
            {activeTab === "pending" && (
              <div className="space-y-4">
                {requests.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    No pending requests. Great job! 🎉
                  </div>
                ) : (
                  requests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-gray-900 rounded-lg p-6 border border-gray-800"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="text-sm text-gray-400 mb-1">
                            {formatTimestamp(request.created_at)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Room: {request.room_name}
                            {request.customer_email && (
                              <span className="ml-2 text-green-400">
                                📧 {request.customer_email}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-yellow-900 text-yellow-300 text-xs rounded-full">
                          Pending
                        </span>
                      </div>

                      <div className="mb-4">
                        <div className="text-sm text-gray-400 mb-2">
                          Customer Question:
                        </div>
                        <div className="text-lg">{request.question}</div>
                      </div>

                      <div className="space-y-3">
                        <textarea
                          value={answerText[request.id] || ""}
                          onChange={(e) =>
                            setAnswerText((prev) => ({
                              ...prev,
                              [request.id]: e.target.value,
                            }))
                          }
                          placeholder="Type your answer here..."
                          className="w-full bg-gray-800 text-white rounded-lg p-3 border border-gray-700 focus:border-gray-600 focus:outline-none resize-none"
                          rows={3}
                        />
                        <button
                          onClick={() => handleSubmitAnswer(request.id)}
                          disabled={submitting === request.id}
                          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                        >
                          {submitting === request.id
                            ? "Submitting..."
                            : request.customer_email
                            ? "Submit Answer & Send Email"
                            : "Submit Answer"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* History */}
            {activeTab === "history" && (
              <div className="space-y-4">
                {requests.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    No history yet
                  </div>
                ) : (
                  requests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-gray-900 rounded-lg p-6 border border-gray-800"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="text-sm text-gray-400 mb-1">
                            {formatTimestamp(request.created_at)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Room: {request.room_name}
                            {request.customer_email && (
                              <span className="ml-2 text-green-400">
                                📧 {request.customer_email}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 text-xs rounded-full ${
                            request.status === "resolved"
                              ? "bg-green-900 text-green-300"
                              : request.status === "timeout"
                              ? "bg-red-900 text-red-300"
                              : "bg-gray-800 text-gray-300"
                          }`}
                        >
                          {request.status}
                        </span>
                      </div>

                      <div className="mb-3">
                        <div className="text-sm text-gray-400 mb-1">
                          Question:
                        </div>
                        <div>{request.question}</div>
                      </div>

                      {request.answer && (
                        <div>
                          <div className="text-sm text-gray-400 mb-1">
                            Answer:
                          </div>
                          <div className="text-green-400">{request.answer}</div>
                          {request.answered_at && (
                            <div className="text-xs text-gray-500 mt-1">
                              Answered {formatTimestamp(request.answered_at)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Learned Answers */}
            {activeTab === "learned" && (
              <div className="space-y-4">
                {learnedAnswers.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    No learned answers yet. Answer some questions to build the
                    knowledge base!
                  </div>
                ) : (
                  learnedAnswers.map((item) => (
                    <div
                      key={item.id}
                      className="bg-gray-900 rounded-lg p-6 border border-gray-800"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="text-sm text-gray-400">
                          {formatTimestamp(item.created_at)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Used {item.times_used} times
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="text-sm text-gray-400 mb-1">Q:</div>
                        <div className="text-lg">{item.question}</div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-400 mb-1">A:</div>
                        <div className="text-green-400">{item.answer}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SupervisorDashboard;
