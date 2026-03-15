declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

export function requireJudgeAccess(req: Request, corsHeaders: Record<string, string>) {
  const expected = Deno.env.get("JUDGE_ACCESS_KEY");
  if (!expected) {
    return new Response(JSON.stringify({ error: "Server misconfiguration: JUDGE_ACCESS_KEY is not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const provided = req.headers.get("x-judge-access-key")?.trim();
  if (!provided || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return null;
}
