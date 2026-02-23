import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

function detectTimeChoice(text: string, slots: string[]): string | null {
  const lower = text.toLowerCase().trim();
  // Check if user sent a number like "1", "2", "3"
  const numMatch = lower.match(/^[1-5]$/);
  if (numMatch) {
    const idx = parseInt(numMatch[0]) - 1;
    return slots[idx] || null;
  }
  // Check if any slot name is mentioned
  for (const slot of slots) {
    const d = new Date(slot);
    const weekday = d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" }).toLowerCase();
    const hour = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    if (lower.includes(weekday) || lower.includes(hour)) return slot;
  }
  return null;
}

function formatSlotList(slots: string[]): string {
  return slots.map((slot, i) => {
    const d = new Date(slot);
    const weekday = d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" });
    const day = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    const hour = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return `${i + 1}. ${cap} (${day}) às ${hour}`;
  }).join("\n");
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
    console.log("Z-API Webhook received:", JSON.stringify(payload).slice(0, 500));

    const fromMe = payload.fromMe ?? payload.isFromMe ?? false;
    const phone = payload.phone || payload.from || "";
    const messageText = payload.text?.message || payload.message || "";

    if (!phone || !messageText) {
      return new Response(JSON.stringify({ ok: true, skipped: "no phone/message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get last campaign message
    const { data: lastMsg } = await supabase
      .from("campaign_messages")
      .select("*, campaigns(*)")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fromMe) {
      if (lastMsg) {
        await supabase
          .from("campaign_messages")
          .update({ pausado_por_humano: true, status: "pausado" })
          .eq("id", lastMsg.id);
      }
      return new Response(JSON.stringify({ ok: true, action: "paused_for_human" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update lead replied
    if (lastMsg) {
      await supabase
        .from("campaign_messages")
        .update({
          resposta: messageText,
          respondido_em: new Date().toISOString(),
          status: "respondido",
        })
        .eq("id", lastMsg.id);
      await supabase
        .from("leads")
        .update({ status_funil: "Respondeu", temperatura: "Quente" })
        .eq("id", lead.id);
    }

    if (lastMsg?.pausado_por_humano) {
      return new Response(JSON.stringify({ ok: true, action: "paused_no_auto_reply" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPENAI_API_KEY || !ZAPI_INSTANCE || !ZAPI_TOKEN) {
      return new Response(JSON.stringify({ ok: true, action: "saved_reply_no_ai" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get agente config
    const { data: agente } = await supabase
      .from("agente_config")
      .select("*")
      .limit(1)
      .single();

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

    // Read scheduling_state from lead row
    const schedulingState: {
      stage: "idle" | "waiting_email" | "waiting_name" | "waiting_slot_choice";
      email?: string;
      nome?: string;
      slots?: string[];
    } = (lead.scheduling_state as any) || { stage: "idle" };

    const hasSchedulingIntent = detectSchedulingIntent(messageText);
    const emailInMessage = detectEmailInText(messageText);

    let aiReply: string | null = null;
    let newState = { ...schedulingState };

    // ── STAGE MACHINE ──
    if (schedulingState.stage === "idle" && hasSchedulingIntent) {
      // Step 1: Ask for email
      aiReply = `Ótimo! Vou verificar os horários disponíveis na agenda. 📅\n\nQual seu e-mail para eu enviar a confirmação do agendamento?`;
      newState = { stage: "waiting_email" };

    } else if (schedulingState.stage === "waiting_email") {
      if (emailInMessage) {
        newState = { ...newState, stage: "waiting_name" as const, email: emailInMessage };
        aiReply = `Obrigado! ✅\n\nE seu nome completo, por favor? (pode pular respondendo "pular")`;
      } else {
        aiReply = `Preciso do seu e-mail para enviar a confirmação. Pode me enviar?`;
      }

    } else if (schedulingState.stage === "waiting_name") {
      const nomeLead = messageText.toLowerCase() === "pular" ? "" : messageText.trim();
      newState = { ...newState, stage: "waiting_slot_choice" as const, nome: nomeLead };

      // Fetch available slots from Calendly
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const slotsResp = await fetch(`${supabaseUrl}/functions/v1/calendly-booking`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ action: "get_available_slots" }),
        });
        const slotsData = await slotsResp.json();

        if (slotsData.ok && slotsData.slots?.length) {
          newState = { ...newState, slots: slotsData.slots };
          const slotList = formatSlotList(slotsData.slots);
          aiReply = `Perfeito${nomeLead ? `, ${nomeLead}` : ""}! 🙌\n\nEncontrei estes horários livres na minha agenda:\n\n${slotList}\n\nQual você prefere? (responda com o número ou o horário completo)`;
        } else {
          // No slots available
          aiReply = `Poxa, não encontrei horários disponíveis nos próximos dias. Vou verificar com a equipe e entro em contato em breve! 😊`;
          newState = { stage: "idle" };
        }
      } catch (e) {
        console.error("Error fetching slots:", e);
        aiReply = `Tive um problema ao consultar a agenda. Me diga uma preferência de data e horário e arranjo algo! 📅`;
        newState = { stage: "idle" };
      }

    } else if (schedulingState.stage === "waiting_slot_choice" && schedulingState.slots) {
      const chosenSlot = detectTimeChoice(messageText, schedulingState.slots);

      if (chosenSlot) {
        // Book the event
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const bookResp = await fetch(`${supabaseUrl}/functions/v1/calendly-booking`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              action: "create_event",
              lead_id: lead.id,
              email_lead: schedulingState.email,
              nome_lead: schedulingState.nome || "",
              start_time: chosenSlot,
            }),
          });
          const bookData = await bookResp.json();

          if (bookData.ok) {
            const d = new Date(chosenSlot);
            const dateStr = d.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              timeZone: "America/Sao_Paulo",
            });
            const timeStr = d.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Sao_Paulo",
            });

            aiReply = `✅ Agendamento confirmado!\n\n📅 Data/Hora: ${dateStr} às ${timeStr}\n📧 Confirmação enviada para ${schedulingState.email}\n${bookData.meeting_link ? `🔗 Link da reunião: ${bookData.meeting_link}` : ""}\n\nQualquer mudança, me avise! 😊`;
            newState = { stage: "idle" };
          } else {
            aiReply = `Tive um problema ao finalizar o agendamento. 😅 Pode entrar em contato diretamente pelo e-mail para confirmar o horário?`;
            newState = { stage: "idle" };
          }
        } catch (e) {
          console.error("Booking error:", e);
          aiReply = `Ocorreu um erro ao agendar. Por favor, tente novamente ou entre em contato pelo e-mail. 🙏`;
          newState = { stage: "idle" };
        }
      } else {
        // Could not parse choice
        const slotList = formatSlotList(schedulingState.slots);
        aiReply = `Não consegui identificar o horário escolhido. 😅\n\nPor favor, responda só com o número:\n\n${slotList}`;
      }
    }

    // Persist scheduling_state back to lead
    await supabase
      .from("leads")
      .update({ scheduling_state: newState })
      .eq("id", lead.id);

    // If no scheduling flow triggered, use normal AI
    if (!aiReply) {
      const systemPrompt =
        agente?.system_prompt ||
        `Você é ${agente?.nome_agente || "Hunter"}, um especialista em vendas. Seja prestativo e focado em converter o lead em cliente. Se o lead demonstrar interesse em agendar uma reunião, diga que pode verificar os horários disponíveis.`;

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
              { role: "user", content: messageText },
            ],
            max_tokens: 300,
          }),
        });

        if (!aiResp.ok) {
          console.error("AI error:", await aiResp.text());
          return new Response(JSON.stringify({ ok: true, error: "AI failed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const aiData = await aiResp.json();
        aiReply = aiData.choices?.[0]?.message?.content;
      } catch (e) {
        console.error("AI error:", e);
        return new Response(JSON.stringify({ ok: true, error: "AI error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!aiReply) {
      return new Response(JSON.stringify({ ok: true, error: "Empty reply" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    return new Response(
      JSON.stringify({
        ok: true,
        action: "replied",
        scheduling_stage: newState.stage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("webhook error:", msg);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
