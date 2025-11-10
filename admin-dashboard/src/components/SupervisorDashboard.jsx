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
  const eventSourceRef = useRef(null);

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
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

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
    } catch (error) {}
  }

  useEffect(() => {
    const eventSource = new EventSource(
      `${API_BASE_URL}/api/supervisor/events`
    );

    eventSource.addEventListener("new-request", () => {
      toast("New help request!", { icon: "🔔" });
      refreshData();
    });

    eventSource.addEventListener("request-answered", () => {
      refreshData();
    });

    eventSource.addEventListener("request-timeout", () => {
      refreshData();
    });

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab]);

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
        toast.success("Answer submitted and email sent! 📧");
      } else if (result.noEmail) {
        toast.success("Answer submitted!");
      } else {
        toast.success("Answer submitted!");
      }
    } catch (error) {
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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-12">
          <h1 className="text-4xl font-light text-white mb-2">
            Supervisor Dashboard
          </h1>
          <p className="text-gray-500">
            Manage customer inquiries and train the AI
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/10 transition-all">
              <div className="text-3xl font-light text-yellow-400 mb-1">
                {stats.pending}
              </div>
              <div className="text-sm text-gray-400">Pending</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/10 transition-all">
              <div className="text-3xl font-light text-green-400 mb-1">
                {stats.resolved}
              </div>
              <div className="text-sm text-gray-400">Resolved</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/10 transition-all">
              <div className="text-3xl font-light text-red-400 mb-1">
                {stats.timeout}
              </div>
              <div className="text-sm text-gray-400">Timeout</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/10 transition-all">
              <div className="text-3xl font-light text-purple-400 mb-1">
                {stats.learnedAnswers}
              </div>
              <div className="text-sm text-gray-400">Learned</div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-8">
          {["pending", "history", "learned"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-full text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-400"></div>
          </div>
        ) : (
          <>
            {activeTab === "pending" && (
              <div className="space-y-4">
                {requests.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">
                    <div className="text-4xl mb-4">🎉</div>
                    <div>No pending requests</div>
                  </div>
                ) : (
                  requests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/10 transition-all"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="text-sm text-gray-500 mb-2">
                            {formatTimestamp(request.created_at)}
                            {request.customer_email && (
                              <span className="ml-3 text-green-400">
                                {request.customer_email}
                              </span>
                            )}
                          </div>
                          <div className="text-lg text-white mb-4">
                            {request.question}
                          </div>
                        </div>
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
                          placeholder="Type your answer..."
                          className="w-full bg-white/5 text-white rounded-xl p-4 focus:bg-white/10 focus:outline-none resize-none placeholder-gray-500"
                          rows={3}
                        />
                        <button
                          onClick={() => handleSubmitAnswer(request.id)}
                          disabled={submitting === request.id}
                          className="px-6 py-3 bg-white text-black hover:bg-gray-200 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-xl transition-all font-medium"
                        >
                          {submitting === request.id
                            ? "Submitting..."
                            : "Submit Answer"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-4">
                {requests.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">
                    No history yet
                  </div>
                ) : (
                  requests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/10 transition-all"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="text-sm text-gray-500">
                          {formatTimestamp(request.created_at)}
                          {request.customer_email && (
                            <span className="ml-3 text-green-400">
                              {request.customer_email}
                            </span>
                          )}
                        </div>
                        <span
                          className={`px-3 py-1 text-xs rounded-full ${
                            request.status === "resolved"
                              ? "bg-green-500/20 text-green-400"
                              : request.status === "timeout"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-gray-500/20 text-gray-400"
                          }`}
                        >
                          {request.status}
                        </span>
                      </div>

                      <div className="mb-3">
                        <div className="text-white mb-2">
                          {request.question}
                        </div>
                      </div>

                      {request.answer && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <div className="text-green-400">{request.answer}</div>
                          {request.answered_at && (
                            <div className="text-xs text-gray-500 mt-2">
                              {formatTimestamp(request.answered_at)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "learned" && (
              <div className="space-y-4">
                {learnedAnswers.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">
                    No learned answers yet
                  </div>
                ) : (
                  learnedAnswers.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/10 transition-all"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="text-sm text-gray-500">
                          {formatTimestamp(item.created_at)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Used {item.times_used}x
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="text-white mb-2">{item.question}</div>
                      </div>

                      <div className="pt-4 border-t border-white/10">
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
