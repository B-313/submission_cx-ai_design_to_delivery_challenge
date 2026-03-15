import { useState, useCallback, useRef, useEffect } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import { evaluateMaterialSafety } from "@/lib/materialSafety";
import { toast } from "sonner";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { CheckCircle, AlertTriangle, ArrowLeft, Plus, Trash2, GripVertical, Download, X } from "lucide-react";
import { invokeProtectedFunction } from "@/lib/protectedInvoke";

interface CanvasBlock {
  id: string;
  name: string;
  fields: { label: string; value: string; heading?: boolean }[];
}

interface Page {
  id: string;
  name: string;
  blocks: CanvasBlock[];
}

const BuilderPanel = () => {
  const ws = useWorkspace();
  const [pages, setPages] = useState<Page[]>(() => [
    { id: "page-1", name: "Page 1", blocks: buildBlocks(ws) },
  ]);
  const [activePage, setActivePage] = useState(0);
  const [finalChecking, setFinalChecking] = useState(false);
  const [finalResult, setFinalResult] = useState<null | {
    score: number;
    issues: string[];
    recommendations: { field: string; severity: string; issue: string; recommendation: string }[];
  }>(null);
  const [needsRerun, setNeedsRerun] = useState(false);
  const [complianceText, setComplianceText] = useState("");
  const [complianceLocked, setComplianceLocked] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewDirty, setPreviewDirty] = useState(true);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [materialName, setMaterialName] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [materialType, setMaterialType] = useState<"link" | "image" | "document">("link");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const materialFileInputRef = useRef<HTMLInputElement>(null);

  const currentBlocks = pages[activePage]?.blocks ?? [];

  const layoutOptions = [
    { id: "hero", name: "Hero + Cards" },
    { id: "two-col", name: "Two Column" },
    { id: "cards", name: "Card Grid" },
    { id: "split", name: "Split" },
    { id: "article", name: "Article" },
    { id: "minimal", name: "Minimal" },
  ];

  // ── Page management ──
  const updatePageBlocks = (updater: (blocks: CanvasBlock[]) => CanvasBlock[]) => {
    setPages(prev => prev.map((p, i) => i === activePage ? { ...p, blocks: updater(p.blocks) } : p));
    setNeedsRerun(true);
    setPreviewDirty(true);
  };

  const addPage = () => {
    const num = pages.length + 1;
    const newPage: Page = {
      id: `page-${Date.now()}`,
      name: `Page ${num}`,
      blocks: [{ id: String(Date.now()), name: "Hero Banner", fields: [{ label: "Headline", value: `Page ${num} Title`, heading: true }, { label: "Subheadline", value: "Add your content here." }] }],
    };
    setPages(prev => [...prev, newPage]);
    setActivePage(pages.length);
    setPreviewDirty(true);
    toast.success(`Page ${num} added`);
  };

  const removePage = (idx: number) => {
    if (pages.length === 1) { toast.warning("Cannot remove the last page"); return; }
    setPages(prev => prev.filter((_, i) => i !== idx));
    setActivePage(prev => Math.max(0, prev >= idx ? prev - 1 : prev));
    setPreviewDirty(true);
    toast.success("Page removed");
  };

  const renamePage = (idx: number, name: string) => {
    setPages(prev => prev.map((p, i) => i === idx ? { ...p, name } : p));
    setPreviewDirty(true);
  };

  // ── Block management ──
  const updateField = (blockIdx: number, fieldIdx: number, value: string) => {
    updatePageBlocks(blocks => blocks.map((b, bi) =>
      bi === blockIdx ? { ...b, fields: b.fields.map((f, fi) => fi === fieldIdx ? { ...f, value } : f) } : b
    ));
  };

  const applyLayout = (layout: string) => {
    ws.setLayout(layout);
    setPages(prev => prev.map((p, i) => i === activePage ? { ...p, blocks: buildBlocks(ws, layout) } : p));
    setNeedsRerun(true);
    setPreviewDirty(true);
    toast.success(`Layout switched to ${layout}`);
  };

  const addFeatureCard = () => {
    const cardCount = currentBlocks.filter(b => b.name.toLowerCase().includes("card")).length + 1;
    updatePageBlocks(blocks => [...blocks, {
      id: String(Date.now()),
      name: `Feature Card ${cardCount}`,
      fields: [
        { label: "Heading", value: `Feature ${cardCount}`, heading: true },
        { label: "Body", value: "Add supporting value statement here." },
      ],
    }]);
    toast.success("Feature card added");
  };

  const addSection = () => {
    updatePageBlocks(blocks => [...blocks, {
      id: String(Date.now()),
      name: "New Section",
      fields: [
        { label: "Title", value: "New Section", heading: true },
        { label: "Body", value: "Add section content here." },
      ],
    }]);
    toast.success("Section added");
  };

  const removeBlock = (blockIdx: number) => {
    if (currentBlocks.length <= 1) { toast.warning("Keep at least one section per page"); return; }
    updatePageBlocks(blocks => blocks.filter((_, i) => i !== blockIdx));
    toast.success("Section removed");
  };

  // ── Drag to reorder ──
  const handleDragStart = (idx: number) => setDraggingIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggingIdx === null || draggingIdx === idx) return;
    updatePageBlocks(blocks => {
      const next = [...blocks];
      const [moved] = next.splice(draggingIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDraggingIdx(idx);
  };

  const handleDragEnd = () => setDraggingIdx(null);

  // ── Download HTML ──
  const downloadHtml = () => {
    const html = generatePreviewHtml();
    const title = ws.currentBrief?.projectTitle || "project";
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || "company-name-page"}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("HTML downloaded");
  };

  const confirmMaterialGuideline = () => window.confirm("Confirm this material is safe-for-work and complies with upload guidelines.");

  const runSafetyAgentCheck = (textToScan: string) => {
    const scan = evaluateMaterialSafety(textToScan);
    if (scan.status === "blocked") {
      toast.error(`Safety Agent blocked this material: ${scan.triggers.slice(0, 3).join(", ") || "policy violation"}`);
      return false;
    }
    if (scan.status === "review") {
      const proceed = window.confirm(`Safety Agent flagged this material for review (${scan.triggers.join(", ") || "sensitive terms"}). Continue?`);
      if (!proceed) {
        toast.warning("Material skipped after Safety Agent review");
        return false;
      }
    }
    return true;
  };

  const addBuilderMaterial = () => {
    if (!materialName.trim() || !materialUrl.trim()) return;
    if (materialType !== "document" && !/^https?:\/\//i.test(materialUrl.trim())) {
      toast.warning("Enter a valid URL starting with http:// or https://");
      return;
    }
    if (!confirmMaterialGuideline()) {
      toast.warning("Material not added (guideline confirmation not provided)");
      return;
    }
    if (!runSafetyAgentCheck(`${materialName}\n${materialUrl}`)) {
      return;
    }

    ws.addMaterial({
      name: materialName.trim(),
      type: materialType,
      source: materialUrl.trim(),
      stage: "builder",
    });
    setPreviewDirty(true);
    setMaterialName("");
    setMaterialUrl("");
    toast.success("Material added to preview placeholders");
  };

  const handleBuilderFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name} too large (max 8MB)`); continue; }
      if (!confirmMaterialGuideline()) {
        toast.warning(`Skipped ${file.name} (guideline confirmation not provided)`);
        continue;
      }
      const customName = window.prompt("Enter a name for this material", file.name)?.trim();
      if (!customName) {
        toast.warning(`Skipped ${file.name} (name required)`);
        continue;
      }

      const detectedType: "document" | "image" = file.type.startsWith("image/") ? "image" : "document";
      const textForScan = detectedType === "document" ? await file.text().catch(() => "") : "";
      if (!runSafetyAgentCheck(`${customName}\n${file.name}\n${textForScan.slice(0, 5000)}`)) {
        continue;
      }
      ws.addMaterial({
        name: customName,
        type: detectedType,
        source: file.name,
        stage: "builder",
      });
      setPreviewDirty(true);
      toast.success(`Uploaded ${customName}`);
    }

    if (materialFileInputRef.current) materialFileInputRef.current.value = "";
  };

  const contentText = currentBlocks.map(b => b.fields.map(f => f.value).join(" ")).join(" ").toLowerCase();
  const country = (ws.user?.country || "Global").toLowerCase();
  const suggestedDisclaimers = buildComplianceDisclaimers(contentText, country);

  useEffect(() => {
    // Auto-populate first page from the latest approved/generated brief when entering Builder.
    if (ws.step !== 3 || !ws.currentBrief) return;
    setPages(prev => {
      if (prev.length === 0) {
        return [{ id: "page-1", name: "Page 1", blocks: buildBlocks(ws) }];
      }
      const next = [...prev];
      next[0] = { ...next[0], blocks: buildBlocks(ws) };
      return next;
    });
    setNeedsRerun(true);
    setPreviewDirty(true);
  }, [ws.step, ws.currentBrief?.projectTitle, ws.layout]);

  useEffect(() => {
    setPreviewDirty(true);
  }, [activePage]);

  useEffect(() => {
    if (!complianceLocked) {
      setComplianceText(suggestedDisclaimers.join("\n"));
    }
  }, [suggestedDisclaimers, complianceLocked]);

  const runFinalCheck = async () => {
    setFinalChecking(true);
    try {
      const contentText = currentBlocks.map(b => b.fields.map(f => f.value).join("\n")).join("\n\n");
      const { data, error } = await invokeProtectedFunction("review-content", {
        brief: contentText,
        buildType: ws.prelim.buildType,
        audience: ws.prelim.audience,
        country: ws.user?.country,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const score = data.overallScore || 0;
      const allItems = [...(data.complianceIssues || []), ...(data.grammarIssues || [])];
      const issues = allItems.map((i: any) => i.issue);
      const recommendations = allItems.slice(0, 4).map((i: any) => ({
        field: i.field || "Content",
        severity: i.severity || "medium",
        issue: i.issue || "Issue detected",
        recommendation: i.recommendation || "Revise wording and re-run checks",
      }));
      setFinalResult({ score, issues, recommendations });
      setNeedsRerun(false);

      if (score >= 70) {
        toast.success(`Final check passed (${score}/100) — ready for Review.`);
      } else {
        toast.warning("Score below 70. Review recommendations, update content, then rerun check.");
      }
    } catch (err: any) {
      toast.error(err.message || "Final check failed");
    } finally {
      setFinalChecking(false);
    }
  };

  const handleProceedToReview = () => {
    if (!finalResult || finalResult.score < 70) {
      toast.warning("Run the content check and meet the 70+ threshold before proceeding to Review.");
      return;
    }
    ws.goToStep(4);
  };

  const generatePreviewHtml = useCallback(() => {
    const title = ws.currentBrief?.projectTitle || "Company Name";
    const builderMaterials = ws.materials.filter(m => m.stage === "builder");
    const previewDisclaimers = complianceText
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Helvetica Neue',Arial,sans-serif;color:#0F1E2D;background:#fff}
.nav{background:linear-gradient(90deg,#001A4D,#003087);padding:14px 40px}.nav-logo{color:#fff;font-size:18px;font-weight:700}
.hero{background:linear-gradient(135deg,#003087,#0093D0);color:#fff;padding:64px 48px;text-align:center}
.hero h1{font-size:2.2em;font-weight:700;margin-bottom:12px}.hero p{font-size:1.05em;opacity:.88;max-width:580px;margin:0 auto 20px}
.cta-btn{display:inline-block;background:#fff;color:#003087;padding:11px 28px;border-radius:6px;font:700 14px sans-serif}
.section{padding:48px;max-width:960px;margin:0 auto}.section h2{font-size:1.35em;font-weight:700;color:#003087;margin-bottom:12px}
.section p{font-size:.97em;line-height:1.75;color:#3A5570;white-space:pre-wrap}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;padding:48px;max-width:960px;margin:0 auto}
.card{background:#EBF6FC;border:1px solid #D6EEF9;border-radius:10px;padding:20px}.card p{font-size:.92em;line-height:1.65;color:#3A5570;white-space:pre-wrap}
.materials{max-width:960px;margin:20px auto;border:1px dashed #9dc7df;background:#f5fbff;border-radius:8px;padding:14px 16px}
.materials h3{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#0b4f7a;margin-bottom:8px}
.materials p{font-size:12px;line-height:1.6;color:#1f4f6b;margin:0 0 6px 0}
.compliance{max-width:960px;margin:0 auto 18px auto;border:1px solid #f5c2c7;background:#fff5f5;border-radius:8px;padding:14px 16px}
.compliance h3{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#b42318;margin-bottom:8px}
.compliance p{font-size:12px;line-height:1.6;color:#7a271a;margin:0 0 6px 0}
.footer{background:#003087;color:rgba(255,255,255,.65);text-align:center;padding:22px;font-size:12px;margin-top:48px}
</style></head><body><div class="nav"><span class="nav-logo">Company Name</span></div>`;

    let isFirst = true;
    currentBlocks.forEach(blk => {
      if (isFirst && blk.fields.length) {
        html += `<div class="hero"><h1>${blk.fields[0]?.value || blk.name}</h1><p>${blk.fields[1]?.value || ""}</p><a class="cta-btn">Learn More</a></div>`;
        isFirst = false;
      } else if (blk.name.toLowerCase().includes("card")) {
        html += `<div class="cards">${blk.fields.map(f => `<div class="card"><p>${f.value}</p></div>`).join("")}</div>`;
      } else {
        html += `<div class="section">${blk.fields.map((f, i) => i === 0 ? `<h2>${f.value || blk.name}</h2>` : `<p>${f.value}</p>`).join("")}</div>`;
      }
    });
    if (builderMaterials.length > 0) {
      html += `<div class="materials"><h3>Material Placeholders</h3>${builderMaterials.map(m => `<p>[${m.type.toUpperCase()}] ${m.name} - ${m.source}</p>`).join("")}</div>`;
    }
    html += `<div class="compliance"><h3>Compliance and Regulatory Disclaimers</h3>${previewDisclaimers.map(d => `<p>${d}</p>`).join("")}</div>`;
    html += `<div class="footer">Company Name · Draft Preview · Not for external distribution</div></body></html>`;
    return html;
  }, [currentBlocks, ws.currentBrief, ws.materials, complianceText]);

  useEffect(() => {
    if (!previewHtml) {
      setPreviewHtml(generatePreviewHtml());
      setPreviewDirty(false);
    }
  }, [generatePreviewHtml, previewHtml]);

  const reloadPreview = () => {
    setPreviewHtml(generatePreviewHtml());
    setPreviewDirty(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-up">
      {/* ── Top bar ── */}
      <div className="bg-card border-b border-border px-4 py-2 flex items-center gap-2 flex-shrink-0">
        <button onClick={() => ws.goToStep(2)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Brief
        </button>
        <span className="text-[13px] font-semibold text-pf-dark flex-1">Builder</span>

        <button
          onClick={downloadHtml}
          title="Download current page as HTML"
          className="border border-border rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary flex items-center gap-1.5"
        >
          <Download className="w-3 h-3" /> HTML
        </button>

        <button
          onClick={reloadPreview}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold border flex items-center gap-1.5 transition-colors",
            previewDirty
              ? "border-primary text-primary bg-primary/10"
              : "border-border text-muted-foreground hover:border-primary hover:text-primary"
          )}
        >
          Reload Preview
        </button>

        <button
          onClick={handleProceedToReview}
          className={cn(
            "rounded-md px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all",
            finalResult && finalResult.score >= 70
              ? "bg-success text-success-foreground hover:opacity-90"
              : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
          )}
          title={!finalResult || finalResult.score < 70 ? "Run content check (70+ required) before proceeding" : ""}
        >
          <CheckCircle className="w-3 h-3" /> Review →
        </button>

        <button
          onClick={runFinalCheck}
          disabled={finalChecking}
          className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-bold hover:bg-pf-dark transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {finalChecking ? "Checking…" : finalResult ? "Re-run Check" : "Run Check"}
        </button>
      </div>

      {needsRerun && (
        <div className="px-5 py-2 border-b bg-warning-light border-warning/20 text-[12px] text-warning font-semibold">
          Content changed after your last check. Review recommendations and rerun the check before proceeding.
        </div>
      )}

      {previewDirty && (
        <div className="px-5 py-2 border-b bg-primary/10 border-primary/20 text-[12px] text-primary font-semibold">
          Preview is out of date. Click Reload Preview to refresh the preview pane.
        </div>
      )}

      {/* Final check result banner */}
      {finalResult && (
        <div className={cn(
          "px-5 py-2.5 border-b flex items-center gap-2 text-xs font-semibold animate-fade-up",
          finalResult.score >= 90
            ? "bg-success-light border-success/20 text-success"
            : finalResult.score >= 70
              ? "bg-warning-light border-warning/20 text-warning"
              : "bg-destructive/8 border-destructive/20 text-destructive"
        )}>
          {finalResult.score >= 70 ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          Score: {finalResult.score}/100
          {finalResult.score < 90 && finalResult.issues.length > 0 && (
            <span className="font-normal ml-2">— {finalResult.issues[0]}</span>
          )}
          {finalResult.score < 70 && (
            <span className="font-normal ml-2 text-destructive">· Minimum 70 required to proceed to Review</span>
          )}
        </div>
      )}

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={24} minSize={18}>
          <div className="h-full overflow-y-auto bg-card border-r border-border p-4">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60 mb-2">Brief Context</div>
            {ws.currentBrief ? (
              <div className="space-y-3">
                <div className="border border-border rounded-lg p-3 bg-secondary/30">
                  <div className="text-[11px] font-bold text-foreground mb-1">{ws.currentBrief.projectTitle}</div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{ws.currentBrief.goal}</p>
                </div>
                <div className="border border-border rounded-lg p-3 bg-card">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Audience</div>
                  <p className="text-[12px] text-foreground leading-relaxed">{ws.currentBrief.audience}</p>
                </div>
                <div className="border border-border rounded-lg p-3 bg-card">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Key Messages</div>
                  <ul className="space-y-1.5">
                    {ws.currentBrief.keyMessages.map((msg, idx) => (
                      <li key={idx} className="text-[12px] text-foreground leading-relaxed">• {msg}</li>
                    ))}
                  </ul>
                </div>
                <div className="border border-border rounded-lg p-3 bg-card">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Page Sections</div>
                  <ul className="space-y-1.5">
                    {ws.currentBrief.contentSections.map((section, idx) => (
                      <li key={idx} className="text-[12px] text-foreground leading-relaxed">• {section}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-[12px] text-muted-foreground">No brief data available yet. Go back to Brief and approve a generated brief.</div>
            )}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={38} minSize={28}>
          <div className="h-full overflow-y-auto bg-card flex flex-col">
            {/* ── Page tabs ── */}
            <div className="border-b border-border bg-secondary/50 px-3 pt-2 flex-shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {pages.map((page, idx) => (
                  <div
                    key={page.id}
                    className={cn(
                      "flex items-center gap-1 rounded-t-md border border-b-0 px-2 py-1 text-[11px] font-semibold select-none cursor-pointer flex-shrink-0 transition-colors",
                      idx === activePage
                        ? "bg-card border-border text-pf-dark"
                        : "bg-transparent border-transparent text-muted-foreground hover:bg-card hover:border-border"
                    )}
                    onClick={() => setActivePage(idx)}
                  >
                    <input
                      value={page.name}
                      onChange={e => renamePage(idx, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="bg-transparent border-none outline-none text-[11px] font-semibold w-[60px] min-w-0 cursor-text"
                    />
                    {pages.length > 1 && (
                      <button
                        onClick={e => { e.stopPropagation(); removePage(idx); }}
                        className="text-muted-foreground/50 hover:text-destructive ml-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addPage}
                  title="Add new page"
                  className="flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10 flex-shrink-0 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Page
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {finalResult && finalResult.recommendations.length > 0 && (
                <div className="mb-4 border border-border rounded-lg p-3 bg-secondary/30">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60 mb-2">What to fix and why</div>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {finalResult.recommendations.map((r, idx) => (
                      <div key={`${r.field}-${idx}`} className="bg-card border border-border rounded-md p-2.5">
                        <div className="text-[12px] font-semibold text-foreground">
                          {r.field} · {r.severity.toUpperCase()}
                        </div>
                        <div className="text-[12px] text-muted-foreground mt-0.5">Why: {r.issue}</div>
                        <div className="text-[12px] text-success font-semibold mt-1">What to do: {r.recommendation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Layout / Design selector */}
              <div className="mb-4 border border-border rounded-lg p-3 bg-secondary/30">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60 mb-2">Layout / Design</div>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {layoutOptions.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => applyLayout(opt.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors",
                        (ws.layout || "hero") === opt.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-primary hover:text-primary"
                      )}
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={addFeatureCard} className="text-[11px] font-semibold bg-card border border-border rounded-md px-2.5 py-1.5 hover:border-primary hover:text-primary">
                    + Card
                  </button>
                  <button onClick={addSection} className="text-[11px] font-semibold bg-card border border-border rounded-md px-2.5 py-1.5 hover:border-primary hover:text-primary">
                    + Section
                  </button>
                </div>
              </div>

              <div className="mb-4 border border-border rounded-lg p-3 bg-secondary/30">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60 mb-2">Add Material</div>
                <div className="grid grid-cols-1 gap-2">
                  <input
                    value={materialName}
                    onChange={e => setMaterialName(e.target.value)}
                    placeholder="Material name"
                    className="w-full bg-card border border-border rounded-md px-3 py-2 text-[12px] outline-none focus:border-primary"
                  />
                  <div className="flex gap-2">
                    <select
                      value={materialType}
                      onChange={e => setMaterialType(e.target.value as "link" | "image" | "document")}
                      className="bg-card border border-border rounded-md px-2 py-2 text-[11px] outline-none focus:border-primary"
                    >
                      <option value="link">Link</option>
                      <option value="image">Image</option>
                      <option value="document">Document</option>
                    </select>
                    <input
                      value={materialUrl}
                      onChange={e => setMaterialUrl(e.target.value)}
                      placeholder={materialType === "document" ? "Source description" : "https://source-url"}
                      className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-[12px] outline-none focus:border-primary"
                    />
                    <button
                      onClick={addBuilderMaterial}
                      disabled={!materialName.trim() || !materialUrl.trim()}
                      className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-[11px] font-semibold disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => materialFileInputRef.current?.click()}
                      className="text-[11px] font-semibold bg-card border border-border rounded-md px-2.5 py-1.5 hover:border-primary hover:text-primary"
                    >
                      Upload File/Image
                    </button>
                    <input
                      ref={materialFileInputRef}
                      type="file"
                      multiple
                      accept=".ppt,.pptx,.pdf,.csv,.doc,.docx,.txt,image/*"
                      onChange={handleBuilderFileUpload}
                      className="hidden"
                    />
                    <span className="text-[10px] text-muted-foreground">Each upload requires guideline confirmation.</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/80">
                    Added materials appear as placeholders in the preview and in the top materials bar.
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/50 mb-2">
                Sections — drag to reorder
              </div>
              {currentBlocks.map((blk, bi) => (
                <div
                  key={blk.id}
                  onDragOver={e => handleDragOver(e, bi)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "border border-border rounded-lg mb-3 bg-card transition-all",
                    draggingIdx === bi && "opacity-50 border-primary"
                  )}
                >
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-secondary/30 rounded-t-lg">
                    <button
                      type="button"
                      draggable
                      onDragStart={() => handleDragStart(bi)}
                      onMouseDown={e => e.preventDefault()}
                      className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0"
                      title="Drag to reorder section"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-1 h-3.5 rounded bg-primary flex-shrink-0" />
                    <span className="text-[11px] font-bold text-foreground flex-1 truncate">{blk.name}</span>
                    <button
                      onClick={() => removeBlock(bi)}
                      title="Remove section"
                      className="text-muted-foreground/40 hover:text-destructive transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="p-3">
                    {blk.fields.map((f, fi) => (
                      <div key={fi} className="mb-2 last:mb-0">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{f.label}</label>
                        <textarea
                          value={f.value}
                          onChange={e => updateField(bi, fi, e.target.value)}
                          onDragStart={e => e.stopPropagation()}
                          className={cn(
                            "w-full border-[1.5px] border-border rounded-md p-2.5 text-[14px] leading-[1.7] text-foreground resize-y outline-none bg-secondary hover:border-muted-foreground/30 focus:border-primary focus:bg-card transition-all min-h-[120px]",
                            f.heading && "font-serif text-xl font-semibold text-pf-dark bg-card border-primary/50 focus:border-primary min-h-[80px]"
                          )}
                          rows={f.heading ? 3 : 6}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Compliance disclaimer */}
              <div className="border border-border rounded-lg p-3 bg-secondary/40 mt-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 rounded bg-warning" />
                  <span className="text-[11px] font-bold text-foreground">Compliance Disclaimer</span>
                </div>
                <label className="flex items-center gap-2 mb-2 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={complianceLocked}
                    onChange={e => setComplianceLocked(e.target.checked)}
                    className="w-[13px] h-[13px] accent-primary"
                  />
                  Lock disclaimer text
                </label>
                <textarea
                  value={complianceText}
                  onChange={e => { setComplianceText(e.target.value); setPreviewDirty(true); }}
                  className="w-full border border-border rounded-md p-2 text-[12px] leading-[1.6] text-foreground resize-y outline-none bg-card focus:border-primary transition-all"
                  rows={5}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => { setComplianceLocked(false); setComplianceText(suggestedDisclaimers.join("\n")); setPreviewDirty(true); }}
                    className="text-[11px] font-semibold text-primary hover:text-pf-dark"
                  >
                    Reset to Auto-Suggested
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={38} minSize={30}>
          <div className="h-full flex flex-col bg-secondary">
            <div className="bg-secondary border-b border-border p-2 flex items-center gap-2 flex-shrink-0">
              <div className="flex gap-1 mr-2">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-warning/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-success/40" />
              </div>
              <div className="flex-1 bg-card border border-border rounded-full px-3 py-1 text-[11px] font-mono text-muted-foreground">
                {pages[activePage]?.name} — {(ws.currentBrief?.projectTitle || "project").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 28)}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPreviewMode("desktop")}
                  className={cn(
                    "text-[10px] font-semibold px-2 py-1 rounded border",
                    previewMode === "desktop"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary hover:text-primary"
                  )}
                >
                  Desktop
                </button>
                <button
                  onClick={() => setPreviewMode("mobile")}
                  className={cn(
                    "text-[10px] font-semibold px-2 py-1 rounded border",
                    previewMode === "mobile"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary hover:text-primary"
                  )}
                >
                  Mobile
                </button>
              </div>
            </div>
            <div className="flex-1 p-3 overflow-auto">
              <div className={cn("h-full mx-auto bg-white border border-border rounded-md overflow-hidden", previewMode === "mobile" ? "max-w-[390px]" : "w-full")}>
                <iframe ref={iframeRef} className="w-full h-full border-none bg-white" srcDoc={previewHtml} />
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

function buildBlocks(ws: ReturnType<typeof import("@/contexts/WorkspaceContext").useWorkspace>, layoutOverride?: string): CanvasBlock[] {
  const b = ws.currentBrief;
  const layout = layoutOverride || ws.layout || "hero";
  const t = b?.projectTitle || "Company Name Page";
  const g = b?.goal || "Delivering impactful digital experiences.";
  const km = b?.keyMessages || ["Innovation", "Patient-centred", "Compliance"];
  const cs = b?.contentSections || ["Introduction", "Benefits", "CTA"];

  const layoutBlocks: Record<string, CanvasBlock[]> = {
    hero: [
      { id: "1", name: "Hero Banner", fields: [{ label: "Headline", value: t, heading: true }, { label: "Subheadline", value: g }] },
      { id: "2", name: "Feature Cards", fields: km.slice(0, 3).map((m, i) => ({ label: `Card ${i + 1}`, value: m })) },
      { id: "3", name: "Call to Action", fields: [{ label: "CTA Text", value: "Learn how Company Name is transforming healthcare." }] },
    ],
    "two-col": [
      { id: "1", name: "Main Content", fields: [{ label: "Title", value: t, heading: true }, { label: "Body", value: g + "\n\n" + cs.join(" — ") }] },
      { id: "2", name: "Sidebar", fields: km.map((m, i) => ({ label: `Point ${i + 1}`, value: m })) },
    ],
    cards: [
      { id: "1", name: "Header", fields: [{ label: "Title", value: t, heading: true }, { label: "Intro", value: g }] },
      ...km.slice(0, 3).map((m, i) => ({ id: String(i + 2), name: `Card ${i + 1}`, fields: [{ label: "Heading", value: m, heading: true }, { label: "Body", value: "Content from your brief." }] })),
    ],
    split: [
      { id: "1", name: "Left — Content", fields: [{ label: "Headline", value: t, heading: true }, { label: "Description", value: g }] },
      { id: "2", name: "Right — Media", fields: [{ label: "Caption", value: "[Insert visual asset here]" }] },
    ],
    article: [
      { id: "1", name: "Article", fields: [{ label: "Title", value: t, heading: true }, { label: "Lead", value: g }, { label: "Body", value: cs.join("\n\n") }] },
    ],
    minimal: [
      { id: "1", name: "Page Content", fields: [{ label: "Title", value: t, heading: true }, { label: "Body", value: g + "\n\n" + km.join("\n") }] },
    ],
  };

  return layoutBlocks[layout] || layoutBlocks.hero;
}

function buildComplianceDisclaimers(contentText: string, country: string): string[] {
  const disclaimers: string[] = [];

  if (country.includes("united kingdom") || country.includes("uk") || country.includes("eu") || country.includes("germany") || country.includes("france") || country.includes("italy") || country.includes("spain") || country.includes("netherlands")) {
    disclaimers.push("Regulatory note: Content intended for permitted audiences only. Ensure GDPR-compliant consent and lawful basis for any personal data collection.");
  }
  if (country.includes("united states") || country.includes("usa")) {
    disclaimers.push("Regulatory note: Include fair balance and important safety information where product claims are present.");
  }
  if (country.includes("japan")) {
    disclaimers.push("Regulatory note: Confirm local PMDA and promotional code alignment before publication.");
  }
  if (country.includes("australia")) {
    disclaimers.push("Regulatory note: Validate TGA-aligned claim language and mandatory safety statements.");
  }
  if (disclaimers.length === 0) {
    disclaimers.push("Regulatory note: Validate local market rules, consent requirements, and approved claims before release.");
  }

  if (/(efficacy|effective|superior|outperform|best|safe|safety|adverse|side effect|treat|treatment|clinical|trial|indication|dosage|contraindication)/.test(contentText)) {
    disclaimers.push("Content relevance note: Clinical, efficacy, or safety language detected. Route through Medical, Legal, and Regulatory review.");
  }

  return disclaimers;
}

export default BuilderPanel;
