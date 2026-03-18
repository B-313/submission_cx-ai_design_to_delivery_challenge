# NotebookLLM-Style UX Guide

## Overview
Your brief-builder now includes a **NotebookLLM-inspired interface** that lets you upload or paste source materials (brand guidelines, research, compliance docs, audience insights) and use them to fuel brief generation.

## Key Features

### 1. **Source Library** (Left Sidebar)
- **Collapsible sidebar** that shows all your uploaded sources
- Toggle between collapsed and expanded states
- Click the **chevron icon** to toggle the sidebar visibility
- Shows source count and selected count at the bottom

### 2. **Upload/Paste Sources**
Click **"Add Source"** to choose one of three input methods:

#### **File Upload**
- Upload PDFs, Word documents (`.docx`), plain text (`.txt`), or Markdown (`.md`)
- Files are extracted and stored locally in the source library
- Ideal for: brand guidelines, clinical data, regulatory documents

#### **Text Paste**
- Directly paste content (audience research, tone guidelines, compliance rules)
- Great for: brand voice descriptions, target audience profiles, key messages

#### **Link Input**
- Paste a URL to any public webpage
- The system automatically extracts text content from the page (via Jina Reader)
- Perfect for: external references, published guidelines, industry standards

### 3. **Source Selection**
- Each source has a **checkbox** on the left
- Check the box to **include that source** when building your brief
- Uncheck to **exclude** a source
- The selection is live: when you change which sources are selected, the brief generation uses only those selected sources

### 4. **Source Visibility**
During brief building (ideation, preliminary, and builder phases), the sidebar displays all available sources. You can:
- Toggle sources in/out for different brief versions
- See exactly which sources contributed to each generated brief
- Paste in new sources and immediately use them in your next brief attempt

## How It Works in Practice

### Scenario 1: Build a Brief Using Brand Guidelines
1. Upload your **brand guidelines PDF**
2. Paste your **target audience research** as text
3. Add a **link to regulatory documentation**
4. Select all three sources using the checkboxes
5. Fill in the questionnaire and click "Generate Brief"
6. The system retrieves relevant content from your selected sources to enriched the generated brief

### Scenario 2: Compare Briefs with Different Sources
1. Upload 5 different compliance documents
2. First brief: Select sources 1, 2, 3 → Generate
3. Second brief: Select sources 4, 5 → Generate
4. Compare the two briefs and choose the best one

### Scenario 3: Refine with New Evidence
1. Build a brief with your initial sources
2. Find a gap in the generated brief
3. Upload a new clinical study or evidence
4. Include the new source in your next iteration
5. Generate a new brief with the enhanced source set

## UI Components Created

### SourceLibrary.tsx
- Displays the left sidebar
- Manages source list and selection state
- Shows source icons by type (file, link, text)
- Provides delete functionality for each source

### SourceUploader.tsx
- Three-mode interface: File, Text, Link
- File extraction for PDFs/Word/text
- Link content fetching via Jina Reader
- Validation and feedback

### SourceSnippet.tsx
- Inline display showing selected sources
- Shows source count and names
- Inserted into the brief editor for context

## Integration Points

### In BriefEditorPanel
- `selectedSources` prop passed from Workspace
- Can display which sources are being used
- Sources can be incorporated into the generation prompt

### In other panels
- All panels (Registration, Preliminary, Builder, Review, Submit) accept `selectedSources` for consistency
- Currently used primarily in BriefEditorPanel but available for future expansion

## Advanced Usage Tips

### 1. **Organize by Phase**
- Upload brand materials in the first phase
- Add evidence and research later
- Refine documentation as you move through the workflow

### 2. **Annotation**
- Use descriptive source names to identify content quickly
- Example: "Pfizer_Brand_Guidelines_2024" instead of "file.pdf"

### 3. **Version Control**
- Keep track of which sources created which briefs
- Use version naming: "Brief_v1_sources_1-3", "Brief_v2_sources_4-5"

### 4. **Reusability**
- Upload source sets once, use across multiple briefs
- The system persists your materials across sessions
- Build a library of re-usable compliance, brand, and evidence sources

## Technical Details

### Source Interface
```typescript
interface WorkspaceMaterial {
  id: string;
  name: string;
  type: "document" | "link" | "text";
  source: string;  // actual content or URL
  stage: "ideation" | "builder";
}
```

### File Size Limits
- PDFs: Up to 50MB (practical limit ~100 pages)
- Word docs: Up to 10MB
- Text paste: No hard limit, but >50KB may slow extraction
- Links: Content is extracted up to 8000 characters

### Storage
- Sources are stored in browser localStorage initially
- Can be extended to Supabase for persistence and sharing
- Currently cleared when browser storage is cleared

## Troubleshooting

### Source not appearing in list?
- Check that the file format is supported (.pdf, .docx, .txt, .md)
- Verify the file isn't corrupted

### Link content not extracted?
- The webpage must be publicly accessible
- Some sites block automated scraping—paste text manually instead
- Large pages may timeout—copy/paste key excerpts

### Changes not persisting?
- Browser localStorage has limits (~5-10MB)
- Clear old sources you no longer need
- Export your briefs before clearing storage

## Future Enhancements

Potential next steps to extend this UX:
- **Drag-and-drop** reordering of sources
- **Tags/Collections** to group related sources
- **Search/Filter** across source library
- **Sharing** source sets with team members via Supabase
- **Source Preview** modal to see full content before using
- **Citation Tracking** to know exactly which source contributed which claim
- **Version History** of sources (track updates to uploaded docs)
