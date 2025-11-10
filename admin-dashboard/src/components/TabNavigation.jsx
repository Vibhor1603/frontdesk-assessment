export function TabNavigation({ activeTab, onTabChange }) {
  const tabs = ["pending", "history", "learned", "knowledge"];

  return (
    <div className="flex gap-2 mb-8 flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
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
  );
}
