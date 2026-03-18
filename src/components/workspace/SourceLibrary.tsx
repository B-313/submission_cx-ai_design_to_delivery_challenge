import { useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Link2, MessageSquare, Plus, Trash2, Check, BookOpen } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import SourceUploader from "./SourceUploader";

interface SourceLibraryProps {
  isCollapsed: boolean;
  onToggle: () => void;
  selectedSources: string[];
  onSourceSelect: (sourceIds: string[]) => void;
}

export default function SourceLibrary({
  isCollapsed,
  onToggle,
  selectedSources,
  onSourceSelect,
}: SourceLibraryProps) {
  const { materials, addMaterial, removeMaterial } = useWorkspace();
  const [showUploader, setShowUploader] = useState(false);

  const sources = materials;

  const handleSourceToggle = (sourceId: string) => {
    if (selectedSources.includes(sourceId)) {
      onSourceSelect(selectedSources.filter((id) => id !== sourceId));
    } else {
      onSourceSelect([...selectedSources, sourceId]);
    }
  };

  const handleAddSource = (source: Omit<any, "id">) => {
    addMaterial(source);
    setShowUploader(false);
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "document":
        return <FileText className="w-4 h-4" />;
      case "link":
        return <Link2 className="w-4 h-4" />;
      case "text":
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4" />;
    }
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={`bg-card border-r border-border transition-all duration-300 flex flex-col ${
          isCollapsed ? "w-0 overflow-hidden" : "w-72"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-sm">Sources</h2>
          </div>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
            title="Collapse sources"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Add Source Button */}
        <div className="p-3 border-b border-border">
          <button
            onClick={() => setShowUploader(!showUploader)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-primary text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Source
          </button>
        </div>

        {/* Upload Panel */}
        {showUploader && (
          <div className="p-3 border-b border-border bg-muted/50">
            <SourceUploader onAdd={handleAddSource} onCancel={() => setShowUploader(false)} />
          </div>
        )}

        {/* Sources List */}
        <div className="flex-1 overflow-y-auto">
          {sources.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <p>No sources yet</p>
              <p className="text-xs mt-2">Upload or paste content to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sources.map((source) => (
                <div key={source.id} className="p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-2 mb-2">
                    <button
                      onClick={() => handleSourceToggle(source.id)}
                      className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                        selectedSources.includes(source.id)
                          ? "bg-primary text-primary-foreground"
                          : "border border-border hover:bg-muted"
                      }`}
                      title={
                        selectedSources.includes(source.id)
                          ? "Use this source"
                          : "Don't use this source"
                      }
                    >
                      {selectedSources.includes(source.id) ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <div className="w-3 h-3" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getSourceIcon(source.type)}
                        <p className="text-xs font-medium truncate">{source.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{source.type}</p>
                    </div>
                    <button
                      onClick={() => removeMaterial(source.id)}
                      className="flex-shrink-0 p-1 hover:bg-destructive/20 text-destructive rounded transition-colors"
                      title="Delete source"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <p>{sources.length} source(s)</p>
          <p>{selectedSources.length} selected</p>
        </div>
      </div>

      {/* Toggle Button (when collapsed) */}
      {isCollapsed && (
        <button
          onClick={onToggle}
          className="flex-shrink-0 p-2 hover:bg-muted rounded-lg transition-colors border-r border-border"
          title="Expand sources"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </>
  );
}
