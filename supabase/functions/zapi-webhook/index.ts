import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCHEDULING_KEYWORDS = [
  "agendar", "reunião", "reuniao", "horário", "horario",
  "marcar", "agenda", "encontro", "call", "meeting",
  "disponível", "disponivel", "combinar", "bater papo",
];

function detectSchedulingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return SCHEDULING_KEYWORDS.some((kw) => lower.includes(kw));
}

function detectEmailInText(text: string): string | null {
  const match = text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  return match ? match[0] : null;
}

// Simple state machine per lead stored in memory (resets on cold start)
// In production you'd use DB, but for edge function this is sufficient per invocation
interface ConversationState {
  stage: "idle" | "waiting_email" | "waiting_confirm";
  suggestedSlot?: string;
}

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

    const cleanPhone = phone.replace(/\D/g, "").replace(/^55/, "");

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

    const { data: lastMsg } = await supabase
      .from("campaign_messages")
      .select("*, campaigns(*)")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fromMe) {
      if (lastMsg) {
        await supabase.from("campaign_messages").update({
          pausado_por_humano: true,
          status: "pausado",
        }).eq("id", lastMsg.id);
        console.log("Automation paused for lead:", lead.id);
      }
      return new Response(JSON.stringify({ ok: true, action: "paused_for_human" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Update lead replied
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

    if (lastMsg?.pausado_por_humano) {
      console.log("Lead is paused for human - skipping AI response");
      return new Response(JSON.stringify({ ok: true, action: "paused_no_auto_reply" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

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

    // ── SCHEDULING DETECTION ──
    const hasSchedulingIntent = detectSchedulingIntent(messageText);
    const emailInMessage = detectEmailInText(messageText);

    // Check last AI message to detect conversation stage
    const lastAiMsg = conversationHistory.filter((m: any) => m.role === "assistant").pop();
    const wasAskingEmail = lastAiMsg?.content?.includes("Qual seu email") || lastAiMsg?.content?.includes("qual seu e-mail");

    let aiReply: string | null = null;

    if (hasSchedulingIntent && !emailInMessage) {
      // Lead wants to schedule but hasn't given email yet
      aiReply = `Ótimo! Vou agendar uma reunião para você. 📅\n\nQual seu e-mail para que eu envie a confirmação do agendamento?`;
    } else if (wasAskingEmail && emailInMessage) {
      // We asked for email and got it - create the event
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const calResp = await fetch(`${supabaseUrl}/functions/v1/google-calendar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            action: "create_event",
            lead_id: lead.id,
            email_lead: emailInMessage,
            data_hora: (() => {
              // Suggest next business day at 10am BRT
              const now = new Date();
              let d = new Date(now);
              d.setDate(d.getDate() + 1);
              while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
              d.setHours(13, 0, 0, 0); // 10:00 BRT = 13:00 UTC
              return d.toISOString();
            })(),
            titulo: `Reunião com ${lead.nome_empresa} - ${lead.nicho}`,
            descricao: `Reunião agendada via WhatsApp.\nEmpresa: ${lead.nome_empresa}\nNicho: ${lead.nicho}\nTelefone: ${phone}`,
            user_id: lead.user_id,
          }),
        });

        const calData = await calResp.json();

        if (calData.ok) {
          const eventDate = new Date(calData.suggested_slot || (() => {
            const d = new Date(); d.setDate(d.getDate() + 1);
            while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
            d.setHours(13, 0, 0, 0); return d;
          })());
          
          // Format date in BRT
          const dateStr = eventDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
          const timeStr = eventDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

          aiReply = `✅ Reunião agendada com sucesso!\n\n📅 ${dateStr} às ${timeStr}\n📧 Confirmação enviada para ${emailInMessage}\n${calData.meet_link ? `🔗 Link da reunião: ${calData.meet_link}` : ""}\n\nNos vemos lá! 🚀`;

          // Update lead status
          await supabase.from("leads").update({
            status_funil: "Agendado",
            temperatura: "Quente",
          }).eq("id", lead.id);
        } else {
          aiReply = `Tive um probleminha ao agendar. 😅\nPodemos agendar por aqui mesmo? Me diga uma data e horário de sua preferência (segunda a sexta, das 9h às 18h).`;
        }
      } catch (calErr) {
        console.error("Calendar error:", calErr);
        aiReply = `Podemos agendar por aqui mesmo? Me diga uma data e horário de sua preferência (segunda a sexta, das 9h às 18h). 📅`;
      }
    } else if (emailInMessage && !wasAskingEmail && hasSchedulingIntent) {
      // Got email + scheduling intent together
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const calResp = await fetch(`${supabaseUrl}/functions/v1/google-calendar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            action: "create_event",
            lead_id: lead.id,
            email_lead: emailInMessage,
            data_hora: (() => {
              const now = new Date();
              let d = new Date(now);
              d.setDate(d.getDate() + 1);
              while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
              d.setHours(13, 0, 0, 0);
              return d.toISOString();
            })(),
            titulo: `Reunião com ${lead.nome_empresa} - ${lead.nicho}`,
            descricao: `Reunião agendada via WhatsApp.\nEmpresa: ${lead.nome_empresa}\nNicho: ${lead.nicho}`,
            user_id: lead.user_id,
          }),
        });

        const calData = await calResp.json();
        if (calData.ok) {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
          d.setHours(10, 0, 0, 0);
          const dateStr = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

          aiReply = `✅ Reunião agendada!\n\n📅 ${dateStr} às 10:00\n📧 Confirmação enviada para ${emailInMessage}\n${calData.meet_link ? `🔗 ${calData.meet_link}` : ""}\n\nAté lá! 🚀`;

          await supabase.from("leads").update({ status_funil: "Agendado", temperatura: "Quente" }).eq("id", lead.id);
        } else {
          aiReply = `Podemos agendar por aqui mesmo? Me diga sua preferência de data e horário (seg-sex, 9h-18h). 📅`;
        }
      } catch (e) {
        console.error("Calendar error:", e);
        aiReply = `Podemos agendar por aqui mesmo? 📅 Me diga data e horário de preferência.`;
      }
    }

    // If no scheduling flow triggered, use normal AI
    if (!aiReply) {
      const systemPrompt = agente?.system_prompt ||
        `Você é ${agente?.nome_agente || "Hunter"}, um especialista em vendas. Seja prestativo e focado em converter o lead. Se o lead demonstrar interesse em agendar uma reunião, pergunte o email dele para enviar confirmação.`;

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
        aiReply = aiData.choices?.[0]?.message?.content;
      } catch (e) {
        console.error("AI error:", e);
        return new Response(JSON.stringify({ ok: true, error: "AI error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    if (!aiReply) {
      return new Response(JSON.stringify({ ok: true, error: "Empty reply" }), {
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
      await supabase.from("campaign_messages").insert({
        campaign_id: lastMsg?.campaign_id,
        lead_id: lead.id,
        mensagem: aiReply,
        status: "enviado",
        enviado_em: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ ok: true, action: "replied", scheduling: hasSchedulingIntent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("webhook error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
