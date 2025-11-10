import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function SupervisorDashboard() {
  const [activeTab, setActiveTab] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [learnedAnswers, setLearnedAnswers] = useState([]);
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answerText, setAnswerText] = useState({});
  const [submitting, setSubmitting] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({ question: "", answer: "" });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItemForm, setNewItemForm] = useState({ question: "", answer: "" });
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

  async function fetchKnowledgeBase() {
    const response = await fetch(
      `${API_BASE_URL}/api/supervisor/knowledge-base`
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
      if (activeTab === "knowledge") {
        const kbData = await fetchKnowledgeBase();
        setKnowledgeBase(kbData);
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
      if (activeTab === "knowledge") {
        const kbData = await fetchKnowledgeBase();
        setKnowledgeBase(kbData);
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

  async function handleEditItem(item) {
    setEditingItem(item.id);
    setEditForm({ question: item.question, answer: item.answer });
  }

  async function handleSaveEdit(itemId) {
    if (!editForm.question.trim() || !editForm.answer.trim()) {
      toast.error("Question and answer are required");
      return;
    }

    const loadingToast = toast.loading("Updating...");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/supervisor/knowledge-base/${itemId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        }
      );

      if (!response.ok) throw new Error("Failed to update");

      setEditingItem(null);
      setEditForm({ question: "", answer: "" });
      await refreshData();
      toast.dismiss(loadingToast);
      toast.success("Updated successfully!");
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("Failed to update");
    }
  }

  async function handleDeleteItem(itemId) {
    if (!confirm("Are you sure you want to delete this item?")) return;

    const loadingToast = toast.loading("Deleting...");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/supervisor/knowledge-base/${itemId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to delete");

      await refreshData();
      toast.dismiss(loadingToast);
      toast.success("Deleted successfully!");
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("Failed to delete");
    }
  }

  async function handleAddNew() {
    if (!newItemForm.question.trim() || !newItemForm.answer.trim()) {
      toast.error("Question and answer are required");
      return;
    }

    const loadingToast = toast.loading("Creating...");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/supervisor/knowledge-base`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newItemForm),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create");
      }

      setIsAddingNew(false);
      setNewItemForm({ question: "", answer: "" });
      await refreshData();
      toast.dismiss(loadingToast);
      toast.success("Created successfully!");
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error.message || "Failed to create");
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

        <div className="flex gap-2 mb-8 flex-wrap">
          {["pending", "history", "learned", "knowledge"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-full text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab === "knowledge"
                ? "Knowledge Base"
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
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

            {activeTab === "knowledge" && (
              <div className="space-y-4">
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setIsAddingNew(true)}
                    className="px-6 py-3 bg-white text-black hover:bg-gray-200 rounded-xl transition-all font-medium"
                  >
                    + Add New
                  </button>
                </div>

                {isAddingNew && (
                  <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 mb-4">
                    <h3 className="text-white text-lg mb-4">
                      Add New Knowledge Base Item
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">
                          Question
                        </label>
                        <input
                          type="text"
                          value={newItemForm.question}
                          onChange={(e) =>
                            setNewItemForm((prev) => ({
                              ...prev,
                              question: e.target.value,
                            }))
                          }
                          placeholder="Enter the question..."
                          className="w-full bg-white/5 text-white rounded-xl p-4 focus:bg-white/10 focus:outline-none placeholder-gray-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">
                          Answer
                        </label>
                        <textarea
                          value={newItemForm.answer}
                          onChange={(e) =>
                            setNewItemForm((prev) => ({
                              ...prev,
                              answer: e.target.value,
                            }))
                          }
                          placeholder="Enter the answer..."
                          className="w-full bg-white/5 text-white rounded-xl p-4 focus:bg-white/10 focus:outline-none resize-none placeholder-gray-500"
                          rows={4}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddNew}
                          className="px-6 py-2 bg-white text-black hover:bg-gray-200 rounded-xl transition-all font-medium"
                        >
                          Create
                        </button>
                        <button
                          onClick={() => {
                            setIsAddingNew(false);
                            setNewItemForm({ question: "", answer: "" });
                          }}
                          className="px-6 py-2 bg-white/5 text-white hover:bg-white/10 rounded-xl transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {knowledgeBase.length === 0 && !isAddingNew ? (
                  <div className="text-center py-20 text-gray-500">
                    No knowledge base items yet. Click "Add New" to create one.
                  </div>
                ) : (
                  knowledgeBase.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/10 transition-all"
                    >
                      {editingItem === item.id ? (
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm text-gray-400 mb-2 block">
                              Question
                            </label>
                            <input
                              type="text"
                              value={editForm.question}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  question: e.target.value,
                                }))
                              }
                              className="w-full bg-white/5 text-white rounded-xl p-4 focus:bg-white/10 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-2 block">
                              Answer
                            </label>
                            <textarea
                              value={editForm.answer}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  answer: e.target.value,
                                }))
                              }
                              className="w-full bg-white/5 text-white rounded-xl p-4 focus:bg-white/10 focus:outline-none resize-none"
                              rows={4}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(item.id)}
                              className="px-6 py-2 bg-white text-black hover:bg-gray-200 rounded-xl transition-all font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingItem(null);
                                setEditForm({ question: "", answer: "" });
                              }}
                              className="px-6 py-2 bg-white/5 text-white hover:bg-white/10 rounded-xl transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-4">
                            <div className="text-sm text-gray-500">
                              {formatTimestamp(item.created_at)}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditItem(item)}
                                className="text-blue-400 hover:text-blue-300 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="text-red-400 hover:text-red-300 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          <div className="mb-4">
                            <div className="text-sm text-gray-400 mb-1">Q:</div>
                            <div className="text-white mb-4">
                              {item.question}
                            </div>
                          </div>

                          <div className="pt-4 border-t border-white/10">
                            <div className="text-sm text-gray-400 mb-1">A:</div>
                            <div className="text-green-400">{item.answer}</div>
                          </div>

                          {item.times_used > 0 && (
                            <div className="text-xs text-gray-500 mt-4">
                              Used {item.times_used} times
                            </div>
                          )}
                        </>
                      )}
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
