import { formatTimestamp } from "../utils/formatters";

export function HistoryList({ requests }) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">No history yet</div>
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
            <div className="text-white mb-2">{request.question}</div>
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
      ))}
    </div>
  );
}
