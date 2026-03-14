import { supabase } from "@/integrations/supabase/client";
import type { BriefAnalysis } from "@/types/analysis";

export async function analyzeBrief(brief: string): Promise<BriefAnalysis> {
  const { data, error } = await supabase.functions.invoke("analyze-brief", {
    body: { brief },
  });

  if (error) {
    throw new Error(error.message || "Failed to analyze brief");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as BriefAnalysis;
}
