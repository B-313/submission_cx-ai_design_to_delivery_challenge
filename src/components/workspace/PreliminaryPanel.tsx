import { useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";

const BUILD_OPTIONS = [
  { label: "Website", desc: "Multi-page site with navigation and distinct sections" },
  { label: "Webpage", desc: "Single page focused on one topic or campaign" },
  { label: "Landing Page", desc: "Conversion-focused page with a single CTA" },
  { label: "Microsite", desc: "Small standalone site for a specific initiative" },
];

const AUDIENCE_OPTIONS = [
  { label: "Patients", desc: "General public seeking health information (Grade 7-8 reading)" },
  { label: "Healthcare Providers", desc: "Doctors, nurses, pharmacists (clinical language OK)" },
  { label: "Channel Partners", desc: "Distributors, wholesalers (business professional tone)" },
  { label: "Internal Teams", desc: "Pfizer employees and stakeholders (corporate tone)" },
];

const PreliminaryPanel = () => {
  const { user, goToStep, setPrelim } = useWorkspace();
  const [build, setBuild] = useState<string | null>(null);
  const [audience, setAudience] = useState<string | null>(null);

  const canContinue = build && audience;

  const handleConfirm = () => {
    if (!canContinue) return;
    setPrelim({ buildType: build, audience });
    goToStep(2);
  };

  return (
    <div className="flex-1 overflow-y-auto p-7 flex flex-col gap-4 animate-fade-up">
      <div>
        <h2 className="font-serif text-xl text-pf-dark">
          Let's set up your project{user ? `, ${user.firstName}` : ""}
        </h2>
        <p className="text-[13px] text-muted-foreground">Select your options — these personalise every step.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChipGroup
          title="What are you building?"
          options={BUILD_OPTIONS}
          selected={build}
          onSelect={setBuild}
        />
        <ChipGroup
          title="Target Audience"
          options={AUDIENCE_OPTIONS}
          selected={audience}
          onSelect={setAudience}
        />
      </div>

      <div className="flex justify-end mt-2">
        <button
          onClick={handleConfirm}
          disabled={!canContinue}
          className="bg-btn-gradient text-primary-foreground rounded-md px-6 py-2.5 text-[13px] font-bold shadow-pf hover:shadow-pf-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirm & Continue →
        </button>
      </div>
    </div>
  );
};

function ChipGroup({ title, options, selected, onSelect }: {
  title: string;
  options: { label: string; desc: string }[];
  selected: string | null;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="bg-card border-[1.5px] border-border rounded-lg p-4 shadow-pf">
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60 mb-3">{title}</div>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt.label}
            onClick={() => onSelect(opt.label)}
            className={cn(
              "px-3.5 py-1.5 rounded-full border-[1.5px] text-xs font-medium transition-all select-none",
              selected === opt.label
                ? "bg-primary border-primary text-primary-foreground shadow-[0_2px_6px_hsla(200,100%,41%,0.3)]"
                : "bg-secondary border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-pf-mist"
            )}
            title={opt.desc}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {selected && (
        <p className="text-[11px] text-muted-foreground mt-2">
          {options.find(o => o.label === selected)?.desc}
        </p>
      )}
    </div>
  );
}

export default PreliminaryPanel;
