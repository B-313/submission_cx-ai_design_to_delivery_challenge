# NotebookLLM UX - Quick Start

## Installation Complete ✅

Your brief-builder now has a **NotebookLLM-style source library**. Here's the 2-minute setup:

### **What Changed**
- ✨ **New left sidebar** - Source Library with collapsible toggle
- 📤 **Upload/Paste/Link** - Three ways to add sources
- ☑️ **Live selection** - Check boxes to include/exclude sources
- 📄 **Visual source display** - Icons and names for clarity

### **Start Using It**

1. **Open your workspace** (already live!)

2. **Add your first source**:
   - Click "Add Source" in the left sidebar
   - Choose File, Text, or Link
   - Paste your brand guidelines / compliance doc / evidence

3. **Select sources for your brief**:
   - Check the boxes next to sources you want to use
   - They show up as you build your brief

4. **Generate briefs with source context**:
   - Your selected sources are now available to the brief generator
   - The questionnaire + sources work together

### **Three Input Modes**

#### **File** 📁
- PDF, Word, Text, Markdown
- Click to upload from your computer
- Auto-extracted and stored

#### **Text** ✍️  
- Paste brand voice, audience research, compliance rules
- No file needed
- Great for: guidelines, messaging, tone descriptions

#### **Link** 🔗
- Paste any public URL
- Auto-extracts text content from the webpage
- Great for: external guidelines, published standards

### **Example Workflows**

#### **Scenario A: Build a brief with brand guidelines**
```
1. Upload my-brand-guidelines.pdf
2. Paste audience-research text
3. Check both boxes
4. Fill questionnaire → Generate
```

#### **Scenario B: Test two different source sets**
```
1. Upload 5 source documents
2. First brief: Select docs 1,2,3
3. Second brief: Select docs 4,5
4. Compare results
```

#### **Scenario C: Evolve sources over time**
```
1. Build brief with sources A,B,C
2. Find content gap
3. Upload new source D
4. Rebuild with A,B,C,D
5. Publish improved brief
```

### **Key Features**

| Feature | Where | How |
|---------|-------|-----|
| **Add Source** | Sidebar | Click "Add Source" button |
| **Select Source** | Sidebar | Check the checkbox |
| **Delete Source** | Sidebar | Click trash icon |
| **View Selected** | Sidebar | Shows count in footer |
| **See Sources** | Brief Editor | Selected sources display |
| **Collapse Sidebar** | Top-right | Click chevron icon |

### **Tips & Tricks**

✅ **Name your sources clearly**  
"Q1_2024_Brand_Guidelines" vs "file.pdf"

✅ **Use descriptive names for quick reference**  
Instead of "doc1.pdf", use "Clinical_Trial_Data_XYZ"

✅ **Organize by content type**  
Group all brand docs, then compliance, then evidence

✅ **Reuse source sets**  
Build a "Compliance Kit" with your standard docs

✅ **Export your briefs**  
Sources are embedded in the brief context

### **Storage**

- **Where**: Browser localStorage (automatic)
- **Size limit**: ~5-10MB per browser
- **Persistence**: Saved across sessions
- **Clear**: Remove old sources you don't need

### **Limitations**

- PDF extraction works best with text-based PDFs (not scanned images)
- Link extraction has a 12-second timeout
- Large files (50MB+) may be slow
- Some websites block automated scraping—if that happens, copy/paste the text instead

### **FileTypes Supported**

| Type | Extensions | How |
|------|-----------|-----|
| Files | .pdf, .docx, .txt, .md | Upload |
| Text | Any | Paste |
| Links | Any URL | Paste |

### **Next Level: API Integration**

When you're ready to pass sources to your ML pipeline:

```typescript
// In your brief generation call:
const brief = await generateBrief({
  brief_input: "...",
  selected_sources: selectedSourceIds,  // NEW
  country: "US"
});
```

See `useBriefWithSources.ts` for full examples.

---

## Troubleshooting

### **"Source not showing up"**
- Refresh the page (sources are in localStorage)
- Check file size (try a smaller document)
- Verify file format (.pdf, .docx, .txt)

### **"Checkbox not working"**
- Try clicking directly on the checkbox
- Make sure the source name is unique
- Refresh the page

### **"Link extraction failed"**
- Check that the URL is accessible
- Some sites block scraping—copy/paste text manually
- Try a different website

### **"Storage full"**
- Delete old sources you don't need
- localStorage has ~5-10MB limit
- Clear browser cache if needed

---

**You're all set!** Start using the source library in your brief-builder workflow. 🚀
