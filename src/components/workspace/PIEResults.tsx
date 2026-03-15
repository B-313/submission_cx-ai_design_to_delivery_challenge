import { motion } from "framer-motion";
import type { PIEResult } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";

interface PIEResultsProps {
  result: PIEResult;
  onApprove: () => void;
  loading: boolean;
}

const PIEResults = ({ result, onApprove, loading }: PIEResultsProps) => {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (result.pie_score / 100) * circumference;
  const scoreColor = result.pie_score >= 75 ? "hsl(153,69%,27%)" : result.pie_score >= 50 ? "hsl(30,100%,31%)" : "hsl(0,72%,51%)";
  const gradeColor = result.pie_grade === "A" ? "text-success" : result.pie_grade === "B" ? "text-primary" : "text-warning";

  return (
    <div className="p-6 space-y-5 animate-fade-up">
      {/* Score + Breakdown */}
      <div className="flex items-start gap-6 bg-card border border-border rounded-lg p-5 shadow-pf">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" stroke="hsl(214,20%,85%)" strokeWidth="8" fill="none" />
            <motion.circle cx="60" cy="60" r="54" stroke={scoreColor} strokeWidth="8" fill="none" strokeLinecap="round"
              strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: "easeOut" }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-pf-dark">{result.pie_score}</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-2xl font-bold", gradeColor)}>Grade {result.pie_grade}</span>
            <span className="text-xs text-muted-foreground">Prompt Intelligence Score</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">{result.pie_interpretation}</p>
          <div className="space-y-1.5">
            {(["compliance", "tone", "audience", "readability"] as const).map(key => (
              <div key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-20 flex-shrink-0 capitalize">{key}</span>
                <div className="flex-1 h-[5px] bg-muted rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full"
                    style={{ background: result.breakdown[key] >= 70 ? "hsl(153,69%,27%)" : result.breakdown[key] >= 50 ? "hsl(30,100%,31%)" : "hsl(0,72%,51%)" }}
                    initial={{ width: 0 }} animate={{ width: `${result.breakdown[key]}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }} />
                </div>
                <span className="w-7 text-right font-bold text-[11px]">{result.breakdown[key]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Classifier cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ClassifierCard title="Audience Detection" value={result.audience.audience}
          detail={`Confidence: ${(result.audience.confidence * 100).toFixed(0)}%`}
          flag={result.audience.flag_for_review} flagReason={result.audience.flag_reason} />
        <ClassifierCard title="Jurisdiction" value={result.jurisdiction.body}
          detail={result.jurisdiction.framework}
          flag={result.jurisdiction.gdpr} flagReason={result.jurisdiction.gdpr ? "GDPR applies — cookie consent required" : undefined} />
        <ClassifierCard title="Content Risk"
          value={`${result.risk.level} (${(result.risk.risk_score * 100).toFixed(0)}%)`}
          detail={result.risk.triggers.length > 0 ? `Triggers: ${result.risk.triggers.slice(0, 5).join(", ")}` : "No high-risk terms detected"}
          flag={result.risk.level === "HIGH"} flagReason={result.risk.level === "HIGH" ? "Requires Medical Affairs review" : undefined}
          severity={result.risk.level === "HIGH" ? "high" : result.risk.level === "MEDIUM" ? "medium" : "low"} />
        <ClassifierCard title="Brand Tone" value={result.tone.label}
          detail={`Score: ${(result.tone.tone_score * 100).toFixed(0)}%${result.tone.inject_guidance ? " — guidance injected" : ""}`}
          flag={result.tone.inject_guidance} flagReason={result.tone.inject_guidance ? "Off-brand — tone guidance injected" : undefined} />
        <ClassifierCard title="Readability"
          value={`Grade ${result.readability.predicted_grade} → Target ${result.readability.target_grade}`}
          detail={result.readability.guidance}
          flag={result.readability.inject_simplify} flagReason={result.readability.inject_simplify ? "Content too complex for audience" : undefined} />
      </div>

      {result.risk.recommendations.length > 0 && (
        <div className="bg-warning-light border border-warning/25 rounded-lg p-4">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-warning mb-2">Constraints Applied</div>
          <ul className="space-y-1">
            {result.risk.recommendations.map((r, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-2">
                <span className="text-warning font-bold mt-0.5">•</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Approve */}
      <div className="flex items-center justify-between bg-pf-mist border border-pf-sky rounded-lg p-4">
        <div>
          <div className="text-sm font-bold text-pf-dark">Human Checkpoint</div>
          <div className="text-xs text-muted-foreground">Review the analysis above and approve to generate your brief</div>
        </div>
        <button onClick={onApprove} disabled={loading}
          className="bg-success text-success-foreground rounded-md px-5 py-2 text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40">
          {loading ? "Processing…" : "Approve & Generate Brief →"}
        </button>
      </div>
    </div>
  );
};

function ClassifierCard({ title, value, detail, flag, flagReason, severity }: {
  title: string; value: string; detail: string;
  flag?: boolean; flagReason?: string; severity?: string;
}) {
  const borderColor = severity === "high" ? "border-l-destructive" : severity === "medium" ? "border-l-warning" : flag ? "border-l-primary" : "border-l-border";
  return (
    <div className={cn("bg-card border border-border rounded-lg p-3.5 border-l-[3px]", borderColor)}>
      <div className="text-xs font-bold text-foreground mb-0.5">{title}</div>
      <div className="text-sm font-semibold text-pf-dark mb-0.5">{value}</div>
      <div className="text-[11px] text-muted-foreground leading-relaxed">{detail}</div>
      {flag && flagReason && (
        <div className="mt-1.5 text-[10px] font-semibold text-warning bg-warning-light px-2 py-1 rounded">⚠ {flagReason}</div>
      )}
    </div>
  );
}

export default PIEResults;
