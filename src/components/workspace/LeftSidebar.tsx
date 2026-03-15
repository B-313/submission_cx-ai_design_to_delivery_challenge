import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Register", num: 1 },
  { label: "Type Brief", num: 2 },
  { label: "Design", num: 3 },
  { label: "Edit + Preview", num: 4 },
  { label: "Submit", num: 5 },
];

const LeftSidebar = () => {
  const { step, maxStep, submitted, goToStep, notes, setNotes } = useWorkspace();

  const handleNav = (idx: number) => {
    if (submitted) return;
    if (idx > maxStep + 1 && idx > 0) return;
    goToStep(idx);
  };

  return (
    <aside className="w-[200px] flex-shrink-0 bg-card border-r border-border flex flex-col overflow-hidden">

      <div className="flex-1 p-1.5 overflow-y-auto">
        <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70 px-1.5 mb-1.5">Workflow</div>
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
                "w-full flex items-center gap-1.5 px-1.5 py-1.5 rounded-md text-[11px] font-medium transition-all mb-0.5 relative select-none text-left",
                isActive && "bg-primary/10 text-pf-dark font-semibold",
                isDone && !isActive && "text-foreground",
                !isActive && !isDone && !isLocked && "text-muted-foreground hover:bg-secondary hover:text-foreground",
                isLocked && "opacity-35 cursor-not-allowed text-muted-foreground/60"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-[20%] bottom-[20%] w-[2px] rounded-r bg-primary" />
              )}
              <div
                className={cn(
                  "w-[16px] h-[16px] rounded-full border-[1.5px] text-[8px] font-extrabold flex items-center justify-center flex-shrink-0 transition-all",
                  isActive && "bg-primary border-primary text-primary-foreground",
                  isDone && !isActive && "bg-success border-success text-success-foreground",
                  !isActive && !isDone && "border-border text-muted-foreground"
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
        <div className="bg-success-light border-t border-success/20 p-3">
          <div className="text-[11px] font-bold text-success mb-1">Submitted</div>
          <div className="text-[10px] text-muted-foreground leading-relaxed">
            Your project is with the IT review team.
          </div>
        </div>
      )}

      <div className="border-t border-border p-2 flex-shrink-0">
        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">Notes</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Jot notes…"
          className="w-full h-16 text-[11px] bg-secondary border border-border rounded-md p-2 resize-none outline-none focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground/60"
        />
      </div>
    </aside>
  );
};

export default LeftSidebar;
