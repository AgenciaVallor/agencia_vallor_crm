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
    const { action, campaign_id } = await req.json();

    if (action === "pause") {
      await supabase.from("campaigns").update({ status: "pausada" }).eq("id", campaign_id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "start") {
      if (!ZAPI_INSTANCE || !ZAPI_TOKEN) {
        return new Response(JSON.stringify({ error: "Credenciais Z-API não configuradas" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Get campaign
      const { data: campaign, error: campErr } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaign_id)
        .single();

      if (campErr || !campaign) {
        return new Response(JSON.stringify({ error: "Campanha não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Get agente config
      const { data: agente } = await supabase.from("agente_config").select("*").limit(1).single();

      // Get leads not yet contacted by this campaign
      const { data: sentLeadIds } = await supabase
        .from("campaign_messages")
        .select("lead_id")
        .eq("campaign_id", campaign_id);

      const excludeIds = (sentLeadIds || []).map((r: any) => r.lead_id);

      let query = supabase.from("leads").select("*");
      if (campaign.nicho_filtro) query = query.ilike("nicho", `%${campaign.nicho_filtro}%`);
      if (campaign.cidade_filtro) query = query.ilike("cidade", `%${campaign.cidade_filtro}%`);
      if (campaign.estado_filtro) query = query.eq("estado", campaign.estado_filtro);
      if (excludeIds.length > 0) query = query.not("id", "in", `(${excludeIds.join(",")})`);
      query = query.limit(campaign.quantidade_por_dia);

      const { data: leads } = await query;

      if (!leads || leads.length === 0) {
        await supabase.from("campaigns").update({ status: "concluida" }).eq("id", campaign_id);
        return new Response(JSON.stringify({ ok: true, message: "Sem leads disponíveis" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      await supabase.from("campaigns").update({ status: "ativa" }).eq("id", campaign_id);

      // Start sending loop (background-ish using EdgeRuntime)
      const delayMs = campaign.delay_segundos * 1000;

      // Process leads sequentially
      for (const lead of leads) {
        // Check if still active
        const { data: currentCamp } = await supabase.from("campaigns").select("status").eq("id", campaign_id).single();
        if (currentCamp?.status !== "ativa") break;

        const phone = lead.whatsapp || lead.telefone;
        if (!phone) continue;

        // Generate message via OpenAI GPT-4
        let mensagem = `Olá! Somos especialistas em ${agente?.nicho || "nosso segmento"} e gostaríamos de conversar com ${lead.nome_empresa}.`;

        if (OPENAI_API_KEY) {
          try {
            const systemPrompt = agente?.system_prompt || `Você é ${agente?.nome_agente || "Hunter"}, especialista em vendas.`;
            const userPrompt = `Gere uma mensagem curta e natural de abordagem para a empresa "${lead.nome_empresa}" localizada em ${lead.cidade}/${lead.estado} sobre: ${agente?.descricao_produto || "nosso produto/serviço"}. Varie o cumprimento. Máximo 3 frases. Apenas o texto da mensagem, sem saudações genéricas.`;

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
                  { role: "user", content: userPrompt }
                ],
                max_tokens: 200,
              }),
            });

            if (aiResp.ok) {
              const aiData = await aiResp.json();
              mensagem = aiData.choices?.[0]?.message?.content || mensagem;
            } else {
              console.error("OpenAI error:", await aiResp.text());
            }
          } catch (e) {
            console.error("AI error:", e);
          }
        }

        // Insert message record
        const { data: msgRecord } = await supabase.from("campaign_messages").insert({
          campaign_id,
          lead_id: lead.id,
          mensagem,
          status: "pendente",
        }).select().single();

        // Send via Z-API
        const cleanPhone = phone.replace(/\D/g, "");
        const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

        try {
          const zapiResp = await fetch(
            `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone: fullPhone, message: mensagem }),
            }
          );

          if (zapiResp.ok) {
            await supabase.from("campaign_messages").update({
              status: "enviado",
              enviado_em: new Date().toISOString(),
            }).eq("id", msgRecord?.id);

            await supabase.from("campaigns")
              .update({ total_enviados: campaign.total_enviados + 1 })
              .eq("id", campaign_id);

            await supabase.from("leads").update({ status_funil: "Contatado" }).eq("id", lead.id);
          } else {
            await supabase.from("campaign_messages").update({ status: "erro" }).eq("id", msgRecord?.id);
          }
        } catch (e) {
          console.error("Z-API error:", e);
        }

        // Wait delay (randomized ±10s)
        const jitter = (Math.random() * 20000) - 10000;
        await new Promise(r => setTimeout(r, delayMs + jitter));
      }

      return new Response(JSON.stringify({ ok: true, processed: leads.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("campaign-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
