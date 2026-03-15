import { useEffect } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

const ReviewPanel = () => {
  const ws = useWorkspace();

  useEffect(() => {
    if (ws.step === 3 && !ws.reviewData && !ws.loading) {
      runReview();
    }
  }, [ws.step]);

  const runReview = async () => {
    ws.setLoading(true);
    ws.setActiveAgent(4);
    try {
      const { data, error } = await supabase.functions.invoke("review-content", {
        body: {
          brief: ws.currentBrief,
          buildType: ws.prelim.buildType,
          audience: ws.prelim.audience,
          country: ws.user?.country,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      ws.setReviewData(data);
      toast.success("Review complete — approve or decline each finding");
    } catch (err: any) {
      toast.error(err.message || "Review failed");
    } finally {
      ws.setLoading(false);
      ws.setActiveAgent(null);
    }
  };

  const review = ws.reviewData;
  const allDecided = review
    ? [...review.complianceIssues, ...review.grammarIssues].every(i => ws.reviewDecisions[i.id])
    : false;
  const score = review?.overallScore || 0;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const scoreColor = score >= 90 ? "hsl(153,69%,27%)" : score >= 70 ? "hsl(200,100%,41%)" : score >= 50 ? "hsl(30,100%,31%)" : "hsl(0,72%,51%)";

  if (ws.loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="inline-flex items-center gap-3 bg-pf-mist border border-pf-sky rounded-lg px-6 py-4">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-sm text-pf-dark font-medium">Running compliance & grammar checks…</span>
        </div>
      </div>
    );
  }

  if (!review) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-up">
      <div className="bg-card border-b border-border px-5 py-2.5 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => ws.goToStep(3)}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Builder
        </button>
        <span className="font-serif text-[17px] text-pf-dark flex-1">Review & Remediate</span>
        <span className={cn(
          "px-3.5 py-1 rounded-full text-[13px] font-bold border-[1.5px]",
          score >= 90 ? "bg-success-light border-success/25 text-success" : score >= 70 ? "bg-warning-light border-warning/25 text-warning" : "bg-destructive/10 border-destructive/25 text-destructive"
        )}>
          {score}/100
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-center gap-5 bg-card border border-border rounded-lg p-5 shadow-pf">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" stroke="hsl(214,20%,85%)" strokeWidth="8" fill="none" />
              <motion.circle cx="60" cy="60" r="54" stroke={scoreColor} strokeWidth="8" fill="none" strokeLinecap="round"
                strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1, ease: "easeOut" }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-pf-dark">{score}</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-foreground mb-1">Overall Quality Score</div>
            <p className="text-[13px] text-muted-foreground mb-3">
              {score >= 90 ? "Ready for submission" : score >= 70 ? "Review recommended issues below" : "Significant issues need attention"}
            </p>
            <div className="space-y-1">
              {Object.entries(review.scores).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-20 flex-shrink-0 capitalize">{key === "brandVoice" ? "Brand Voice" : key}</span>
                  <div className="flex-1 h-[5px] bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${val}%`,
                      background: val >= 80 ? "hsl(153,69%,27%)" : val >= 60 ? "hsl(30,100%,31%)" : "hsl(0,72%,51%)",
                    }} />
                  </div>
                  <span className="w-7 text-right font-bold text-[11px]">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {[
          { title: "Compliance Issues", issues: review.complianceIssues },
          { title: "Grammar Issues", issues: review.grammarIssues },
        ].map(section => (
          <div key={section.title} className="bg-card border border-border rounded-lg overflow-hidden shadow-pf">
            <div className="px-4 py-3 border-b border-border bg-secondary flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex-1">{section.title}</span>
              <span className={cn(
                "text-[11px] font-bold px-2 py-0.5 rounded-full",
                section.issues.length === 0 ? "bg-success-light text-success" : "bg-destructive/10 text-destructive"
              )}>{section.issues.length}</span>
            </div>
            <div className="p-4 space-y-3">
              {section.issues.map(issue => {
                const decision = ws.reviewDecisions[issue.id];
                return (
                  <div key={issue.id} className={cn(
                    "border border-border rounded-lg overflow-hidden transition-all",
                    decision === "approved" && "border-success bg-success-light opacity-70",
                    decision === "declined" && "opacity-40",
                  )}>
                    <div className={cn(
                      "px-3.5 py-2.5 flex items-start gap-2.5 border-b border-border",
                      issue.severity === "high" ? "bg-destructive/5" : issue.severity === "medium" ? "bg-warning-light" : "bg-pf-mist"
                    )}>
                      <span className={cn(
                        "text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5",
                        issue.severity === "high" ? "bg-destructive/15 text-destructive" : issue.severity === "medium" ? "bg-warning/12 text-warning" : "bg-primary/12 text-primary"
                      )}>{issue.severity}</span>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-foreground">{issue.field}</div>
                        <div className="text-[13px] text-muted-foreground mt-0.5">{issue.issue}</div>
                      </div>
                    </div>
                    <div className="px-3.5 py-3">
                      {issue.contentSnippet && (
                        <div className="bg-card border border-border rounded-md px-3 py-2 mb-2 text-[13px] text-foreground border-l-[3px] border-l-warning">
                          "{issue.contentSnippet}"
                        </div>
                      )}
                      <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground/50 mb-1">Recommendation</div>
                      <div className="text-[13px] text-success font-semibold bg-success-light rounded-md px-2.5 py-1.5 mb-3">{issue.recommendation}</div>
                      {!decision ? (
                        <div className="flex gap-2">
                          <button onClick={() => ws.setReviewDecision(issue.id, "approved")}
                            className="flex-1 bg-success text-success-foreground rounded-md py-1.5 text-xs font-bold hover:opacity-90">Accept</button>
                          <button onClick={() => ws.setReviewDecision(issue.id, "declined")}
                            className="flex-1 bg-card border border-border rounded-md py-1.5 text-xs font-semibold text-muted-foreground hover:border-foreground hover:text-foreground">Decline</button>
                        </div>
                      ) : (
                        <div className={cn("text-xs font-bold text-center py-1", decision === "approved" ? "text-success" : "text-muted-foreground")}>
                          {decision === "approved" ? "✓ Accepted" : "✕ Declined"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {score < 90 && (
          <div className="bg-destructive/5 border-[1.5px] border-destructive/25 rounded-lg p-4 text-[13px] text-destructive font-semibold">
            Score is below 90% threshold. Review and accept recommendations above, then re-run to improve.
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button onClick={() => ws.goToStep(3)} className="border border-border rounded-md px-4 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary flex items-center gap-1.5">
              <ArrowLeft className="w-3 h-3" /> Back to Builder
            </button>
            <button onClick={runReview} className="border border-border rounded-md px-4 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary">
              Re-run Review
            </button>
          </div>
          <button
            onClick={() => ws.goToStep(4)}
            disabled={!allDecided}
            className="bg-btn-gradient text-primary-foreground rounded-md px-5 py-2 text-sm font-bold shadow-pf disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Proceed to Submit →
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewPanel;
