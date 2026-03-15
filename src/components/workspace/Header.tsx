import { useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const PCTS = [0, 18, 36, 58, 82, 100];
const STEPS = ["Register", "Ideation", "Brief", "Builder", "Review", "Submit"];

const Header = () => {
  const {
    step,
    user,
    submitted,
    goToStep,
    reviewData,
    reviewDecisions,
    pieApproved,
    currentBrief,
    layout,
    materials,
    removeMaterial,
  } = useWorkspace();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!user) return;
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, [user]);

  const dateText = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now);

  const timeText = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);

  const allReviewIssues = reviewData ? [...reviewData.complianceIssues, ...reviewData.grammarIssues] : [];
  const allDecided = allReviewIssues.length > 0 && allReviewIssues.every(i => Boolean(reviewDecisions[i.id]));
  const reviewPassed = (reviewData?.overallScore || 0) >= 70 && allDecided;

  const completion = [
    Boolean(user),
    Boolean(currentBrief),
    Boolean(pieApproved && currentBrief),
    Boolean(layout && currentBrief),
    Boolean(reviewPassed),
    Boolean(submitted),
  ];

  const canEnter = (idx: number) => {
    if (submitted) return false;
    if (idx === 0) return true;
    return completion[idx - 1];
  };

  const handleNav = (idx: number) => {
    if (submitted) return;
    if (!canEnter(idx) && idx !== step) return;
    goToStep(idx);
  };

  return (
    <>
      <header className="min-h-[84px] flex-shrink-0 bg-card border-b border-border flex items-center px-5 py-3 gap-4 shadow-pf z-50">
        <span className="font-serif text-[26px] text-pf-dark tracking-wide leading-none">Company Name</span>
        <div className="w-px h-[24px] bg-border" />
        <span className="text-[13px] font-medium text-muted-foreground tracking-wide">
          Design-to-Delivery Accelerator <span className="text-pf-dark font-semibold">· Prompt Intelligence Engine</span>
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="bg-pf-mist border border-pf-sky rounded-full px-3 py-1 text-[12px] font-semibold text-pf-dark">
            CXI+AI · University of Liverpool
          </span>
          {user && (
            <div className="flex items-center gap-2.5 bg-secondary border border-border rounded-full py-1.5 px-3">
              <div className="w-[34px] h-[34px] rounded-full bg-pf-dark text-white text-[12px] font-bold flex items-center justify-center">
                {(user.firstName[0] + user.lastName[0]).toUpperCase()}
              </div>
              <div className="leading-tight">
                <div className="text-[13px] font-semibold text-pf-dark">
                  Welcome to your workspace {user.firstName}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {dateText} · {timeText}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex-shrink-0 bg-card border-b border-border/80 px-4 py-3 overflow-x-auto">
        <div className="flex items-center gap-3 min-w-max">
          <div className="flex items-center gap-1.5 pr-2 border-r border-border">
            <div className="w-[110px] h-[7px] bg-muted rounded-full overflow-hidden border border-border">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${PCTS[step]}%`,
                  background: "linear-gradient(90deg, #DC2626 0%, #F59E0B 33%, #84CC16 66%, #059669 100%)",
                }}
              />
            </div>
            <span className="text-xs font-bold text-pf-dark whitespace-nowrap">{PCTS[step]}%</span>
          </div>

          <div className="flex items-center gap-1.5">
            {STEPS.map((label, idx) => {
              const isDone = completion[idx] || (idx === 5 && submitted);
              const isActive = idx === step;
              const isLocked = !canEnter(idx) && !isActive;

              return (
                <button
                  key={label}
                  onClick={() => handleNav(idx)}
                  disabled={isLocked || submitted}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    isActive && "border-primary bg-primary/10 text-pf-dark",
                    isDone && !isActive && "border-success/30 bg-success-light text-success",
                    !isActive && !isDone && !isLocked && "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary",
                    isLocked && "opacity-40 cursor-not-allowed border-border text-muted-foreground/70"
                  )}
                >
                  <span className="text-[10px] font-extrabold">{isDone && !isActive ? "✓" : idx + 1}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="pl-2 border-l border-border flex items-center gap-1.5 min-w-[280px]">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground/70">Materials</span>
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[520px]">
              {materials.length === 0 ? (
                <span className="text-[11px] text-muted-foreground/60">No uploaded materials</span>
              ) : materials.map((m) => (
                <div key={m.id} className="flex items-center gap-1 bg-secondary border border-border rounded-full pl-2 pr-1 py-1">
                  <span className="text-[11px] font-semibold text-foreground truncate max-w-[170px]" title={m.source}>{m.name}</span>
                  <button
                    onClick={() => removeMaterial(m.id)}
                    className="text-muted-foreground hover:text-destructive p-0.5"
                    title="Remove material"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;
