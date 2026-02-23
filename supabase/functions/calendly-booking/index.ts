import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { action } = body;

    // Get Calendly config from agente_config
    const { data: agente } = await supabase
      .from("agente_config")
      .select("calendly_token, calendly_event_type_uri")
      .limit(1)
      .single();

    // Also allow overriding with env vars
    const CALENDLY_TOKEN = agente?.calendly_token || Deno.env.get("CALENDLY_PERSONAL_TOKEN");
    const CALENDLY_EVENT_TYPE_URI = agente?.calendly_event_type_uri || Deno.env.get("CALENDLY_EVENT_TYPE_URI");

    if (!CALENDLY_TOKEN || !CALENDLY_EVENT_TYPE_URI) {
      return new Response(
        JSON.stringify({ ok: false, error: "Calendly não configurado. Adicione o Personal Access Token e Event Type URI na tela Configuração do Agente IA." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the event type UUID from the URI
    const eventTypeUUID = CALENDLY_EVENT_TYPE_URI.split("/").pop();

    if (action === "get_available_slots") {
      // Get user URI from current user info
      const userResp = await fetch("https://api.calendly.com/users/me", {
        headers: { Authorization: `Bearer ${CALENDLY_TOKEN}` },
      });
      if (!userResp.ok) {
        const err = await userResp.text();
        return new Response(
          JSON.stringify({ ok: false, error: "Calendly auth error", details: err }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const userInfo = await userResp.json();
      const userUri = userInfo.resource?.uri;

      // Availability: next 7 days
      const now = new Date();
      const startTime = now.toISOString();
      const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const availResp = await fetch(
        `https://api.calendly.com/event_type_available_times?event_type=${CALENDLY_EVENT_TYPE_URI}&start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`,
        { headers: { Authorization: `Bearer ${CALENDLY_TOKEN}` } }
      );

      if (!availResp.ok) {
        const err = await availResp.text();
        console.error("Calendly availability error:", err);
        return new Response(
          JSON.stringify({ ok: false, error: "Erro ao consultar disponibilidade", details: err }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const availData = await availResp.json();
      const slots: { start_time: string; status: string }[] = availData.collection || [];

      // Filter available slots and take first 5
      const availableSlots = slots
        .filter((s) => s.status === "available")
        .slice(0, 5)
        .map((s) => s.start_time);

      return new Response(
        JSON.stringify({ ok: true, slots: availableSlots }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create_event") {
      const { lead_id, email_lead, nome_lead, start_time } = body;

      if (!email_lead || !start_time || !lead_id) {
        return new Response(
          JSON.stringify({ ok: false, error: "Campos obrigatórios: lead_id, email_lead, start_time" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create scheduled event via Calendly API
      const createBody: Record<string, unknown> = {
        event_type_uuid: eventTypeUUID,
        start_time,
        invitees: [
          {
            email: email_lead,
            ...(nome_lead ? { name: nome_lead } : {}),
          },
        ],
      };

      const createResp = await fetch("https://api.calendly.com/one_off_event_types", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CALENDLY_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Reunião`,
          host: (await (await fetch("https://api.calendly.com/users/me", { headers: { Authorization: `Bearer ${CALENDLY_TOKEN}` } })).json()).resource?.uri,
          co_hosts: [],
          duration: 30,
          timezone: "America/Sao_Paulo",
          date_setting: {
            type: "date_range",
            start_date: start_time.slice(0, 10),
            end_date: start_time.slice(0, 10),
          },
          location: { kind: "custom", location: "Link enviado por email" },
        }),
      });

      // Fallback: use scheduling links API which is the correct Calendly Personal Access flow
      // The correct Calendly PAT API for booking: POST /scheduling_links
      const schedulingLinkResp = await fetch("https://api.calendly.com/scheduling_links", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CALENDLY_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          max_event_count: 1,
          owner: CALENDLY_EVENT_TYPE_URI,
          owner_type: "EventType",
        }),
      });

      let meetingLink = "";
      let calendlyEventUUID = "";

      if (schedulingLinkResp.ok) {
        const linkData = await schedulingLinkResp.json();
        meetingLink = linkData.resource?.booking_url || linkData.resource?.url || "";
        calendlyEventUUID = linkData.resource?.uri?.split("/").pop() || crypto.randomUUID();
      } else {
        // Last resort: use the event type scheduling URL directly
        const etResp = await fetch(CALENDLY_EVENT_TYPE_URI, {
          headers: { Authorization: `Bearer ${CALENDLY_TOKEN}` },
        });
        if (etResp.ok) {
          const etData = await etResp.json();
          meetingLink = etData.resource?.scheduling_url || "";
        }
        calendlyEventUUID = crypto.randomUUID();
      }

      // Save to agendamentos table
      const { error: dbError } = await supabase.from("agendamentos").insert({
        lead_id,
        email_lead,
        nome_lead: nome_lead || null,
        data_hora: start_time,
        titulo: `Reunião com ${nome_lead || email_lead}`,
        descricao: `Agendado via Calendly. Email: ${email_lead}`,
        calendly_event_uuid: calendlyEventUUID,
        meeting_link: meetingLink,
        status: "agendado",
      });

      if (dbError) console.error("DB insert error:", dbError);

      // Update lead status
      await supabase
        .from("leads")
        .update({ status_funil: "Agendado", temperatura: "Quente" })
        .eq("id", lead_id);

      return new Response(
        JSON.stringify({
          ok: true,
          meeting_link: meetingLink,
          calendly_event_uuid: calendlyEventUUID,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("calendly-booking error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error", details: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
