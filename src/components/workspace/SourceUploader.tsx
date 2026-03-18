import { useState } from "react";
import { Upload, Paste, Link as LinkIcon, X } from "lucide-react";

interface SourceUploaderProps {
  onAdd: (source: { name: string; type: "document" | "link" | "text"; source: string; stage: "ideation" | "builder" }) => void;
  onCancel: () => void;
}

type UploadMode = "file" | "text" | "link";

export default function SourceUploader({ onAdd, onCancel }: SourceUploaderProps) {
  const [mode, setMode] = useState<UploadMode>("text");
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      onAdd({
        name: file.name,
        type: "document",
        source: text,
        stage: "ideation",
      });
    } catch (error) {
      console.error("Failed to read file:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSource = () => {
    if (!content.trim()) {
      alert("Please enter content");
      return;
    }

    if (!name.trim()) {
      alert("Please enter a source name");
      return;
    }

    onAdd({
      name: name.trim(),
      type: mode === "link" ? "link" : mode === "file" ? "document" : "text",
      source: content.trim(),
      stage: "ideation",
    });

    setContent("");
    setName("");
  };

  return (
    <div className="space-y-3">
      {/* Mode Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("file")}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
            mode === "file"
              ? "bg-primary text-primary-foreground"
              : "border border-border hover:bg-muted"
          }`}
        >
          <Upload className="w-3 h-3" />
          File
        </button>
        <button
          onClick={() => setMode("text")}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
            mode === "text"
              ? "bg-primary text-primary-foreground"
              : "border border-border hover:bg-muted"
          }`}
        >
          <Paste className="w-3 h-3" />
          Paste
        </button>
        <button
          onClick={() => setMode("link")}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
            mode === "link"
              ? "bg-primary text-primary-foreground"
              : "border border-border hover:bg-muted"
          }`}
        >
          <LinkIcon className="w-3 h-3" />
          Link
        </button>
      </div>

      {/* Name Input */}
      <input
        type="text"
        placeholder="Source name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-2 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:border-primary"
      />

      {/* File Upload */}
      {mode === "file" && (
        <label className="block">
          <div className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
            <p className="text-xs text-muted-foreground">Click to upload PDF, DOCX, or TXT</p>
          </div>
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={loading}
            className="hidden"
            accept=".pdf,.docx,.txt,.md"
          />
        </label>
      )}

      {/* Text Paste */}
      {mode === "text" && (
        <textarea
          placeholder="Paste brand guidelines, research, or audience insights..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-2 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:border-primary resize-none h-24"
        />
      )}

      {/* Link Input */}
      {mode === "link" && (
        <input
          type="url"
          placeholder="https://example.com/resource"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-2 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:border-primary"
        />
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleAddSource}
          disabled={loading}
          className="flex-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Processing..." : "Add"}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 px-2 py-1 text-xs border border-border rounded hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
