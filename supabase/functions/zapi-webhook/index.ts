import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const ZAPI_INSTANCE = Deno.env.get("ZAPI_INSTANCE") || Deno.env.get("ZAPI_INSTANCE_ID");
  const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");

  try {
    const payload = await req.json();
    console.log("Z-API Webhook received:", JSON.stringify(payload));

    const fromMe = payload.fromMe ?? payload.isFromMe ?? false;
    const phone = payload.phone || payload.from || "";
    const messageText = payload.text?.message || payload.message || "";

    if (!phone || !messageText) {
      return new Response(JSON.stringify({ ok: true, skipped: "no phone/message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Normalize phone - remove country code for matching
    const cleanPhone = phone.replace(/\D/g, "").replace(/^55/, "");

    // Find lead by phone
    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .or(`whatsapp.ilike.%${cleanPhone}%,telefone.ilike.%${cleanPhone}%`)
      .limit(1)
      .single();

    if (!lead) {
      console.log("Lead not found for phone:", phone);
      return new Response(JSON.stringify({ ok: true, skipped: "lead not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Find the latest campaign message for this lead
    const { data: lastMsg } = await supabase
      .from("campaign_messages")
      .select("*, campaigns(*)")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fromMe) {
      // Human typed a message in the phone → pause automation for this lead
      if (lastMsg) {
        await supabase.from("campaign_messages").update({
          pausado_por_humano: true,
          status: "pausado",
        }).eq("id", lastMsg.id);

        console.log("Automation paused for lead:", lead.id, "- human intervention detected");
      }

      return new Response(JSON.stringify({ ok: true, action: "paused_for_human" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Lead replied → update record
    if (lastMsg) {
      await supabase.from("campaign_messages").update({
        resposta: messageText,
        respondido_em: new Date().toISOString(),
        status: "respondido",
      }).eq("id", lastMsg.id);

      await supabase.from("leads").update({
        status_funil: "Respondeu",
        temperatura: "Quente",
      }).eq("id", lead.id);
    }

    // Check if this lead is paused for human intervention
    if (lastMsg?.pausado_por_humano) {
      console.log("Lead is paused for human - skipping AI response");
      return new Response(JSON.stringify({ ok: true, action: "paused_no_auto_reply" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Generate AI reply
    if (!OPENAI_API_KEY || !ZAPI_INSTANCE || !ZAPI_TOKEN) {
      console.log("Missing credentials for AI reply");
      return new Response(JSON.stringify({ ok: true, action: "saved_reply_no_ai" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get agente config
    const { data: agente } = await supabase.from("agente_config").select("*").limit(1).single();

    // Get conversation history
    const { data: history } = await supabase
      .from("campaign_messages")
      .select("mensagem, resposta")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: true })
      .limit(10);

    const conversationHistory = (history || []).flatMap((h: any) => [
      h.mensagem ? { role: "assistant", content: h.mensagem } : null,
      h.resposta ? { role: "user", content: h.resposta } : null,
    ]).filter(Boolean);

    const systemPrompt = agente?.system_prompt ||
      `Você é ${agente?.nome_agente || "Hunter"}, um especialista em vendas. Seja prestativo e focado em converter o lead.`;

    try {
      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            ...conversationHistory,
            { role: "user", content: messageText }
          ],
          max_tokens: 300,
        }),
      });

      if (!aiResp.ok) {
        console.error("AI error:", await aiResp.text());
        return new Response(JSON.stringify({ ok: true, error: "AI failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const aiData = await aiResp.json();
      const aiReply = aiData.choices?.[0]?.message?.content;

      if (!aiReply) {
        return new Response(JSON.stringify({ ok: true, error: "Empty AI response" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Send reply via Z-API
      const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
      const zapiResp = await fetch(
        `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: fullPhone.replace(/\D/g, ""), message: aiReply }),
        }
      );

      if (zapiResp.ok) {
        // Record AI reply as a new message
        await supabase.from("campaign_messages").insert({
          campaign_id: lastMsg?.campaign_id,
          lead_id: lead.id,
          mensagem: aiReply,
          status: "enviado",
          enviado_em: new Date().toISOString(),
        });
      }

      return new Response(JSON.stringify({ ok: true, action: "ai_replied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (e) {
      console.error("AI/Z-API error:", e);
      return new Response(JSON.stringify({ ok: true, error: "send failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

  } catch (e) {
    console.error("webhook error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
