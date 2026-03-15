import { useWorkspace } from "@/contexts/WorkspaceContext";
import BriefAccordion from "./BriefAccordion";
import { Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

const BRIEF_DRAFT_KEY = "pfizer_brief_editor_draft_v1";

const BriefDisplayPanel = () => {
  const ws = useWorkspace();
  const { currentBrief, goToStep, approvePie, setCurrentBrief } = ws;

  const handleApprove = () => {
    approvePie();
    localStorage.removeItem(BRIEF_DRAFT_KEY);
    toast.success("Brief approved — choose your design");
    goToStep(3);
  };

  if (!currentBrief) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 animate-fade-up">
        <div className="max-w-md text-center">
          <p className="text-[13px] text-muted-foreground mb-4">
            No brief generated yet. Go back to Ideation to create one.
          </p>
          <button
            onClick={() => goToStep(1)}
            className="flex items-center gap-1.5 mx-auto text-xs font-semibold text-primary hover:text-pf-dark"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Ideation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-up">
      {/* Top bar */}
      <div className="bg-card border-b border-border px-5 py-2 flex items-center gap-2.5 flex-shrink-0">
        <button
          onClick={() => goToStep(1)}
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary mr-2"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Ideation
        </button>
        <div className="text-[13px] font-semibold text-pf-dark flex-1">Generated Brief</div>
        <button
          onClick={handleApprove}
          className="bg-success text-success-foreground rounded-md px-4 py-1.5 text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          <Check className="w-3 h-3" /> Approve Brief →
        </button>
      </div>

      {/* Summary banner */}
      <div className="bg-pf-mist border-b border-pf-sky px-6 py-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-pf-dark/70 mb-0.5">
            Brief Summary
          </div>
          <p className="text-[13px] text-foreground leading-relaxed">
            <span className="font-semibold">{currentBrief.projectTitle}</span> — {currentBrief.goal}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {currentBrief.contentSections.length} content sections · {currentBrief.keyMessages.length} key messages
          </p>
        </div>
      </div>

      {/* Editable accordion */}
      <div className="flex-1 overflow-y-auto">
        <BriefAccordion brief={currentBrief} onUpdate={setCurrentBrief} />
      </div>

      {/* Footer */}
      <div className="bg-card border-t border-border px-6 py-3 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => goToStep(1)}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Ideation
        </button>
        <button
          onClick={handleApprove}
          className="bg-success text-success-foreground rounded-md px-5 py-2 text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          <Check className="w-3 h-3" /> Approve Brief →
        </button>
      </div>
    </div>
  );
};

export default BriefDisplayPanel;
