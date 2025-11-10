import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { StatsCards } from "./StatsCards";
import { TabNavigation } from "./TabNavigation";
import { PendingRequests } from "./PendingRequests";
import { HistoryList } from "./HistoryList";
import { LearnedAnswers } from "./LearnedAnswers";
import { KnowledgeBase } from "./KnowledgeBase";

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

  async function loadData() {
    try {
      setLoading(true);
      const [requestsData, statsData] = await Promise.all([
        fetch(
          `${API_BASE_URL}/api/supervisor/help-requests${
            activeTab === "pending" ? "?status=pending" : ""
          }`
        ).then((r) => r.json()),
        fetch(`${API_BASE_URL}/api/supervisor/stats`).then((r) => r.json()),
      ]);

      setRequests(requestsData);
      setStats(statsData);

      if (activeTab === "learned") {
        const learnedData = await fetch(
          `${API_BASE_URL}/api/supervisor/learned-answers`
        ).then((r) => r.json());
        setLearnedAnswers(learnedData);
      }

      if (activeTab === "knowledge") {
        const kbData = await fetch(
          `${API_BASE_URL}/api/supervisor/knowledge-base`
        ).then((r) => r.json());
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
        fetch(
          `${API_BASE_URL}/api/supervisor/help-requests${
            activeTab === "pending" ? "?status=pending" : ""
          }`
        ).then((r) => r.json()),
        fetch(`${API_BASE_URL}/api/supervisor/stats`).then((r) => r.json()),
      ]);

      setRequests(requestsData);
      setStats(statsData);

      if (activeTab === "learned") {
        const learnedData = await fetch(
          `${API_BASE_URL}/api/supervisor/learned-answers`
        ).then((r) => r.json());
        setLearnedAnswers(learnedData);
      }

      if (activeTab === "knowledge") {
        const kbData = await fetch(
          `${API_BASE_URL}/api/supervisor/knowledge-base`
        ).then((r) => r.json());
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

    eventSource.addEventListener("request-answered", refreshData);
    eventSource.addEventListener("request-timeout", refreshData);

    eventSourceRef.current = eventSource;
    return () => eventSource.close();
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
      if (!response.ok)
        throw new Error(result.error || "Failed to submit answer");

      setAnswerText((prev) => ({ ...prev, [requestId]: "" }));
      await refreshData();
      toast.dismiss(loadingToast);
      toast.success(
        result.emailSent
          ? "Answer submitted and email sent! 📧"
          : "Answer submitted!"
      );
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
        { method: "DELETE" }
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
      if (!response.ok) throw new Error(result.error || "Failed to create");

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

        <StatsCards stats={stats} />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-400"></div>
          </div>
        ) : (
          <>
            {activeTab === "pending" && (
              <PendingRequests
                requests={requests}
                answerText={answerText}
                submitting={submitting}
                onAnswerChange={(id, value) =>
                  setAnswerText((prev) => ({ ...prev, [id]: value }))
                }
                onSubmit={handleSubmitAnswer}
              />
            )}

            {activeTab === "history" && <HistoryList requests={requests} />}

            {activeTab === "learned" && (
              <LearnedAnswers answers={learnedAnswers} />
            )}

            {activeTab === "knowledge" && (
              <KnowledgeBase
                items={knowledgeBase}
                editingItem={editingItem}
                editForm={editForm}
                isAddingNew={isAddingNew}
                newItemForm={newItemForm}
                onEdit={handleEditItem}
                onSave={handleSaveEdit}
                onCancel={() => {
                  setEditingItem(null);
                  setEditForm({ question: "", answer: "" });
                }}
                onDelete={handleDeleteItem}
                onAddNew={() => setIsAddingNew(true)}
                onCreateNew={handleAddNew}
                onCancelNew={() => {
                  setIsAddingNew(false);
                  setNewItemForm({ question: "", answer: "" });
                }}
                onEditFormChange={(field, value) =>
                  setEditForm((prev) => ({ ...prev, [field]: value }))
                }
                onNewFormChange={(field, value) =>
                  setNewItemForm((prev) => ({ ...prev, [field]: value }))
                }
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SupervisorDashboard;
