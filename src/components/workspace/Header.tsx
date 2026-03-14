import { useWorkspace } from "@/contexts/WorkspaceContext";

const STEPS = ["Register", "Preliminary", "Brief", "Builder", "Review", "Submit"];
const PCTS = [0, 17, 34, 55, 78, 100];

const Header = () => {
  const { step, user } = useWorkspace();

  return (
    <>
      <header className="h-[52px] flex-shrink-0 bg-header-gradient flex items-center px-5 gap-3.5 shadow-[0_2px_10px_rgba(0,26,77,0.3)] z-50">
        <span className="font-serif text-[19px] text-white tracking-wide">Pfizer</span>
        <div className="w-px h-[18px] bg-white/25" />
        <span className="text-xs font-medium text-white/80 tracking-wider">Design-to-Delivery Accelerator</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="bg-white/15 border border-white/20 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white/90">
            CXI+AI · University of Liverpool
          </span>
          {user && (
            <div className="flex items-center gap-1.5 bg-white/12 border border-white/20 rounded-full py-1 px-2.5">
              <div className="w-[26px] h-[26px] rounded-full bg-white/25 text-white text-[10px] font-bold flex items-center justify-center">
                {(user.firstName[0] + user.lastName[0]).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-white/90">{user.firstName}</span>
            </div>
          )}
        </div>
      </header>

      {/* Project bar */}
      <div className="h-[46px] flex-shrink-0 bg-card border-b border-border flex items-center px-5 gap-1.5 shadow-pf overflow-x-auto">
        {user && (
          <>
            <ProjectPill label="Owner" value={`${user.firstName} ${user.lastName}`} />
            <ProjectPill label="Region" value={user.country} />
          </>
        )}
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

function ProjectPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1 px-3 py-1 bg-secondary border border-border rounded-full text-[11px] whitespace-nowrap flex-shrink-0">
      <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">{label}</span>
      <span className="font-semibold text-pf-dark">{value}</span>
    </div>
  );
}

export default Header;
