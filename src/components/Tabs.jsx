export default function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-800/70 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-all duration-150 ${
            activeTab === tab.id
              ? 'bg-slate-600/80 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
