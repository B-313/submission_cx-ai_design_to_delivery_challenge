import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Register", num: 1 },
  { label: "Preliminary", num: 2 },
  { label: "Brief", num: 3 },
  { label: "Builder", num: 4 },
  { label: "Review", num: 5 },
  { label: "Submit", num: 6 },
];

const AGENT_LABELS: Record<number, string> = {
  2: "Agent 1 · PIE",
  3: "Agent 2 · Brief Gen",
  4: "Agent 3 · Builder",
  5: "Agent 4 · Review",
};

const LeftSidebar = () => {
  const { step, maxStep, user, submitted, goToStep, notes, setNotes, activeAgent } = useWorkspace();

  const handleNav = (idx: number) => {
    if (submitted) return;
    if (idx > maxStep + 1 && idx > 0) return;
    goToStep(idx);
  };

  return (
    <aside className="w-[220px] flex-shrink-0 bg-card border-r border-border flex flex-col overflow-hidden">
      {/* User card */}
      {user && (
        <div className="px-3.5 py-3 border-b border-border">
          <div className="font-serif text-[15px] text-pf-dark">{user.firstName} {user.lastName}</div>
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            {user.department}<br />{user.empNumber} · {user.country}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 p-2.5 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/50 px-1.5 mb-1.5">Workflow</div>
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
                "w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all mb-0.5 relative select-none text-left",
                isActive && "bg-pf-mist text-pf-dark font-semibold",
                isDone && !isActive && "text-foreground",
                !isActive && !isDone && !isLocked && "text-muted-foreground hover:bg-secondary hover:text-foreground",
                isLocked && "opacity-40 cursor-not-allowed"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r bg-primary" />
              )}
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-[1.5px] text-[10px] font-extrabold flex items-center justify-center flex-shrink-0 transition-all",
                  isActive && "bg-primary border-primary text-primary-foreground",
                  isDone && !isActive && "bg-success border-success text-success-foreground",
                  !isActive && !isDone && "border-current"
                )}
              >
                {isDone && !isActive ? "✓" : s.num}
              </div>
              <span>{s.label}</span>
              {AGENT_LABELS[i] && isActive && (
                <span className="ml-auto text-[9px] font-bold text-primary agent-pulse">●</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Submitted lock */}
      {submitted && (
        <div className="bg-pf-mist border-t border-pf-sky p-3.5">
          <div className="text-xs font-bold text-pf-dark mb-1">Submitted for Review</div>
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            Your project is with the IT review team. You will receive an update at:
          </div>
          {user && <div className="text-[11px] font-bold text-primary mt-1 break-all">{user.email}</div>}
        </div>
      )}

      {/* Notes */}
      <div className="border-t border-border p-2.5 flex-shrink-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1">Notes</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Jot notes here…"
          className="w-full h-20 text-[12px] bg-secondary border border-border rounded-md p-2 resize-none outline-none focus:border-primary transition-colors text-foreground"
        />
      </div>
    </aside>
  );
};

export default LeftSidebar;
