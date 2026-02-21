import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, instance_id, token } = await req.json();

    // Use provided instance/token or fallback to env
    const instId = instance_id || Deno.env.get("ZAPI_INSTANCE");
    const instToken = token || Deno.env.get("ZAPI_TOKEN");

    if (!instId || !instToken) {
      return new Response(
        JSON.stringify({ error: "Missing Z-API credentials" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const base = `https://api.z-api.io/instances/${instId}/token/${instToken}`;

    if (action === "qr-code") {
      const resp = await fetch(`${base}/qr-code`, { method: "GET" });
      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const resp = await fetch(`${base}/status`, { method: "GET" });
      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-phone") {
      const resp = await fetch(`${base}/phone`, { method: "GET" });
      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use: qr-code, status, get-phone" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("zapi-proxy error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
