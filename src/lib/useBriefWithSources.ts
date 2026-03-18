// Example: Using Selected Sources in Brief Generation API Call
// This shows how to integrate selectedSources into your brief generation flow

import { useWorkspace } from "@/contexts/WorkspaceContext";

/**
 * Hook to build API payload with selected sources
 */
export function useBriefGenerationWithSources(selectedSourceIds: string[]) {
  const { materials } = useWorkspace();

  const buildSourceContext = (): {
    sources: Array<{ name: string; type: string; excerpt: string }>;
    sourceCount: number;
  } => {
    const selectedMaterials = materials.filter((m) => selectedSourceIds.includes(m.id));

    return {
      sources: selectedMaterials.map((mat) => ({
        name: mat.name,
        type: mat.type,
        excerpt: mat.source.slice(0, 500), // First 500 chars as preview
      })),
      sourceCount: selectedMaterials.length,
    };
  };

  /**
   * Example: POST to /brief/build with sources
   */
  const generateBriefWithSources = async (briefInput: {
    brief_input: string;
    country: string;
    audience_hint?: string;
    objective?: string;
    brand_id?: string;
  }) => {
    const sourceContext = buildSourceContext();
    const selectedMaterials = materials.filter((m) => selectedSourceIds.includes(m.id));

    // Build enhanced prompt that includes source info
    const enhancedInput = {
      ...briefInput,
      // Pass source names/excerpts for Groq to reference
      source_context: sourceContext.sources.map((s) => `[${s.type}] ${s.name}: ${s.excerpt}`).join("\n\n"),
      // Or pass to RAG pipeline for retrieval-augmented generation
      selected_source_ids: selectedSourceIds, // If your API supports this
    };

    try {
      const response = await fetch("http://localhost:8000/brief/build", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(enhancedInput),
      });

      return await response.json();
    } catch (error) {
      console.error("Brief generation failed:", error);
      throw error;
    }
  };

  return {
    buildSourceContext,
    generateBriefWithSources,
    selectedMaterialCount: materials.filter((m) => selectedSourceIds.includes(m.id)).length,
  };
}

/**
 * Example: Rendering sources in a brief submission
 */
export function SourceAttribution({ sourceIds: string[] }) {
  const { materials } = useWorkspace();
  const selectedMaterials = materials.filter((m) => sourceIds.includes(m.id));

  if (selectedMaterials.length === 0) return null;

  return (
    <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
      <p className="text-xs font-semibold mb-2">Sources Used</p>
      <ul className="text-xs space-y-1">
        {selectedMaterials.map((mat) => (
          <li key={mat.id} className="text-muted-foreground">
            • {mat.name} ({mat.type})
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Example: Extending /brief/check-items to use selected sources
 */
export async function batchCheckContentWithSources(
  items: Array<{ item_id: string; content: string }>,
  selectedSourceIds: string[],
  country: string,
  materialsContext: any[] // materials array from WorkspaceContext
) {
  const payload = {
    items,
    country,
    brand_id: "default", // or dynamic
    top_k: 3,
    // Include source IDs or excerpts for the check endpoint
    source_context: materialsContext
      .filter((m) => selectedSourceIds.includes(m.id))
      .map((m) => `[${m.type}] ${m.name}: ${m.source.slice(0, 200)}`),
  };

  try {
    const response = await fetch("http://localhost:8000/brief/check-items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return await response.json();
  } catch (error) {
    console.error("Content check failed:", error);
    throw error;
  }
}
