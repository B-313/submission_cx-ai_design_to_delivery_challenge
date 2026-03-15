import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import BriefAccordion from "./BriefAccordion";
import type { BriefData, PIEResult } from "@/contexts/WorkspaceContext";
import { Upload, FileText, X, Send, Check, ChevronRight, AlertTriangle } from "lucide-react";

/* ── Step-by-step brief intake questions ── */
const QUESTIONS: {
  key: string;
  label: string;
  question: string;
  subtitle?: string;
  options?: string[];
  freeText?: boolean;
  placeholder?: string;
  optional?: boolean;
  rows?: number;
}[] = [
  {
    key: "pageSection",
    label: "Page or section",
    question: "What exact page or section are you creating?",
    subtitle: "Example: HCP product information page - Key Benefits section",
    freeText: true,
    rows: 3,
    placeholder: "Patient diabetes education landing\nPricing and access page for UK",
  },
  {
    key: "audience",
    label: "Primary audience",
    question: "Who is the primary audience?",
    subtitle: "Drives Audience Detector",
    options: ["Patients", "Healthcare Providers (HCPs)", "Internal teams", "Channel partners", "Other"],
  },
  {
    key: "audienceDetail",
    label: "Audience detail",
    question: "Any audience specifics to add?",
    subtitle: "Optional free text (for segment nuances)",
    freeText: true,
    optional: true,
    placeholder: "Example: Newly diagnosed patients in NHS clinics",
  },
  {
    key: "country",
    label: "Country or market",
    question: "Which country or market is this page for?",
    subtitle: "Drives Jurisdiction Detector",
    freeText: true,
    placeholder: "Germany, United Kingdom, Global, USA, Australia",
  },
  {
    key: "primaryGoal",
    label: "Primary goal",
    question: "What is the #1 goal of this page?",
    subtitle: "Helps the LLM set CTA and conversion focus",
    freeText: true,
    placeholder: "Book a consultation, Download patient guide, Request sample, Learn treatment options",
  },
  {
    key: "heroMessage",
    label: "Most important message",
    question: "What is the single most important message we must communicate?",
    subtitle: "Use one clear sentence - this becomes the hero proposition",
    freeText: true,
    rows: 3,
    placeholder: "One-sentence core message",
  },
  {
    key: "productMentioned",
    label: "Specific product or therapy",
    question: "Are you talking about a specific product, drug, or therapy?",
    subtitle: "Helps trigger Content Risk Scorer",
    options: ["Yes", "No"],
  },
  {
    key: "productName",
    label: "Product or therapy name",
    question: "What is the product, drug, or therapy name?",
    subtitle: "Example: New oncology drug XYZ-123",
    freeText: true,
    placeholder: "Enter exact product or therapy name",
  },
  {
    key: "keyMessages",
    label: "Key points and benefits",
    question: "List the 3-5 key points or benefits that must be covered",
    subtitle: "This is the heart of the content",
    freeText: true,
    rows: 6,
    placeholder: "What is the exact page or section being created / updated?\nWhat is the primary goal / desired visitor action on this page?\n- Key point 1\n- Key point 2\n- Key point 3",
  },
  {
    key: "approvedCopy",
    label: "Approved headlines, quotes, disclaimers, or metrics",
    question: "Do you have any existing approved headlines, quotes, disclaimers, or metrics we must use?",
    subtitle: "Paste here if not already uploaded",
    freeText: true,
    optional: true,
    rows: 6,
    placeholder: "Paste approved language, legal lines, claims, and metrics",
  },
];

type QAnswers = Record<string, string | string[]>;

const hasValue = (val: string | string[] | undefined) => {
  if (Array.isArray(val)) return val.length > 0;
  return typeof val === "string" ? val.trim().length > 0 : false;
};

const BriefEditorPanel = () => {
  const ws = useWorkspace();
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"input" | "questions" | "checking" | "brief">("input");
  const [questionQueue, setQuestionQueue] = useState<number[]>([]);
  const [qPos, setQPos] = useState(0);
  const [answers, setAnswers] = useState<QAnswers>({});
  const [freeAnswer, setFreeAnswer] = useState("");
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

  const getSeedAnswers = (): QAnswers => ({
    ...(ws.prelim.audience ? { audience: ws.prelim.audience } : {}),
    ...(ws.user?.country ? { country: ws.user.country } : {}),
  });

  const getMissingQuestionQueue = (seed: QAnswers) =>
    QUESTIONS
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => {
        if (q.key === "productName") return seed.productMentioned === "Yes";
        return true;
      })
      .filter(({ q }) => !hasValue(seed[q.key]))
      .map(({ idx }) => idx);

  const handleStartQuestions = () => {
    if (!prompt.trim() && uploadedFiles.length === 0) return;

    const seededAnswers = getSeedAnswers();
    const queue = getMissingQuestionQueue(seededAnswers);
    setAnswers(seededAnswers);

    if (queue.length === 0) {
      runCensorCheck(seededAnswers);
      return;
    }

    setFreeAnswer("");
    setQuestionQueue(queue);
    setQPos(0);
    setPhase("questions");
  };

  const answerOption = (val: string) => {
    const q = currentQ;
    if (!q) return;
    const nextAnswers = { ...answers, [q.key]: val };
    if (q.key === "productMentioned" && val === "No") {
      delete nextAnswers.productName;
    }
    setAnswers(nextAnswers);
    advanceQuestion(nextAnswers);
  };

  const submitFreeText = () => {
    const q = currentQ;
    if (!q) return;
    const trimmed = freeAnswer.trim();
    if (!q.optional && !trimmed) return;
    const nextAnswers = { ...answers, [q.key]: trimmed };
    setAnswers(nextAnswers);
    setFreeAnswer("");
    advanceQuestion(nextAnswers);
  };

  const advanceQuestion = (nextAnswers: QAnswers = answers) => {
    if (qPos < questionQueue.length - 1) {
      setQPos(qPos + 1);
      setFreeAnswer("");
    } else {
      runCensorCheck(nextAnswers);
    }
  };

  useEffect(() => {
    if (!currentQ?.freeText) return;
    const existing = answers[currentQ.key];
    setFreeAnswer(typeof existing === "string" ? existing : "");
  }, [qPos, currentQ?.key]);

  const buildFullPrompt = (answerSet: QAnswers) => {
    const fileContent = uploadedFiles.map(f => `[File: ${f.name}]\n${f.content}`).join("\n\n");
    const parts = QUESTIONS
      .filter(q => hasValue(answerSet[q.key]))
      .map(q => `${q.label}: ${answerSet[q.key] as string}`);

    const classifierContext = [
      `audience_classifier_input: ${answerSet.audience || ""}`,
      `jurisdiction_classifier_input: ${answerSet.country || ws.user?.country || ""}`,
      `risk_classifier_input: ${answerSet.productMentioned === "Yes" ? `Product mentioned - ${answerSet.productName || "unspecified"}` : "No specific product/therapy named"}`,
      `primary_goal: ${answerSet.primaryGoal || ""}`,
      `hero_proposition: ${answerSet.heroMessage || ""}`,
    ];

    return [prompt, parts.join("\n"), classifierContext.join("\n"), fileContent].filter(Boolean).join("\n\n---\n");
  };

  /* ── Silent censorship check (PIE) ── */
  const runCensorCheck = async (answerSet: QAnswers = answers) => {
    setPhase("checking");
    ws.setLoading(true);
    setCensorWarning(null);

    try {
      const fullPrompt = buildFullPrompt(answerSet);
      const audience = (answerSet.audience as string) || "";
      const buildType = (answerSet.pageSection as string)?.toLowerCase().includes("landing")
        ? "Landing Page"
        : (answerSet.pageSection as string)?.toLowerCase().includes("microsite")
          ? "Microsite"
          : "Webpage";
      const { data, error } = await supabase.functions.invoke("pie-classify", {
        body: {
          brief: fullPrompt,
          country: (answerSet.country as string) || ws.user?.country || "",
          audience,
          buildType,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const pieResult = data as PIEResult;
      ws.setPieResult(pieResult);
      ws.setPrelim({ buildType, audience: audience || null });

      // Only block on severe high-risk results. Lower scores continue with guidance.
      if (pieResult.risk.level === "HIGH" && pieResult.risk.risk_score >= 0.85) {
        setCensorWarning(
          pieResult.risk.triggers.length > 0
            ? `Content flagged: "${pieResult.risk.triggers.slice(0, 3).join('", "')}" detected. Please revise your input.`
            : "Content flagged for high risk. Please revise your input."
        );
        toast.warning("Content flagged — please revise your prompt", { duration: 5000 });
        setPhase("input");
      } else {
        if (pieResult.pie_score < 50 || pieResult.risk.level === "HIGH") {
          toast.warning("Brief generated with caution flags. Please run Final Check before submit.");
        }
        // Passed — generate brief silently
        await generateBrief(pieResult, answerSet);
      }
    } catch (err: any) {
      toast.error(err.message || "Check failed");
      setPhase("input");
    } finally {
      ws.setLoading(false);
    }
  };

  /* ── Generate structured brief ── */
  const generateBrief = async (pieResult: PIEResult, answerSet: QAnswers = answers) => {
    ws.setActiveAgent(2);
    try {
      const { data, error } = await supabase.functions.invoke("generate-brief", {
        body: {
          enrichedPrompt: pieResult.enriched_prompt,
          buildType: ws.prelim.buildType,
          audience: (answerSet.audience as string) || ws.prelim.audience,
          country: (answerSet.country as string) || ws.user?.country,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const brief = data as BriefData;
      ws.setCurrentBrief(brief);
      ws.addBriefVersion(prompt, brief);
      setPhase("brief");
      toast.success("Your brief is ready — review and approve");
      void runBackgroundReview(brief, answerSet);
    } catch (err: any) {
      toast.error(err.message || "Brief generation failed");
      setPhase("input");
    } finally {
      ws.setActiveAgent(null);
    }
  };

  const runBackgroundReview = async (brief: BriefData, answerSet: QAnswers) => {
    try {
      const audience = (answerSet.audience as string) || ws.prelim.audience;
      const { data, error } = await supabase.functions.invoke("review-content", {
        body: {
          brief,
          buildType: (answerSet.buildType as string) || ws.prelim.buildType,
          audience,
          country: (answerSet.country as string) || ws.user?.country,
        },
      });
      if (error || data?.error) return;
      ws.setReviewData(data);
    } catch {
      // Review is optional here; final quality gate remains in Builder Final Check.
    }
  };

  const handleApproveBrief = () => {
    ws.approvePie();
    toast.success("Brief approved — choose your design");
    ws.goToStep(2);
  };

  const currentQuestionIndex = questionQueue[qPos] ?? 0;
  const currentQ = QUESTIONS[currentQuestionIndex];
  const progressPct = phase === "questions"
    ? ((qPos + 1) / Math.max(1, questionQueue.length)) * 100
    : phase === "brief"
      ? 100
      : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-up">
      {/* Top bar */}
      <div className="bg-card border-b border-border px-5 py-2 flex items-center gap-2.5 flex-shrink-0">
        <div className="text-[13px] font-semibold text-pf-dark flex-1">Type Brief</div>
        {phase === "brief" && (
          <button
            onClick={handleApproveBrief}
            className="bg-success text-success-foreground rounded-md px-4 py-1.5 text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            <Check className="w-3 h-3" /> Approve & Continue →
          </button>
        )}
      </div>

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

                  <div className="text-[12px] text-destructive/80">{censorWarning}</div>
                </div>
                <button onClick={() => setCensorWarning(null)} className="ml-auto text-destructive/50 hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* File upload */}
                    rows={currentQ.rows || 4}
                  />
                  <button
                    onClick={submitFreeText}
                    disabled={!currentQ.optional && !freeAnswer.trim()}
                    className="mt-2 bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5"
            <div className="mb-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:bg-pf-mist/50 transition-all"
              >
                <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
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
                placeholder="Optional: add any extra context before starting the guided form…"
                className="w-full bg-transparent border-none outline-none text-[13px] text-foreground resize-none min-h-[72px] max-h-[130px] leading-relaxed"
              />
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground/50">
                  {uploadedFiles.length > 0 && `${uploadedFiles.length} file(s) attached`}
                </span>
                <button
                  onClick={handleStartQuestions}
                  className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-semibold hover:bg-pf-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Send className="w-3 h-3" /> Start Form
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

        {/* ── Phase: Guided Questions ── */}
        {phase === "questions" && currentQ && (
          <div className="py-10 px-6 max-w-xl mx-auto animate-fade-up">
            <div className="flex items-center gap-2 mb-8">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground">{qPos + 1}/{questionQueue.length}</span>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-pf mb-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-extrabold flex items-center justify-center">
                  {qPos + 1}
                </div>
                <h3 className="font-serif text-lg text-pf-dark">{currentQ.question}</h3>
              </div>
              {currentQ.subtitle && (
                <p className="text-[12px] text-muted-foreground ml-9 mb-4">{currentQ.subtitle}</p>
              )}

              {currentQ.options && (
                <div className="flex flex-wrap gap-2 mb-2 ml-9">
                  {currentQ.options.map(opt => {
                    const isSelected = answers[currentQ.key] === opt;
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

              {currentQ.freeText && (
                <div className="ml-9">
                  <textarea
                    value={freeAnswer}
                    onChange={e => setFreeAnswer(e.target.value)}
                    placeholder={currentQ.placeholder || "Type your answer..."}
                    className="w-full bg-secondary border-[1.5px] border-border rounded-lg p-3 text-sm text-foreground resize-none min-h-[80px] outline-none focus:border-primary transition-colors"
                    rows={currentQ.rows || 4}
                  />
                  <button
                    onClick={submitFreeText}
                    disabled={!currentQ.optional && !freeAnswer.trim()}
                    className="mt-2 bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5"
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
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
