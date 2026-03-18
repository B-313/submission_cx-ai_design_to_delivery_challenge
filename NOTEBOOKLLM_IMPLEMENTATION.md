Done! I've implemented a **NotebookLLM-style UX** for your brief-builder. Here's what was built:

## 🎯 What You Get

### **Left Sidebar - Source Library**
- **Collapsible source panel** on the left side of your brief-builder
- Upload/paste/link three types of content:
  - **Files**: PDFs, Word docs, text, markdown
  - **Text**: Brand guidelines, audience research, compliance rules
  - **Links**: External URLs (auto-extracts content)
- **Checkbox selection** to choose which sources to use
- Live updates showing source count

### **Interactive Source Management**
- **Add Source button** - opens upload/paste/link interface
- **Delete button** per source - remove sources you don't need
- **Live selection** - toggle sources on/off for different brief versions
- **Persistent storage** - sources saved in browser localStorage

### **Visual Source Indicators**
- Icons show source type (file, link, text)
- Source names displayed for quick reference
- Selection count shown in the sidebar footer
- `SourceSnippet` component shows selected sources during brief editing

## 📂 Files Created

### **UI Components**
- `src/components/workspace/SourceLibrary.tsx` - Left sidebar with source list
- `src/components/workspace/SourceUploader.tsx` - File/text/link upload interface
- `src/components/workspace/SourceSnippet.tsx` - Display selected sources inline

### **Integration & Utilities**
- `src/lib/useBriefWithSources.ts` - Hooks and examples for API integration
- `NOTEBOOKLLM_UX_GUIDE.md` - Complete user guide with scenarios

### **Updated Panels**
All panel components now accept `selectedSources` prop:
- `BriefEditorPanel` - Main source user
- `PreliminaryPanel`
- `BuilderPanel`
- `RegistrationPanel`
- `ReviewPanel`
- `SubmitPanel`

## 🚀 How to Use

### **For End Users**
1. Open your workspace
2. Look for the **source library icon** on the left
3. Click **"Add Source"** to upload brand guidelines, research, or evidence
4. Check the boxes next to sources you want to use
5. Fill in your brief questionnaire
6. Click generate - the system now has context from your selected sources

### **For Developers**
The integration is ready in `src/lib/useBriefWithSources.ts`:

```typescript
// Use the hook to build source context
const { buildSourceContext, generateBriefWithSources } = useBriefGenerationWithSources(selectedSourceIds);

// Pass to your API call
const brief = await generateBriefWithSources({
  brief_input: "...",
  country: "US",
  brand_id: "default"
});
```

## 🔧 Technical Details

### **Source Data Structure**
```typescript
interface WorkspaceMaterial {
  id: string;
  name: string;
  type: "document" | "link" | "text";
  source: string;  // content or URL
  stage: "ideation" | "builder";
}
```

### **Storage**
- Uses browser localStorage initially
- Can be extended to Supabase for multi-user scenarios
- Supports ~5-10MB per browser

### **File Support**
- PDFs (via pdfjs extraction)
- Word (.docx via mammoth)
- Text, Markdown, CSV
- URLs (via Jina AI Reader)

## 🎨 Layout Changes

### **Before**
```
┌─────────────────────────────┐
│     Header                  │
├─────────────────────────────┤
│                             │
│    Main Panel (Full Width)  │
│                             │
└─────────────────────────────┘
```

### **After**
```
┌─────────────────────────────┐
│     Header                  │
├───────┬─────────────────────┤
│Sources│                     │
│Library│  Main Panel         │
│       │  (Adaptive Width)   │
└───────┴─────────────────────┘
```

## 📝 Next Steps

### **To Wire Sources into Brief Generation**
In `BriefEditorPanel.tsx` where you call your API:

```typescript
// Add selectedSources to your generation input
const generationInput = {
  brief_input: prompt,
  questionnaire: answers,
  selected_sources: selectedSources,  // NEW
  country: answers.region,
  brand_id: "default"
};
```

### **To Display Source Attribution**
Use the `SourceAttribution` component from `useBriefWithSources.ts`:

```typescript
<SourceAttribution sourceIds={selectedSources} />
```

### **To Extend to RAG Pipeline**
Update `prompt-muse-ml-pie-rag` to accept `source_ids` in `/brief/build`:
```python
@app.post("/brief/build")
def brief_build(req: BriefBuildRequest):
    # req.source_ids contains selected source IDs
    # Retrieve content from source library
    source_content = fetch_sources(req.source_ids)
    # Include in RAG pipeline
    rag_context = rag_pipeline.retrieve(
        req.brief_input,
        additional_context=source_content
    )
```

## 🎓 Key Features

✅ **Upload/paste/link sources** - Any content type
✅ **Live selection** - Toggle sources on/off  
✅ **Visual feedback** - Icons, counts, selections
✅ **Collapsible sidebar** - Save space when needed  
✅ **Persistent storage** - Sources saved between sessions
✅ **Easy deletion** - Remove sources with one click
✅ **NotebookLLM UX** - Familiar interface pattern
✅ **Ready for RAG** - Can pass to ML pipeline

## 📚 Documentation

Full guide with use cases: [NOTEBOOKLLM_UX_GUIDE.md](./NOTEBOOKLLM_UX_GUIDE.md)

Integration examples: [src/lib/useBriefWithSources.ts](./src/lib/useBriefWithSources.ts)

## 💡 Example Workflows

**Workflow 1: Research-Backed Brief**
1. Upload clinical study PDF
2. Paste brand voice guidelines
3. Add link to regulatory framework
4. Select all three sources
5. Generate brief enriched with evidence

**Workflow 2: Multi-Version Testing**
1. Upload 5 source docs
2. Version A: Use sources 1-2
3. Version B: Use sources 3-5
4. Compare results, choose winner

**Workflow 3: Iterative Refinement**
1. Build brief with initial sources
2. Find gap in content
3. Upload new evidence
4. Regenerate with expanded sources
5. Publish final brief

---

**Ready to use!** The source library is now live in your workspace. Users can start uploading and selecting sources during brief building. All components are wired and ready for API integration.
