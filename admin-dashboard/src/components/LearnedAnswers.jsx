import { formatTimestamp } from "../utils/formatters";

export function LearnedAnswers({ answers }) {
  if (answers.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        No learned answers yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {answers.map((item) => (
        <div
          key={item.id}
          className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/10 transition-all"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="text-sm text-gray-500">
              {formatTimestamp(item.created_at)}
            </div>
            <div className="text-xs text-gray-500">Used {item.times_used}x</div>
          </div>

          <div className="mb-4">
            <div className="text-white mb-2">{item.question}</div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <div className="text-green-400">{item.answer}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
