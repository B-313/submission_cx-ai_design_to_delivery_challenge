import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Register", num: 1 },
  { label: "Brief", num: 2 },
  { label: "Design", num: 3 },
  { label: "Builder", num: 4 },
  { label: "Submit", num: 5 },
];

const LeftSidebar = () => {
  const { step, maxStep, user, submitted, goToStep, notes, setNotes } = useWorkspace();

  const handleNav = (idx: number) => {
    if (submitted) return;
    if (idx > maxStep + 1 && idx > 0) return;
    goToStep(idx);
  };

  return (
    <aside className="w-[200px] flex-shrink-0 bg-gradient-to-b from-[hsl(220,60%,15%)] to-[hsl(220,50%,10%)] flex flex-col overflow-hidden">
      {user && (
        <div className="px-3 py-3 border-b border-white/10">
          <div className="font-serif text-[14px] text-white">{user.firstName} {user.lastName}</div>
          <div className="text-[10px] text-white/50 leading-relaxed">
            {user.department}<br />{user.empNumber} · {user.country}
          </div>
        </div>
      )}

      <div className="flex-1 p-2 overflow-y-auto">
        <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/30 px-1.5 mb-1.5">Workflow</div>
        {STEPS.map((s, i) => {
          const isDone = i < step;
          const isActive = i === step;
          const isLocked = i > maxStep + 1 && i > 0;

          return (
            <button
              key={i}
              onClick={() => handleNav(i)}
              disabled={isLocked || submitted}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium transition-all mb-0.5 relative select-none text-left",
                isActive && "bg-white/12 text-white font-semibold",
                isDone && !isActive && "text-white/70",
                !isActive && !isDone && !isLocked && "text-white/40 hover:bg-white/8 hover:text-white/70",
                isLocked && "opacity-25 cursor-not-allowed text-white/30"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-[20%] bottom-[20%] w-[2px] rounded-r bg-primary" />
              )}
              <div
                className={cn(
                  "w-[18px] h-[18px] rounded-full border-[1.5px] text-[9px] font-extrabold flex items-center justify-center flex-shrink-0 transition-all",
                  isActive && "bg-primary border-primary text-primary-foreground",
                  isDone && !isActive && "bg-success border-success text-success-foreground",
                  !isActive && !isDone && "border-white/30"
                )}
              >
                {isDone && !isActive ? "✓" : s.num}
              </div>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {submitted && (
        <div className="bg-white/8 border-t border-white/10 p-3">
          <div className="text-[11px] font-bold text-white mb-1">Submitted</div>
          <div className="text-[10px] text-white/50 leading-relaxed">
            Your project is with the IT review team.
          </div>
          {user && <div className="text-[10px] font-bold text-primary mt-1 break-all">{user.email}</div>}
        </div>
      )}

      <div className="border-t border-white/10 p-2 flex-shrink-0">
        <div className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-1">Notes</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Jot notes…"
          className="w-full h-16 text-[11px] bg-white/8 border border-white/10 rounded-md p-2 resize-none outline-none focus:border-primary transition-colors text-white/70 placeholder:text-white/20"
        />
      </div>
    </aside>
  );
};

export default LeftSidebar;
