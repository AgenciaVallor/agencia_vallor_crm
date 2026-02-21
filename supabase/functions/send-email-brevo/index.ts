import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanBase64(base64String: string): string {
  if (!base64String) return "";
  let cleaned = base64String.trim();
  if (cleaned.includes(",") && cleaned.startsWith("data:")) {
    cleaned = cleaned.split(",")[1];
  }
  cleaned = cleaned.replace(/\s/g, "");
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userSupabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) {
      return new Response(JSON.stringify({ error: "BREVO_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, campaign_id } = await req.json();

    // Verify campaign belongs to user
    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .eq("user_id", userId)
      .eq("tipo", "email")
      .single();

    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campanha de email não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "pause") {
      await supabase.from("campaigns").update({ status: "pausada" }).eq("id", campaign_id).eq("user_id", userId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "start") {
      // Check daily limit
      const today = new Date().toISOString().split("T")[0];
      const { data: stats } = await supabase
        .from("email_campaign_stats")
        .select("*")
        .eq("user_id", userId)
        .eq("data", today)
        .single();

      const totalHoje = stats?.total_enviados || 0;

      // Get leads not yet emailed
      const { data: sentLeadIds } = await supabase
        .from("email_logs")
        .select("lead_id")
        .eq("campaign_id", campaign_id);

      const excludeIds = (sentLeadIds || []).map((r: any) => r.lead_id);

      let query = supabase.from("leads").select("*").eq("user_id", userId).not("email", "is", null);
      if (campaign.nicho_filtro) query = query.ilike("nicho", `%${campaign.nicho_filtro}%`);
      if (campaign.cidade_filtro) query = query.ilike("cidade", `%${campaign.cidade_filtro}%`);
      if (campaign.estado_filtro) query = query.eq("estado", campaign.estado_filtro);
      if (excludeIds.length > 0) query = query.not("id", "in", `(${excludeIds.join(",")})`);
      query = query.limit(campaign.quantidade_por_dia);

      const { data: leads } = await query;

      if (!leads || leads.length === 0) {
        await supabase.from("campaigns").update({ status: "concluida" }).eq("id", campaign_id);
        return new Response(JSON.stringify({ ok: true, message: "Sem leads com email disponíveis" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("campaigns").update({ status: "ativa" }).eq("id", campaign_id);

      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      const { data: agente } = await supabase.from("agente_config").select("*").eq("user_id", userId).limit(1).single();

      let sentCount = 0;

      for (const lead of leads) {
        if (totalHoje + sentCount >= 300) {
          console.log("Limite diário de 300 emails atingido");
          break;
        }

        const { data: currentCamp } = await supabase.from("campaigns").select("status").eq("id", campaign_id).single();
        if (currentCamp?.status !== "ativa") break;

        if (!lead.email) continue;

        // Build email content
        let htmlContent = campaign.texto_email || `<p>Olá! Gostaríamos de apresentar nossos serviços para ${lead.nome_empresa}.</p>`;
        let assunto = campaign.assunto_email || `Proposta para ${lead.nome_empresa}`;

        // Generate with AI if configured
        if (campaign.usar_ia_email && OPENAI_API_KEY) {
          try {
            const systemPrompt = agente?.system_prompt || `Você é ${agente?.nome_agente || "Hunter"}, especialista em vendas.`;
            const userPrompt = `Gere um email profissional curto de abordagem para a empresa "${lead.nome_empresa}" em ${lead.cidade}/${lead.estado}, nicho: ${lead.nicho}. Produto: ${agente?.descricao_produto || "nosso serviço"}. Use HTML simples. Máximo 5 parágrafos. Apenas o corpo do email.`;

            const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
                max_tokens: 500,
              }),
            });
            if (aiResp.ok) {
              const aiData = await aiResp.json();
              htmlContent = aiData.choices?.[0]?.message?.content || htmlContent;
            }
          } catch (e) { console.error("AI email error:", e); }
        }

        // Build attachments
        const attachments: { content: string; name: string }[] = [];
        if (campaign.anexos_urls && Array.isArray(campaign.anexos_urls)) {
          for (const url of campaign.anexos_urls) {
            try {
              const fileResp = await fetch(url);
              if (fileResp.ok) {
                const buffer = await fileResp.arrayBuffer();
                const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
                const fileName = url.split("/").pop() || "attachment";
                attachments.push({ content: cleanBase64(base64), name: fileName });
              }
            } catch (e) { console.error("Attachment error:", e); }
          }
        }

        // Send via Brevo
        try {
          const brevoBody: any = {
            sender: { name: campaign.remetente_nome || "Vallor Agência", email: campaign.remetente_email || "contato@vallor.com.br" },
            to: [{ email: lead.email }],
            subject: assunto,
            htmlContent,
          };
          if (attachments.length > 0) brevoBody.attachment = attachments;

          const brevoResp = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
            body: JSON.stringify(brevoBody),
          });

          const logStatus = brevoResp.ok ? "enviado" : "erro";

          await supabase.from("email_logs").insert({
            user_id: userId,
            lead_id: lead.id,
            campaign_id,
            status: logStatus,
            assunto,
            enviado_em: brevoResp.ok ? new Date().toISOString() : null,
          });

          if (brevoResp.ok) {
            sentCount++;
            await supabase.from("campaigns").update({ total_enviados: campaign.total_enviados + sentCount }).eq("id", campaign_id);
          } else {
            const errBody = await brevoResp.json();
            console.error("Brevo error:", errBody);
          }
        } catch (e) { console.error("Brevo send error:", e); }

        // Delay between sends
        const delay = campaign.delay_segundos * 1000;
        const jitter = (Math.random() * 4000) - 2000;
        await new Promise(r => setTimeout(r, delay + jitter));
      }

      // Update daily stats
      if (sentCount > 0) {
        const { data: existingStats } = await supabase
          .from("email_campaign_stats")
          .select("*")
          .eq("user_id", userId)
          .eq("data", today)
          .single();

        if (existingStats) {
          await supabase.from("email_campaign_stats")
            .update({ total_enviados: existingStats.total_enviados + sentCount })
            .eq("id", existingStats.id);
        } else {
          await supabase.from("email_campaign_stats").insert({
            user_id: userId,
            data: today,
            total_enviados: sentCount,
          });
        }
      }

      if (sentCount < leads.length) {
        await supabase.from("campaigns").update({ status: "pausada" }).eq("id", campaign_id);
      } else {
        await supabase.from("campaigns").update({ status: "concluida" }).eq("id", campaign_id);
      }

      return new Response(JSON.stringify({ ok: true, processed: sentCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-email-brevo error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
