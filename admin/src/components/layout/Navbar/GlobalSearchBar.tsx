export function GlobalSearchBar() {
  return (
    <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
      <div className="relative w-full">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm">
          <span className="material-symbols-outlined">search</span>
        </span>
        <input
          type="text"
          placeholder="노드, 로그, 액션을 검색하세요"
          className="w-full pl-11 pr-3 py-2 bg-[#1E293B] border border-slate-700 rounded shadow-sm text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/20 transition"
        />
      </div>
    </div>
  );
}
