import { useState, useRef } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PIEResults from "./PIEResults";
import BriefAccordion from "./BriefAccordion";
import type { BriefData, PIEResult } from "@/contexts/WorkspaceContext";
import { Upload, FileText, X } from "lucide-react";

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

const BriefEditorPanel = () => {
  const ws = useWorkspace();
  const [prompt, setPrompt] = useState("");
  const [briefReady, setBriefReady] = useState(false);
  const [showPie, setShowPie] = useState(false);
  const [buildType, setBuildType] = useState<string | null>(ws.prelim.buildType);
  const [audience, setAudience] = useState<string | null>(ws.prelim.audience);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const starters = [
    "Patient information page about treatment options",
    "HCP product hub for clinical data",
    "Internal team landing page for project tracking",
    "Campaign microsite for awareness initiative",
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`);
        continue;
      }
      try {
        const text = await file.text();
        setUploadedFiles(prev => [...prev, { name: file.name, content: text.slice(0, 8000) }]);
        toast.success(`Uploaded: ${file.name}`);
      } catch {
        toast.error(`Could not read ${file.name}`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSendPrompt = async () => {
    const txt = prompt.trim();
    const fileContent = uploadedFiles.map(f => `[File: ${f.name}]\n${f.content}`).join("\n\n");
    const fullPrompt = [txt, fileContent].filter(Boolean).join("\n\n---\nUploaded content:\n");

    if (!fullPrompt || ws.loading) return;

    // Save prelim selections
    if (buildType || audience) {
      ws.setPrelim({ buildType, audience });
    }

    ws.setLoading(true);
    ws.setActiveAgent(1);

    try {
      const { data: pieData, error: pieError } = await supabase.functions.invoke("pie-classify", {
        body: {
          brief: fullPrompt,
          country: ws.user?.country || "",
          audience: audience || "",
          buildType: buildType || "",
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
      const { data, error } = await supabase.functions.invoke("generate-brief", {
        body: {
          enrichedPrompt: ws.pieResult?.enriched_prompt || "",
          buildType: buildType || ws.prelim.buildType,
          audience: audience || ws.prelim.audience,
          country: ws.user?.country,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const brief = data as BriefData;
      ws.setCurrentBrief(brief);
      ws.addBriefVersion(prompt, brief);
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
    ws.goToStep(2);
    toast.success("Brief confirmed — builder ready");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-up">
      {/* Top bar */}
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
        {/* Input state */}
        {!showPie && !briefReady && (
          <div className="py-8 px-6 max-w-2xl mx-auto">
            <h3 className="font-serif text-xl text-pf-dark mb-1">Describe your project</h3>
            <p className="text-[13px] text-muted-foreground mb-5">
              Select options, type your brief, and optionally upload existing content. Agent 1 (PIE) analyses → Agent 2 generates a full brief.
            </p>

            {/* Inline prelim chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div className="bg-secondary border border-border rounded-lg p-3">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60 mb-2">What are you building?</div>
                <div className="flex flex-wrap gap-1.5">
                  {BUILD_OPTIONS.map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => setBuildType(buildType === opt.label ? null : opt.label)}
                      className={cn(
                        "px-3 py-1.5 rounded-full border-[1.5px] text-xs font-medium transition-all select-none",
                        buildType === opt.label
                          ? "bg-primary border-primary text-primary-foreground shadow-[0_2px_6px_hsla(200,100%,41%,0.3)]"
                          : "bg-card border-border text-muted-foreground hover:border-primary hover:text-primary"
                      )}
                      title={opt.desc}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-secondary border border-border rounded-lg p-3">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60 mb-2">Target Audience</div>
                <div className="flex flex-wrap gap-1.5">
                  {AUDIENCE_OPTIONS.map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => setAudience(audience === opt.label ? null : opt.label)}
                      className={cn(
                        "px-3 py-1.5 rounded-full border-[1.5px] text-xs font-medium transition-all select-none",
                        audience === opt.label
                          ? "bg-primary border-primary text-primary-foreground shadow-[0_2px_6px_hsla(200,100%,41%,0.3)]"
                          : "bg-card border-border text-muted-foreground hover:border-primary hover:text-primary"
                      )}
                      title={opt.desc}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* File upload */}
            <div className="mb-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:bg-pf-mist/50 transition-all"
              >
                <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
                <div className="text-xs font-semibold text-muted-foreground">
                  Upload docs / website content
                </div>
                <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                  Existing site content? Paste or upload here. AI will build from your doc.
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.html,.csv,.json,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-pf-mist border border-pf-sky rounded-full px-3 py-1">
                      <FileText className="w-3 h-3 text-primary" />
                      <span className="text-[11px] font-medium text-pf-dark">{f.name}</span>
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prompt textarea */}
            <div className="bg-secondary border-[1.5px] border-border rounded-lg p-3 focus-within:border-primary focus-within:bg-card transition-all mb-3">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe what you want to build… Agent 2 will ask if anything is missing (audience, country, goals)."
                className="w-full bg-transparent border-none outline-none text-[13px] text-foreground resize-none min-h-[72px] max-h-[130px] leading-relaxed"
              />
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground/50">
                  {buildType && `${buildType}`}{buildType && audience && " · "}{audience && `${audience}`}
                  {uploadedFiles.length > 0 && ` · ${uploadedFiles.length} file(s)`}
                </span>
                <button
                  onClick={handleSendPrompt}
                  disabled={ws.loading || (!prompt.trim() && uploadedFiles.length === 0)}
                  className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-semibold hover:bg-pf-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {ws.loading ? "Analysing…" : "Generate Brief"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {starters.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    const ctx = buildType
                      ? ` for a ${buildType} targeting ${audience || "patients"} in ${ws.user?.country || "Global"}`
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
        )}

        {/* Agent 1: PIE Results */}
        {showPie && ws.pieResult && !ws.pieApproved && (
          <PIEResults result={ws.pieResult} onApprove={handleApprovePie} loading={ws.loading} />
        )}

        {/* Loading: Agent 2 */}
        {ws.loading && ws.activeAgent === 2 && (
          <div className="text-center py-20">
            <div className="inline-flex items-center gap-3 bg-pf-mist border border-pf-sky rounded-lg px-6 py-4">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-sm text-pf-dark font-medium">Agent 2 expanding your brief…</span>
            </div>
          </div>
        )}

        {/* Brief Accordion */}
        {briefReady && ws.currentBrief && (
          <BriefAccordion brief={ws.currentBrief} onUpdate={ws.setCurrentBrief} />
        )}
      </div>
    </div>
  );
};

export default BriefEditorPanel;
