export const onRequestGet: PagesFunction = async (context) => {
  const hasGeminiKey = !!context.env.GOOGLE_AI_STUDIO_KEY;
  const hasAdminKey = !!context.env.ADMIN_SECRET_KEY;

  return new Response(
    JSON.stringify({
      ok: true,
      hasGeminiKey,
      hasAdminKey,
      envKeysVisible: Object.keys(context.env || {}).length > 0,
    }, null, 2),
    { headers: { "content-type": "application/json" } }
  );
};
