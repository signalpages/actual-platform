export const onRequestGet: PagesFunction = async () => {
  return new Response(
    JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED", hint: "POST /api/audit" }),
    { status: 405, headers: { "content-type": "application/json" } }
  );
};

export const onRequestPost: PagesFunction = async (ctx) => {
  const key = ctx.env.GOOGLE_AI_STUDIO_KEY as string | undefined;

  if (!key) {
    return new Response(
      JSON.stringify({ ok: false, error: "MISSING_SERVER_KEY" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  // parse request
  let body: any = null;
  try {
    body = await ctx.request.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "BAD_JSON" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  // TODO: run your Google GenAI call here (SERVER ONLY)
  // IMPORTANT: do NOT return the key, do NOT log it.

  return new Response(
    JSON.stringify({ ok: true, received: true }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};
