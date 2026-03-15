import { supabase } from "@/integrations/supabase/client";

function getJudgeAccessKey() {
  const sessionKey = sessionStorage.getItem("judge_access_key");
  if (sessionKey) return sessionKey;
  return localStorage.getItem("judge_access_key");
}

export function saveJudgeAccessKey(key: string, persist = false) {
  const normalized = key.trim();
  if (!normalized) return;
  sessionStorage.setItem("judge_access_key", normalized);
  if (persist) {
    localStorage.setItem("judge_access_key", normalized);
  } else {
    localStorage.removeItem("judge_access_key");
  }
}

export async function invokeProtectedFunction<TBody extends Record<string, unknown>, TResponse = unknown>(
  functionName: string,
  body: TBody,
): Promise<{ data: TResponse | null; error: Error | null }> {
  const judgeAccessKey = getJudgeAccessKey();
  if (!judgeAccessKey) {
    return {
      data: null,
      error: new Error("Judge access key missing. Register once with a valid key to enable protected AI endpoints."),
    };
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: {
      "x-judge-access-key": judgeAccessKey,
    },
  });

  return { data: (data as TResponse) ?? null, error };
}
