import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(JSON.stringify({ sent: false, reason: "retired" }), {
  status: 410,
  headers: { "Content-Type": "application/json" },
}));
