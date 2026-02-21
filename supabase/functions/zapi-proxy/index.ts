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
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
    if (!clientToken) {
      return new Response(
        JSON.stringify({ error: "ZAPI_CLIENT_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, instance_id, token } = await req.json();

    const instId = instance_id || Deno.env.get("ZAPI_INSTANCE");
    const instToken = token || Deno.env.get("ZAPI_TOKEN");

    if (!instId || !instToken) {
      return new Response(
        JSON.stringify({ error: "Missing Z-API instance/token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const base = `https://api.z-api.io/instances/${instId}/token/${instToken}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Client-Token": clientToken,
    };

    let endpoint = "";
    let method = "GET";

    if (action === "qr-code") {
      endpoint = "/qr-code";
    } else if (action === "status") {
      endpoint = "/status";
    } else if (action === "get-phone") {
      endpoint = "/phone";
    } else {
      return new Response(
        JSON.stringify({ error: "Unknown action. Use: qr-code, status, get-phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Z-API proxy: ${action} -> ${base}${endpoint}`);

    const resp = await fetch(`${base}${endpoint}`, { method, headers });
    const data = await resp.json();

    console.log(`Z-API response (${action}):`, JSON.stringify(data));

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("zapi-proxy error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
