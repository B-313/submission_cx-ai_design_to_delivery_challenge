import { useState, useCallback, useRef } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

const LAYOUTS = [
  { id: "hero", name: "Hero + Cards", desc: "Bold banner with feature grid" },
  { id: "two-col", name: "Two Column", desc: "Content with sidebar" },
  { id: "cards", name: "Card Grid", desc: "Feature highlights in tiles" },
  { id: "split", name: "Split", desc: "50/50 image and content" },
  { id: "article", name: "Article", desc: "Long-form editorial" },
  { id: "minimal", name: "Minimal", desc: "Clean centred editorial" },
];

interface CanvasBlock {
  id: string;
  name: string;
  fields: { label: string; value: string; heading?: boolean }[];
}

const BuilderPanel = () => {
  const ws = useWorkspace();
  const [showLayoutPicker, setShowLayoutPicker] = useState(!ws.layout);
  const [blocks, setBlocks] = useState<CanvasBlock[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePickLayout = (layoutId: string) => {
    ws.setLayout(layoutId);
    ws.setActiveAgent(3);
    const b = ws.currentBrief;
    const t = b?.projectTitle || "Pfizer Page";
    const g = b?.goal || "Delivering impactful digital experiences.";
    const km = b?.keyMessages || ["Innovation", "Patient-centred", "Compliance"];
    const cs = b?.contentSections || ["Introduction", "Benefits", "CTA"];

    const layoutBlocks: Record<string, CanvasBlock[]> = {
      hero: [
        { id: "1", name: "Hero Banner", fields: [{ label: "Headline", value: t, heading: true }, { label: "Subheadline", value: g }] },
        { id: "2", name: "Feature Cards", fields: km.slice(0, 3).map((m, i) => ({ label: `Card ${i + 1}`, value: m })) },
        { id: "3", name: "Call to Action", fields: [{ label: "CTA Text", value: "Learn how Pfizer is transforming healthcare." }] },
      ],
      "two-col": [
        { id: "1", name: "Main Content", fields: [{ label: "Title", value: t, heading: true }, { label: "Body", value: g + "\n\n" + cs.join(" — ") }] },
        { id: "2", name: "Sidebar", fields: km.map((m, i) => ({ label: `Point ${i + 1}`, value: m })) },
      ],
      cards: [
        { id: "1", name: "Header", fields: [{ label: "Title", value: t, heading: true }, { label: "Intro", value: g }] },
        ...km.slice(0, 3).map((m, i) => ({ id: String(i + 2), name: `Card ${i + 1}`, fields: [{ label: "Heading", value: m, heading: true }, { label: "Body", value: "Pfizer content auto-populated from your brief." }] })),
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

    setBlocks(layoutBlocks[layoutId] || layoutBlocks.hero);
    setShowLayoutPicker(false);
    ws.setActiveAgent(null);
  };

  const updateField = (blockIdx: number, fieldIdx: number, value: string) => {
    setBlocks(prev => prev.map((b, bi) =>
      bi === blockIdx ? { ...b, fields: b.fields.map((f, fi) => fi === fieldIdx ? { ...f, value } : f) } : b
    ));
  };

  const generatePreviewHtml = useCallback(() => {
    const title = ws.currentBrief?.projectTitle || "Pfizer";
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
.footer{background:#003087;color:rgba(255,255,255,.65);text-align:center;padding:22px;font-size:12px;margin-top:48px}
</style></head><body><div class="nav"><span class="nav-logo">Pfizer</span></div>`;

    let isFirst = true;
    blocks.forEach(blk => {
      if (isFirst && blk.fields.length) {
        html += `<div class="hero"><h1>${blk.fields[0]?.value || blk.name}</h1><p>${blk.fields[1]?.value || ""}</p><a class="cta-btn">Learn More</a></div>`;
        isFirst = false;
      } else if (blk.name.toLowerCase().includes("card")) {
        html += `<div class="cards">${blk.fields.map(f => `<div class="card"><p>${f.value}</p></div>`).join("")}</div>`;
      } else {
        html += `<div class="section">${blk.fields.map((f, i) => i === 0 ? `<h2>${f.value || blk.name}</h2>` : `<p>${f.value}</p>`).join("")}</div>`;
      }
    });
    html += `<div class="footer">Pfizer Inc. · Draft Preview · Not for external distribution</div></body></html>`;
    return html;
  }, [blocks, ws.currentBrief]);

  // Layout picker overlay
  if (showLayoutPicker) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden animate-fade-up">
        <div className="bg-card border-b border-border px-5 py-2.5 flex items-center gap-3 flex-shrink-0">
          <span className="text-[13px] font-semibold text-pf-dark flex-1">Choose Layout</span>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-success/25 bg-success-light text-success">
            Agent 3 · Auto-layout
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="text-sm font-semibold text-foreground mb-4">Choose a layout — content auto-populates from your brief</div>
          <div className="grid grid-cols-3 gap-3">
            {LAYOUTS.map(l => (
              <button
                key={l.id}
                onClick={() => handlePickLayout(l.id)}
                className={cn(
                  "bg-card border-2 rounded-lg overflow-hidden transition-all shadow-pf hover:border-primary hover:shadow-pf-md hover:-translate-y-0.5 text-left",
                  ws.layout === l.id ? "border-primary shadow-[0_0_0_3px_hsla(200,100%,41%,0.18)]" : "border-border"
                )}
              >
                <div className="aspect-video bg-secondary p-2 flex flex-col gap-1">
                  <div className="flex-1 bg-gradient-to-br from-pf-dark to-pf-blue rounded flex items-center justify-center">
                    <div className="w-[60%] h-1 bg-white/70 rounded-full" />
                  </div>
                  <div className="flex gap-1 h-6">
                    <div className="flex-1 bg-card border border-border rounded" />
                    <div className="flex-1 bg-card border border-border rounded" />
                    <div className="flex-1 bg-card border border-border rounded" />
                  </div>
                </div>
                <div className="p-2.5">
                  <div className="text-xs font-bold text-foreground">{l.name}</div>
                  <div className="text-[11px] text-muted-foreground">{l.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Split screen: Edit left, Preview right
  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-up">
      <div className="bg-card border-b border-border px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <span className="text-[13px] font-semibold text-pf-dark flex-1">Builder</span>
        <button
          onClick={() => setShowLayoutPicker(true)}
          className="text-xs text-primary font-semibold hover:underline"
        >
          Change Layout
        </button>
        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-success/25 bg-success-light text-success">
          Agent 3 · Auto-layout
        </span>
        <button
          onClick={() => ws.goToStep(3)}
          className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-bold hover:bg-pf-dark transition-colors"
        >
          Proceed to Review →
        </button>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Edit panel */}
        <ResizablePanel defaultSize={45} minSize={30}>
          <div className="h-full overflow-y-auto p-5 bg-card">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/50 mb-3">Edit Content</div>
            {blocks.map((blk, bi) => (
              <div key={blk.id} className="border-b border-border pb-4 mb-4 last:border-b-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 rounded bg-primary" />
                  <span className="text-sm font-bold text-foreground">{blk.name}</span>
                </div>
                {blk.fields.map((f, fi) => (
                  <div key={fi} className="mb-2.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{f.label}</label>
                    <textarea
                      value={f.value}
                      onChange={e => updateField(bi, fi, e.target.value)}
                      className={cn(
                        "w-full border-[1.5px] border-border rounded-md p-2.5 text-[14px] leading-[1.7] text-foreground resize-none outline-none bg-secondary hover:border-muted-foreground/30 focus:border-primary focus:bg-card transition-all",
                        f.heading && "font-serif text-xl text-pf-dark border-none border-b-2 border-b-primary rounded-none bg-card p-0 pb-2"
                      )}
                      rows={f.heading ? 1 : 2}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Live preview */}
        <ResizablePanel defaultSize={55} minSize={30}>
          <div className="h-full flex flex-col bg-secondary">
            <div className="bg-secondary border-b border-border p-2 flex items-center gap-2 flex-shrink-0">
              <div className="flex gap-1 mr-2">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-warning/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-success/40" />
              </div>
              <div className="flex-1 bg-card border border-border rounded-full px-3 py-1 text-[11px] font-mono text-muted-foreground">
                pfizer-draft.preview/{ws.user?.empNumber || "pfz"}/{(ws.currentBrief?.projectTitle || "project").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 36)}
              </div>
            </div>
            <iframe
              ref={iframeRef}
              className="flex-1 border-none bg-white"
              srcDoc={generatePreviewHtml()}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default BuilderPanel;
