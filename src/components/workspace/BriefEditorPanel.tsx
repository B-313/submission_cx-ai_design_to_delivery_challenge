import { useState, useRef } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PIEResults from "./PIEResults";
import BriefAccordion from "./BriefAccordion";
import type { BriefData, PIEResult } from "@/contexts/WorkspaceContext";

const BriefEditorPanel = () => {
  const ws = useWorkspace();
  const [prompt, setPrompt] = useState("");
  const [briefReady, setBriefReady] = useState(false);
  const [showPie, setShowPie] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoPrompt = ws.prelim.buildType
    ? `Build a ${ws.prelim.buildType} for ${ws.prelim.audience} in ${ws.user?.country || "Global"}. Department: ${ws.user?.department || "N/A"}.`
    : "";

  const starters = [
    "Patient information page about treatment options",
    "HCP product hub for clinical data",
    "Internal team landing page for project tracking",
    "Campaign microsite for awareness initiative",
  ];

  const handleSendPrompt = async () => {
    const txt = (prompt || autoPrompt).trim();
    if (!txt || ws.loading) return;
    ws.setLoading(true);
    ws.setActiveAgent(1);

    try {
      // Agent 1: PIE Classification
      const { data: pieData, error: pieError } = await supabase.functions.invoke("pie-classify", {
        body: {
          brief: txt,
          country: ws.user?.country || "",
          audience: ws.prelim.audience || "",
          buildType: ws.prelim.buildType || "",
        },
      });

      if (pieError) throw new Error(pieError.message);
      if (pieData?.error) throw new Error(pieData.error);

      ws.setPieResult(pieData as PIEResult);
      setShowPie(true);
      toast.success("Agent 1 (PIE) analysis complete — review results below");
    } catch (err: any) {
      toast.error(err.message || "PIE analysis failed");
    } finally {
      ws.setLoading(false);
      ws.setActiveAgent(null);
    }
  };

  const handleApprovePie = async () => {
    ws.approvePie();
    ws.setLoading(true);
    ws.setActiveAgent(2);

    try {
      // Agent 2: Generate Brief from enriched prompt
      const { data, error } = await supabase.functions.invoke("generate-brief", {
        body: {
          enrichedPrompt: ws.pieResult?.enriched_prompt || "",
          buildType: ws.prelim.buildType,
          audience: ws.prelim.audience,
          country: ws.user?.country,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const brief = data as BriefData;
      ws.setCurrentBrief(brief);
      ws.addBriefVersion(prompt || autoPrompt, brief);
      setBriefReady(true);
      toast.success("Agent 2 generated brief — edit any section directly");
    } catch (err: any) {
      toast.error(err.message || "Brief generation failed");
    } finally {
      ws.setLoading(false);
      ws.setActiveAgent(null);
    }
  };

  const handleConfirmBrief = () => {
    ws.goToStep(3);
    toast.success("Brief confirmed — builder ready");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-up">
      {/* Brief bar */}
      <div className="bg-card border-b border-border px-5 py-2 flex items-center gap-2.5 flex-shrink-0">
        <div className="text-[13px] font-semibold text-pf-dark flex-1">Brief Editor</div>
        {ws.pieResult && !ws.pieApproved && (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-warning/30 bg-warning-light text-warning">
            PIE: {ws.pieResult.pie_grade} ({ws.pieResult.pie_score}/100)
          </span>
        )}
        {briefReady && (
          <>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-primary/30 bg-pf-mist text-primary">
              Draft ready
            </span>
            <button
              onClick={handleConfirmBrief}
              className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-bold hover:bg-pf-dark transition-colors"
            >
              Confirm Brief →
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-card">
        {/* Empty state / Prompt area */}
        {!showPie && !briefReady && (
          <div className="text-center py-14 px-10">
            <h3 className="font-serif text-xl text-pf-dark mb-2">Describe your project</h3>
            <p className="text-[13px] text-muted-foreground mb-6 max-w-md mx-auto">
              Your brief will be analysed by the Prompt Intelligence Engine (5 classifiers) before generating content.
            </p>

            {/* Prompt area */}
            <div className="max-w-lg mx-auto">
              <div className="bg-secondary border-[1.5px] border-border rounded-lg p-3 focus-within:border-primary focus-within:bg-card transition-all">
                <textarea
                  ref={textareaRef}
                  value={prompt || autoPrompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Describe what you want to build…"
                  className="w-full bg-transparent border-none outline-none text-[13px] text-foreground resize-none min-h-[72px] max-h-[130px] leading-relaxed"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSendPrompt}
                    disabled={ws.loading || !(prompt || autoPrompt).trim()}
                    className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-semibold hover:bg-pf-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {ws.loading ? "Analysing…" : "Generate Brief"}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {starters.map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      const ctx = ws.prelim.buildType
                        ? ` for a ${ws.prelim.buildType} targeting ${ws.prelim.audience} in ${ws.user?.country || "Global"}`
                        : "";
                      setPrompt(s + ctx);
                    }}
                    className="bg-card border-[1.5px] border-primary/40 text-primary rounded-full px-3.5 py-1.5 text-xs font-semibold hover:bg-pf-mist transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Agent 1: PIE Results */}
        {showPie && ws.pieResult && !ws.pieApproved && (
          <PIEResults
            result={ws.pieResult}
            onApprove={handleApprovePie}
            loading={ws.loading}
          />
        )}

        {/* Loading: Agent 2 generating */}
        {ws.loading && ws.activeAgent === 2 && (
          <div className="text-center py-20">
            <div className="inline-flex items-center gap-3 bg-pf-mist border border-pf-sky rounded-lg px-6 py-4">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-sm text-pf-dark font-medium">Agent 2 generating your brief…</span>
            </div>
          </div>
        )}

        {/* Brief Accordion Editor */}
        {briefReady && ws.currentBrief && (
          <BriefAccordion brief={ws.currentBrief} onUpdate={ws.setCurrentBrief} />
        )}
      </div>
    </div>
  );
};

export default BriefEditorPanel;
