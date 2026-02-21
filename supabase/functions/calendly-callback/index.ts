import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${Deno.env.get("SITE_URL") || "https://crmvallor.lovable.app"}/agenda?error=${encodeURIComponent(error)}` },
    });
  }

  if (!code) {
    return new Response(JSON.stringify({ error: "Missing code parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Exchange code for access token
  try {
    const clientId = Deno.env.get("CALENDLY_CLIENT_ID");
    const clientSecret = Deno.env.get("CALENDLY_CLIENT_SECRET");
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/calendly-callback`;

    const tokenRes = await fetch("https://auth.calendly.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId || "",
        client_secret: clientSecret || "",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || "Token exchange failed");
    }

    // Redirect back to app with success
    const redirectUrl = new URL(`${Deno.env.get("SITE_URL") || "https://crmvallor.lovable.app"}/agenda`);
    redirectUrl.searchParams.set("calendly_connected", "true");
    if (state) redirectUrl.searchParams.set("state", state);

    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl.toString() },
    });
  } catch (err) {
    console.error("Calendly callback error:", err);
    return new Response(null, {
      status: 302,
      headers: { Location: `${Deno.env.get("SITE_URL") || "https://crmvallor.lovable.app"}/agenda?error=callback_failed` },
    });
  }
});
