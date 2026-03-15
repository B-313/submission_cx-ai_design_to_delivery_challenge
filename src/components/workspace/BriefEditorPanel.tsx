import { useState, useRef } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PIEResults from "./PIEResults";
import BriefAccordion from "./BriefAccordion";
import type { BriefData, PIEResult } from "@/contexts/WorkspaceContext";
import { Upload, FileText, X, Send, SkipForward } from "lucide-react";

const QUESTIONS = [
  { key: "buildType", question: "What are you building?", options: ["Website", "Webpage", "Landing Page", "Microsite"] },
  { key: "audience", question: "Who is the target audience?", options: ["Patients", "Healthcare Providers", "Channel Partners", "Internal Teams"] },
  { key: "country", question: "Country or region?", options: ["United States", "United Kingdom", "EU", "Global"] },
  { key: "purpose", question: "What's the main purpose?", options: ["Inform", "Sell", "Educate", "Recruit"] },
  { key: "goals", question: "Specific goals?", options: ["Generate leads", "Drive downloads", "Raise awareness", "Provide support"] },
  { key: "readingLevel", question: "Reading level?", options: ["Simple (patients)", "Technical (HCPs)", "Business professional", "Internal corporate"] },
  { key: "keyMessages", question: "Key messages to include?", freeText: true },
  { key: "existingDocs", question: "Any existing content or documents to base this on?", options: ["Yes, uploaded above", "No, starting fresh"] },
];

type QAnswers = Record<string, string>;

const BriefEditorPanel = () => {
  const ws = useWorkspace();
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"input" | "questions" | "pie" | "brief">("input");
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<QAnswers>({});
  const [freeAnswer, setFreeAnswer] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} too large (max 5MB)`); continue; }
      try {
        const text = await file.text();
        setUploadedFiles(prev => [...prev, { name: file.name, content: text.slice(0, 8000) }]);
        toast.success(`Uploaded: ${file.name}`);
      } catch { toast.error(`Could not read file`); }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => setUploadedFiles(prev => prev.filter((_, i) => i !== idx));

  const handleStartQuestions = () => {
    if (!prompt.trim() && uploadedFiles.length === 0) return;
    setPhase("questions");
    setQIdx(0);
  };

  const answerQuestion = (val: string) => {
    const q = QUESTIONS[qIdx];
    setAnswers(prev => ({ ...prev, [q.key]: val }));
    advanceQuestion();
  };

  const skipQuestion = () => advanceQuestion();

  const advanceQuestion = () => {
    if (qIdx < QUESTIONS.length - 1) {
      setQIdx(qIdx + 1);
      setFreeAnswer("");
    } else {
      runPIE();
    }
  };

  const buildFullPrompt = (ans: QAnswers) => {
    const fileContent = uploadedFiles.map(f => `[File: ${f.name}]\n${f.content}`).join("\n\n");
    const contextParts = Object.entries(ans).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
    return [prompt, contextParts.join("\n"), fileContent].filter(Boolean).join("\n\n---\n");
  };

  const runPIE = async () => {
    setPhase("pie");
    ws.setPrelim({ buildType: answers.buildType || null, audience: answers.audience || null });
    ws.setLoading(true);
    ws.setActiveAgent(1);

    try {
      const fullPrompt = buildFullPrompt(answers);
      const { data, error } = await supabase.functions.invoke("pie-classify", {
        body: {
          brief: fullPrompt,
          country: answers.country || ws.user?.country || "",
          audience: answers.audience || "",
          buildType: answers.buildType || "",
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      ws.setPieResult(data as PIEResult);
      toast.success("Risk analysis complete — review results below");
    } catch (err: any) {
      toast.error(err.message || "Analysis failed");
      setPhase("input");
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
          buildType: answers.buildType || ws.prelim.buildType,
          audience: answers.audience || ws.prelim.audience,
          country: answers.country || ws.user?.country,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const brief = data as BriefData;
      ws.setCurrentBrief(brief);
      ws.addBriefVersion(prompt, brief);
      setPhase("brief");
      toast.success("Brief generated — edit any section directly");
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

  const currentQ = QUESTIONS[qIdx];

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-up">
      {/* Top bar */}
      <div className="bg-card border-b border-border px-5 py-2 flex items-center gap-2.5 flex-shrink-0">
        <div className="text-[13px] font-semibold text-pf-dark flex-1">Brief Editor</div>
        {phase === "pie" && ws.pieResult && !ws.pieApproved && (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-warning/30 bg-warning-light text-warning">
            PIE: {ws.pieResult.pie_grade} ({ws.pieResult.pie_score}/100)
          </span>
        )}
        {phase === "brief" && (
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
        {/* Phase: Input */}
        {phase === "input" && (
          <div className="py-8 px-6 max-w-2xl mx-auto">
            <h3 className="font-serif text-xl text-pf-dark mb-1">Describe your project</h3>
            <p className="text-[13px] text-muted-foreground mb-5">
              Type your brief and optionally upload existing content. We'll ask a few questions to fill gaps, then analyse for risks.
            </p>

            {/* File upload */}
            <div className="mb-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:bg-pf-mist/50 transition-all"
              >
                <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
                <div className="text-xs font-semibold text-muted-foreground">Upload docs / website content</div>
                <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                  Existing site content? Paste or upload here. AI will build from your doc.
                </div>
              </div>
              <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.html,.csv,.json,.doc,.docx" onChange={handleFileUpload} className="hidden" />
              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-pf-mist border border-pf-sky rounded-full px-3 py-1">
                      <FileText className="w-3 h-3 text-primary" />
                      <span className="text-[11px] font-medium text-pf-dark">{f.name}</span>
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prompt textarea */}
            <div className="bg-secondary border-[1.5px] border-border rounded-lg p-3 focus-within:border-primary focus-within:bg-card transition-all mb-3">
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe what you want to build…"
                className="w-full bg-transparent border-none outline-none text-[13px] text-foreground resize-none min-h-[72px] max-h-[130px] leading-relaxed"
              />
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground/50">
                  {uploadedFiles.length > 0 && `${uploadedFiles.length} file(s) attached`}
                </span>
                <button
                  onClick={handleStartQuestions}
                  disabled={!prompt.trim() && uploadedFiles.length === 0}
                  className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-semibold hover:bg-pf-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Send className="w-3 h-3" /> Continue
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {["Patient info page about treatment options", "HCP product hub for clinical data", "Campaign microsite for awareness"].map(s => (
                <button key={s} onClick={() => setPrompt(s)}
                  className="bg-card border-[1.5px] border-primary/40 text-primary rounded-full px-3.5 py-1.5 text-xs font-semibold hover:bg-pf-mist transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Phase: Interactive Questions */}
        {phase === "questions" && currentQ && (
          <div className="py-12 px-6 max-w-lg mx-auto animate-fade-up">
            {/* Progress */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${((qIdx + 1) / QUESTIONS.length) * 100}%` }} />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground">{qIdx + 1}/{QUESTIONS.length}</span>
            </div>

            <h3 className="font-serif text-lg text-pf-dark mb-4">{currentQ.question}</h3>

            {currentQ.options ? (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {currentQ.options.map(opt => (
                  <button
                    key={opt}
                    onClick={() => answerQuestion(opt)}
                    className={cn(
                      "px-4 py-3 rounded-lg border-[1.5px] text-sm font-medium transition-all text-left",
                      answers[currentQ.key] === opt
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border text-foreground hover:border-primary hover:text-primary"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mb-4">
                <textarea
                  value={freeAnswer}
                  onChange={e => setFreeAnswer(e.target.value)}
                  placeholder="Type your answer…"
                  className="w-full bg-secondary border-[1.5px] border-border rounded-lg p-3 text-sm text-foreground resize-none min-h-[60px] outline-none focus:border-primary transition-colors"
                />
                <button
                  onClick={() => { answerQuestion(freeAnswer); setFreeAnswer(""); }}
                  disabled={!freeAnswer.trim()}
                  className="mt-2 bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-semibold disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}

            <button onClick={skipQuestion} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mx-auto">
              <SkipForward className="w-3 h-3" /> Skip this question
            </button>
          </div>
        )}

        {/* Phase: PIE loading */}
        {phase === "pie" && ws.loading && (
          <div className="text-center py-20">
            <div className="inline-flex items-center gap-3 bg-pf-mist border border-pf-sky rounded-lg px-6 py-4">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-sm text-pf-dark font-medium">Analysing your brief for risks and compliance…</span>
            </div>
          </div>
        )}

        {/* Phase: PIE Results */}
        {phase === "pie" && ws.pieResult && !ws.pieApproved && !ws.loading && (
          <PIEResults result={ws.pieResult} onApprove={handleApprovePie} loading={ws.loading} />
        )}

        {/* Loading: Brief generation */}
        {ws.loading && ws.activeAgent === 2 && (
          <div className="text-center py-20">
            <div className="inline-flex items-center gap-3 bg-pf-mist border border-pf-sky rounded-lg px-6 py-4">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-sm text-pf-dark font-medium">Expanding your brief into a full structured document…</span>
            </div>
          </div>
        )}

        {/* Phase: Brief Accordion */}
        {phase === "brief" && ws.currentBrief && (
          <BriefAccordion brief={ws.currentBrief} onUpdate={ws.setCurrentBrief} />
        )}
      </div>
    </div>
  );
};

export default BriefEditorPanel;
