import React, { useState, useEffect } from "react";
import { BellIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

export default function Dashboard() {
  const [helpRequests, setHelpRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [answer, setAnswer] = useState("");
  const [isAnswering, setIsAnswering] = useState(false);

  useEffect(() => {
    fetchHelpRequests();
    // Poll for new requests every 30 seconds
    const interval = setInterval(fetchHelpRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchHelpRequests = async () => {
    try {
      const response = await fetch(
        "http://localhost:3000/api/knowledge/help-requests"
      );
      if (!response.ok) throw new Error("Failed to fetch help requests");
      const data = await response.json();
      setHelpRequests(data);
    } catch (error) {
      console.error("Error fetching help requests:", error);
    }
  };

  const handleAnswerSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !answer.trim()) return;

    try {
      setIsAnswering(true);
      const response = await fetch(
        `http://localhost:3000/api/knowledge/help-requests/${selectedRequest.id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer }),
        }
      );

      if (!response.ok) throw new Error("Failed to submit answer");

      // Update local state
      setHelpRequests((prev) =>
        prev.map((req) =>
          req.id === selectedRequest.id
            ? { ...req, status: "resolved", answer }
            : req
        )
      );

      setSelectedRequest(null);
      setAnswer("");
    } catch (error) {
      console.error("Error submitting answer:", error);
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div className="min-h-screen bg-dashboard-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-white">
            Supervisor Dashboard
          </h1>
          <div className="relative">
            <BellIcon className="h-6 w-6 text-gray-400" />
            {helpRequests.filter((r) => r.status === "pending").length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center text-xs text-white">
                {helpRequests.filter((r) => r.status === "pending").length}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pending Requests */}
          <div className="bg-dashboard-light rounded-lg p-6">
            <h2 className="text-lg font-medium text-white mb-4">
              Pending Requests
            </h2>
            <div className="space-y-4">
              {helpRequests
                .filter((req) => req.status === "pending")
                .map((request) => (
                  <div
                    key={request.id}
                    className="bg-dashboard-darker rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-blue-500 transition"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-300">
                          Room: {request.room_name}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          {request.question}
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                          {new Date(request.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Answer Form */}
          {selectedRequest && (
            <div className="bg-dashboard-light rounded-lg p-6">
              <h2 className="text-lg font-medium text-white mb-4">
                Provide Answer
              </h2>
              <form onSubmit={handleAnswerSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Question
                  </label>
                  <p className="text-gray-400 bg-dashboard-darker rounded-lg p-3">
                    {selectedRequest.question}
                  </p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Your Answer
                  </label>
                  <textarea
                    rows="4"
                    className="w-full bg-dashboard-darker text-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
                    onClick={() => {
                      setSelectedRequest(null);
                      setAnswer("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAnswering}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-dashboard-light disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAnswering ? "Submitting..." : "Submit Answer"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Resolved Requests */}
          <div className="bg-dashboard-light rounded-lg p-6 lg:col-span-2">
            <h2 className="text-lg font-medium text-white mb-4">
              Resolved Requests
            </h2>
            <div className="space-y-4">
              {helpRequests
                .filter((req) => req.status === "resolved")
                .map((request) => (
                  <div
                    key={request.id}
                    className="bg-dashboard-darker rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-gray-300">
                            Room: {request.room_name}
                          </p>
                          <CheckCircleIcon className="h-5 w-5 text-green-500 ml-2" />
                        </div>
                        <p className="mt-1 text-sm text-gray-400">
                          Q: {request.question}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          A: {request.answer}
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                          {new Date(request.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
