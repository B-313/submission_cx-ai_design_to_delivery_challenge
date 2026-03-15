import { useState, useRef, useEffect } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import BriefAccordion from "./BriefAccordion";
import type { BriefData, PIEResult } from "@/contexts/WorkspaceContext";
import { Upload, FileText, X, Send, SkipForward, Check, ChevronRight, AlertTriangle, Sparkles } from "lucide-react";

/* ── Lego-style question blocks ── */
const QUESTIONS: {
  key: string;
  question: string;
  subtitle?: string;
  options?: string[];
  multiSelect?: boolean;
  freeText?: boolean;
  placeholder?: string;
}[] = [
  {
    key: "buildType",
    question: "What are you building?",
    subtitle: "Pick the format that best describes your project",
    options: ["Website", "Webpage", "Landing Page", "Microsite", "Campaign Hub", "Portal"],
  },
  {
    key: "audience",
    question: "Who is the target audience?",
    subtitle: "Select all that apply",
    options: ["Patients", "Healthcare Providers (HCPs)", "Channel Partners", "Internal Teams", "Caregivers", "General Public"],
    multiSelect: true,
  },
  {
    key: "country",
    question: "Country or region?",
    subtitle: "Where will this content be published?",
    options: ["United States", "United Kingdom", "EU", "Global", "Japan", "Australia"],
  },
  {
    key: "purpose",
    question: "What's the website's main purpose?",
    subtitle: "This shapes the overall content strategy",
    options: ["Inform", "Educate", "Sell / Promote", "Recruit", "Support", "Raise Awareness"],
  },
  {
    key: "goals",
    question: "Specific goals?",
    subtitle: "Select all that apply",
    options: ["Generate leads", "Drive downloads", "Raise awareness", "Provide support", "Collect registrations", "Share clinical data"],
    multiSelect: true,
  },
  {
    key: "readingLevel",
    question: "Reading level?",
    subtitle: "Match complexity to your audience",
    options: ["Simple (patients / public)", "Technical (HCPs / clinical)", "Business professional", "Internal corporate"],
  },
  {
    key: "keyMessages",
    question: "Key messages to communicate?",
    subtitle: "What should visitors take away? Type each on a new line or separate with commas.",
    freeText: true,
    placeholder: "e.g. Evidence-based efficacy\nPatient-centred care\nInnovative science",
  },
  {
    key: "existingContent",
    question: "Any existing content or documents?",
    subtitle: "Upload files above or describe what you have",
    options: ["Yes, uploaded files", "Yes, I'll paste content", "No, starting fresh"],
  },
];

type QAnswers = Record<string, string | string[]>;

const BriefEditorPanel = () => {
  const ws = useWorkspace();
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"input" | "questions" | "checking" | "brief" | "reviewing">("input");
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<QAnswers>({});
  const [freeAnswer, setFreeAnswer] = useState("");
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [censorWarning, setCensorWarning] = useState<string | null>(null);
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

  const answerOption = (val: string) => {
    const q = QUESTIONS[qIdx];
    if (q.multiSelect) {
      setMultiSelected(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
    } else {
      setAnswers(prev => ({ ...prev, [q.key]: val }));
      advanceQuestion();
    }
  };

  const confirmMultiSelect = () => {
    const q = QUESTIONS[qIdx];
    setAnswers(prev => ({ ...prev, [q.key]: multiSelected }));
    setMultiSelected([]);
    advanceQuestion();
  };

  const submitFreeText = () => {
    const q = QUESTIONS[qIdx];
    setAnswers(prev => ({ ...prev, [q.key]: freeAnswer }));
    setFreeAnswer("");
    advanceQuestion();
  };

  const skipQuestion = () => advanceQuestion();

  const advanceQuestion = () => {
    if (qIdx < QUESTIONS.length - 1) {
      setQIdx(qIdx + 1);
      setFreeAnswer("");
      setMultiSelected([]);
    } else {
      runCensorCheck();
    }
  };

  const buildFullPrompt = () => {
    const fileContent = uploadedFiles.map(f => `[File: ${f.name}]\n${f.content}`).join("\n\n");
    const parts = Object.entries(answers).filter(([, v]) => v && (Array.isArray(v) ? v.length : true)).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
    return [prompt, parts.join("\n"), fileContent].filter(Boolean).join("\n\n---\n");
  };

  /* ── Silent censorship check (PIE) ── */
  const runCensorCheck = async () => {
    setPhase("checking");
    ws.setLoading(true);
    setCensorWarning(null);

    try {
      const fullPrompt = buildFullPrompt();
      const audience = Array.isArray(answers.audience) ? answers.audience[0] : (answers.audience as string) || "";
      const { data, error } = await supabase.functions.invoke("pie-classify", {
        body: {
          brief: fullPrompt,
          country: (answers.country as string) || ws.user?.country || "",
          audience,
          buildType: (answers.buildType as string) || "",
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const pieResult = data as PIEResult;
      ws.setPieResult(pieResult);
      ws.setPrelim({ buildType: (answers.buildType as string) || null, audience: audience || null });

      // Check for censorship flags
      if (pieResult.risk.level === "HIGH" || pieResult.pie_score < 50) {
        setCensorWarning(
          pieResult.risk.triggers.length > 0
            ? `Content flagged: "${pieResult.risk.triggers.slice(0, 3).join('", "')}" detected. Please revise your input.`
            : "Content flagged for high risk. Please revise your input."
        );
        toast.warning("Content flagged — please revise your prompt", { duration: 5000 });
        setPhase("input");
      } else {
        // Passed — generate brief silently
        await generateBrief(pieResult);
      }
    } catch (err: any) {
      toast.error(err.message || "Check failed");
      setPhase("input");
    } finally {
      ws.setLoading(false);
    }
  };

  /* ── Generate structured brief ── */
  const generateBrief = async (pieResult: PIEResult) => {
    ws.setActiveAgent(2);
    try {
      const { data, error } = await supabase.functions.invoke("generate-brief", {
        body: {
          enrichedPrompt: pieResult.enriched_prompt,
          buildType: (answers.buildType as string) || ws.prelim.buildType,
          audience: Array.isArray(answers.audience) ? answers.audience[0] : (answers.audience as string) || ws.prelim.audience,
          country: (answers.country as string) || ws.user?.country,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const brief = data as BriefData;
      ws.setCurrentBrief(brief);
      ws.addBriefVersion(prompt, brief);
      setPhase("brief");
      toast.success("Your brief is ready — review and approve");
    } catch (err: any) {
      toast.error(err.message || "Brief generation failed");
      setPhase("input");
    } finally {
      ws.setActiveAgent(null);
    }
  };

  /* ── AI Review after approval ── */
  const handleApproveBrief = async () => {
    setPhase("reviewing");
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
      ws.approvePie();
      toast.success("AI review complete — choose your design");
      ws.goToStep(2); // → Design step
    } catch (err: any) {
      toast.error(err.message || "Review failed");
      setPhase("brief");
    } finally {
      ws.setLoading(false);
      ws.setActiveAgent(null);
    }
  };

  const currentQ = QUESTIONS[qIdx];
  const answeredCount = Object.keys(answers).length;
  const progressPct = phase === "questions" ? ((qIdx + 1) / QUESTIONS.length) * 100 : phase === "brief" ? 100 : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-up">
      {/* Top bar */}
      <div className="bg-card border-b border-border px-5 py-2 flex items-center gap-2.5 flex-shrink-0">
        <div className="text-[13px] font-semibold text-pf-dark flex-1">Brief Builder</div>
        {phase === "brief" && (
          <button
            onClick={handleApproveBrief}
            className="bg-success text-success-foreground rounded-md px-4 py-1.5 text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            <Check className="w-3 h-3" /> Approve Brief →
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-card">
        {/* ── Phase: Input ── */}
        {phase === "input" && (
          <div className="py-8 px-6 max-w-2xl mx-auto">
            <h3 className="font-serif text-xl text-pf-dark mb-1">Describe your project</h3>
            <p className="text-[13px] text-muted-foreground mb-5">
              Tell us what you want to build. We'll guide you through a few quick questions to create a complete brief.
            </p>

            {/* Censor warning */}
            {censorWarning && (
              <div className="bg-destructive/8 border-[1.5px] border-destructive/30 rounded-lg p-3.5 mb-4 flex items-start gap-2.5 animate-fade-up">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-destructive mb-0.5">Content flagged</div>
                  <div className="text-[12px] text-destructive/80">{censorWarning}</div>
                </div>
                <button onClick={() => setCensorWarning(null)} className="ml-auto text-destructive/50 hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

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
              <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.html,.csv,.json,.doc,.docx,.pdf" onChange={handleFileUpload} className="hidden" />
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

            {/* Prompt */}
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

        {/* ── Phase: Lego Questions ── */}
        {phase === "questions" && currentQ && (
          <div className="py-10 px-6 max-w-lg mx-auto animate-fade-up">
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-8">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground">{qIdx + 1}/{QUESTIONS.length}</span>
            </div>

            {/* Question card */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-pf mb-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-extrabold flex items-center justify-center">
                  {qIdx + 1}
                </div>
                <h3 className="font-serif text-lg text-pf-dark">{currentQ.question}</h3>
              </div>
              {currentQ.subtitle && (
                <p className="text-[12px] text-muted-foreground ml-9 mb-4">{currentQ.subtitle}</p>
              )}

              {/* Options (chips) */}
              {currentQ.options && (
                <div className="flex flex-wrap gap-2 mb-4 ml-9">
                  {currentQ.options.map(opt => {
                    const isSelected = currentQ.multiSelect
                      ? multiSelected.includes(opt)
                      : answers[currentQ.key] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => answerOption(opt)}
                        className={cn(
                          "px-4 py-2.5 rounded-lg border-[1.5px] text-sm font-medium transition-all",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground shadow-sm"
                            : "bg-card border-border text-foreground hover:border-primary hover:text-primary"
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 inline mr-1.5" />}
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Multi-select confirm */}
              {currentQ.multiSelect && multiSelected.length > 0 && (
                <div className="ml-9">
                  <button
                    onClick={confirmMultiSelect}
                    className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5"
                  >
                    Confirm ({multiSelected.length} selected) <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Free text */}
              {currentQ.freeText && (
                <div className="ml-9">
                  <textarea
                    value={freeAnswer}
                    onChange={e => setFreeAnswer(e.target.value)}
                    placeholder={currentQ.placeholder || "Type your answer…"}
                    className="w-full bg-secondary border-[1.5px] border-border rounded-lg p-3 text-sm text-foreground resize-none min-h-[80px] outline-none focus:border-primary transition-colors"
                  />
                  <button
                    onClick={submitFreeText}
                    disabled={!freeAnswer.trim()}
                    className="mt-2 bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5"
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Skip */}
            <button onClick={skipQuestion} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mx-auto">
              <SkipForward className="w-3 h-3" /> Skip this question
            </button>
          </div>
        )}

        {/* ── Phase: Checking (loading) ── */}
        {phase === "checking" && (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center animate-fade-up">
              <div className="inline-flex items-center gap-3 bg-pf-mist border border-pf-sky rounded-xl px-6 py-5 shadow-pf">
                <div className="flex gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <div>
                  <div className="text-sm text-pf-dark font-semibold">Preparing your brief…</div>
                  <div className="text-[11px] text-muted-foreground">Checking content quality and generating structure</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Phase: Reviewing (after approve) ── */}
        {phase === "reviewing" && (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center animate-fade-up">
              <div className="inline-flex items-center gap-3 bg-pf-mist border border-pf-sky rounded-xl px-6 py-5 shadow-pf">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                <div>
                  <div className="text-sm text-pf-dark font-semibold">AI is reviewing your brief…</div>
                  <div className="text-[11px] text-muted-foreground">Checking compliance, grammar, and brand voice</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Phase: Brief preview ── */}
        {phase === "brief" && ws.currentBrief && (
          <div className="animate-fade-up">
            <div className="px-6 py-4 bg-success-light border-b border-success/20">
              <div className="flex items-center gap-2 max-w-2xl mx-auto">
                <Check className="w-4 h-4 text-success" />
                <span className="text-sm font-semibold text-success">Brief generated successfully</span>
                <span className="text-[11px] text-muted-foreground ml-2">Review each section below, edit if needed, then approve.</span>
              </div>
            </div>
            <BriefAccordion brief={ws.currentBrief} onUpdate={ws.setCurrentBrief} />
          </div>
        )}
      </div>
    </div>
  );
};

export default BriefEditorPanel;
