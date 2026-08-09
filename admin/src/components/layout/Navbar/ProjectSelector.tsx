import { useState } from 'react';

export function ProjectSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState('Default-Crawler-Cluster');

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 bg-slate-900/70 hover:bg-slate-800 px-3 py-1 rounded text-xs text-white border border-slate-700 transition"
      >
        <span className="material-symbols-outlined text-sm">workspace_premium</span>
        <span className="font-semibold">{selectedProject}</span>
        <span className="material-symbols-outlined text-[10px]">expand_more</span>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-[#111827] shadow-lg border border-slate-700 rounded text-xs text-slate-100 z-50">
          <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">
            프로젝트 선택
          </div>
          <button
            onClick={() => {
              setSelectedProject('Default-Crawler-Cluster');
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 flex justify-between items-center"
          >
            <span>Default-Crawler-Cluster</span>
            {selectedProject === 'Default-Crawler-Cluster' && (
              <span className="text-[#1A73E8] text-[10px]">✓ 선택됨</span>
            )}
          </button>
          <button
            onClick={() => {
              setSelectedProject('Staging-Crawler-Cluster');
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 flex justify-between items-center text-slate-300"
          >
            <span>Staging-Crawler-Cluster</span>
            {selectedProject === 'Staging-Crawler-Cluster' && (
              <span className="text-[#1A73E8] text-[10px]">✓ 선택됨</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
