import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN")!;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to refresh Google token: ${err}`);
  }

  const data = await resp.json();
  return data.access_token;
}

function isBusinessHours(dateStr: string): boolean {
  const date = new Date(dateStr);
  const day = date.getDay(); // 0=Sun, 6=Sat
  const hour = date.getHours();
  return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
}

function suggestNextSlot(): string {
  const now = new Date();
  // Move to next business day at 10:00 BRT (UTC-3)
  let date = new Date(now);
  date.setHours(13, 0, 0, 0); // 10:00 BRT = 13:00 UTC

  // If it's past 15:00 UTC (12:00 BRT) or weekend, move to next day
  if (now.getUTCHours() >= 15 || now.getDay() === 0 || now.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }

  // Skip weekends
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }

  return date.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, lead_id, email_lead, data_hora, titulo, descricao, user_id } = await req.json();

    if (action === "suggest_slot") {
      const slot = suggestNextSlot();
      return new Response(JSON.stringify({ ok: true, suggested_slot: slot }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_event") {
      if (!email_lead || !data_hora || !lead_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isBusinessHours(data_hora)) {
        const suggested = suggestNextSlot();
        return new Response(JSON.stringify({
          ok: false,
          error: "outside_business_hours",
          message: "Horário fora do expediente (seg-sex 9h-18h). Sugestão alternativa disponível.",
          suggested_slot: suggested,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get access token via refresh token
      const accessToken = await getAccessToken();

      const eventTitle = titulo || "Reunião Vallor";
      const eventDesc = descricao || "Reunião agendada via CRM Vallor";

      const startTime = new Date(data_hora);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour

      const event = {
        summary: eventTitle,
        description: eventDesc,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "America/Sao_Paulo",
        },
        attendees: [{ email: email_lead }],
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 60 },
            { method: "popup", minutes: 15 },
          ],
        },
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      };

      const calResp = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      if (!calResp.ok) {
        const errText = await calResp.text();
        console.error("Google Calendar error:", errText);
        return new Response(JSON.stringify({ ok: false, error: "calendar_api_error", details: errText }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const calData = await calResp.json();

      // Save to agendamentos table
      const { error: dbError } = await supabase.from("agendamentos").insert({
        lead_id,
        user_id: user_id || null,
        data_hora,
        email_lead,
        titulo: eventTitle,
        descricao: eventDesc,
        google_event_id: calData.id,
        status: "agendado",
      });

      if (dbError) console.error("DB insert error:", dbError);

      return new Response(JSON.stringify({
        ok: true,
        event_id: calData.id,
        html_link: calData.htmlLink,
        meet_link: calData.hangoutLink || calData.conferenceData?.entryPoints?.[0]?.uri || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("google-calendar error:", e);
    return new Response(JSON.stringify({ error: "Internal error", details: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
