import { useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

const SubmitPanel = () => {
  const ws = useWorkspace();
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = () => {
    if (!agreed) return;
    ws.setSubmitted();
    toast.success("Project submitted for review!");
  };

  return (
    <div className="flex-1 flex items-center justify-center overflow-y-auto p-7 animate-fade-up">
      <div className="bg-card border-[1.5px] border-border rounded-[20px] shadow-pf-md p-9 max-w-[500px] w-full">
        <h2 className="font-serif text-xl text-pf-dark mb-1">Submit for Review</h2>
        <p className="text-[13px] text-muted-foreground mb-5">
          Your project will be sent to the IT review team for final approval.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <MetaBox label="Type" value={ws.prelim.buildType || "—"} />
          <MetaBox label="Audience" value={ws.prelim.audience || "—"} />
          <MetaBox label="Region" value={ws.user?.country || "—"} />
          <MetaBox label="Score" value={ws.reviewData ? `${ws.reviewData.overallScore}/100` : "—"} />
        </div>

        <div className="bg-secondary border border-border rounded-md p-3 text-[12.5px] text-muted-foreground leading-relaxed max-h-[120px] overflow-y-auto mb-3">
          By submitting this project, I confirm that all content has been reviewed for brand compliance,
          accessibility standards (WCAG 2.1 AA), and regulatory requirements applicable to the target
          jurisdiction. I understand that the IT review team will perform a final assessment before
          publication. Any content flagged during the automated review has been addressed or acknowledged.
          This submission is subject to Pfizer's internal content governance policy.
        </div>

        <label className="flex items-center gap-2.5 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            className="w-[15px] h-[15px] accent-primary cursor-pointer"
          />
          <span className="text-[13px] font-medium text-foreground">I agree to the terms and conditions</span>
        </label>

        <button
          onClick={handleSubmit}
          disabled={!agreed}
          className="w-full bg-btn-gradient text-primary-foreground rounded-md py-3 text-sm font-bold shadow-pf hover:shadow-pf-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit for Review
        </button>
      </div>
    </div>
  );
};

function MetaBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary border border-border rounded-md p-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5">{label}</div>
      <div className="text-[13px] font-semibold text-foreground">{value}</div>
    </div>
  );
}

export default SubmitPanel;
