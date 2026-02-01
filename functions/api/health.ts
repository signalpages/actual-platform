export const onRequestGet: PagesFunction = async (ctx) => {
  return new Response(
    JSON.stringify({
      ok: true,
      envHasKey: !!ctx.env.GOOGLE_AI_STUDIO_KEY,
    }),
    { headers: { "content-type": "application/json" } }
  );
};
