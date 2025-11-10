import { formatTimestamp } from "../utils/formatters";

export function PendingRequests({
  requests,
  answerText,
  submitting,
  onAnswerChange,
  onSubmit,
}) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <div className="text-4xl mb-4">🎉</div>
        <div>No pending requests</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
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
              <div className="text-lg text-white mb-4">{request.question}</div>
            </div>
          </div>

          <div className="space-y-3">
            <textarea
              value={answerText[request.id] || ""}
              onChange={(e) => onAnswerChange(request.id, e.target.value)}
              placeholder="Type your answer..."
              className="w-full bg-white/5 text-white rounded-xl p-4 focus:bg-white/10 focus:outline-none resize-none placeholder-gray-500"
              rows={3}
            />
            <button
              onClick={() => onSubmit(request.id)}
              disabled={submitting === request.id}
              className="px-6 py-3 bg-white text-black hover:bg-gray-200 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-xl transition-all font-medium"
            >
              {submitting === request.id ? "Submitting..." : "Submit Answer"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
