import { useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const PCTS = [0, 20, 45, 65, 100];

const Header = () => {
  const { step, user } = useWorkspace();
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

  return (
    <>
      <header className="h-[68px] flex-shrink-0 bg-header-gradient flex items-center px-5 gap-4 shadow-[0_2px_10px_rgba(0,26,77,0.3)] z-50">
        <span className="font-serif text-[24px] text-white tracking-wide leading-none">Pfizer</span>
        <div className="w-px h-[24px] bg-white/25" />
        <span className="text-[13px] font-medium text-white/85 tracking-wide">Design-to-Delivery Accelerator</span>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="bg-white/15 border border-white/20 rounded-full px-3 py-1 text-[12px] font-semibold text-white/90">
            CXI+AI · University of Liverpool
          </span>
          {user && (
            <div className="flex items-center gap-2.5 bg-white/12 border border-white/20 rounded-full py-1.5 px-3">
              <div className="w-[34px] h-[34px] rounded-full bg-white/25 text-white text-[12px] font-bold flex items-center justify-center">
                {(user.firstName[0] + user.lastName[0]).toUpperCase()}
              </div>
              <div className="leading-tight">
                <div className="text-[13px] font-semibold text-white/95">
                  Welcome to your workspace {user.firstName}
                </div>
                <div className="text-[12px] text-white/80">
                  {dateText} · {timeText}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="h-[46px] flex-shrink-0 bg-card border-b border-border flex items-center px-5 gap-1.5 shadow-pf overflow-x-auto">
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0 pl-3">
          <div className="flex items-center gap-1.5">
            <div className="w-[100px] h-[7px] bg-muted rounded-full overflow-hidden border border-border">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${PCTS[step]}%`,
                  background: "linear-gradient(90deg, #DC2626 0%, #F59E0B 33%, #84CC16 66%, #059669 100%)",
                  backgroundSize: "300px",
                }}
              />
            </div>
            <span className="text-xs font-bold text-pf-dark whitespace-nowrap">{PCTS[step]}%</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;
