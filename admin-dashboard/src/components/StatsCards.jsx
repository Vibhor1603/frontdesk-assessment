export function StatsCards({ stats }) {
  if (!stats) return null;

  return (
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
  );
}
