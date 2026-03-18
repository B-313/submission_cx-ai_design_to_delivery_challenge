import { useWorkspace } from "@/contexts/WorkspaceContext";
import { FileText, Link2, MessageSquare, BookOpen } from "lucide-react";

interface SourceSnippetProps {
  selectedSourceIds: string[];
}

export default function SourceSnippet({ selectedSourceIds }: SourceSnippetProps) {
  const { materials } = useWorkspace();

  if (selectedSourceIds.length === 0) {
    return (
      <div className="px-4 py-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
        No sources selected — brief will be generated from prompt and questionnaire only
      </div>
    );
  }

  const selectedMaterials = materials.filter((m) => selectedSourceIds.includes(m.id));

  const getIcon = (type: string) => {
    switch (type) {
      case "document":
        return <FileText className="w-3.5 h-3.5" />;
      case "link":
        return <Link2 className="w-3.5 h-3.5" />;
      case "text":
        return <MessageSquare className="w-3.5 h-3.5" />;
      default:
        return <BookOpen className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="px-4 py-3 rounded-lg bg-primary/5 border border-primary/20">
      <p className="text-xs font-semibold text-primary mb-2">
        Using {selectedSourceIds.length} source{selectedSourceIds.length === 1 ? "" : "s"}
      </p>
      <div className="space-y-1.5">
        {selectedMaterials.map((material) => (
          <div key={material.id} className="flex items-center gap-2 text-xs">
            {getIcon(material.type)}
            <span className="text-foreground truncate">{material.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
