import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function cleanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 13) return digits;
  return null;
}

function inferWhatsapp(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.startsWith('55') && phone.length === 13 && phone[4] === '9') return phone;
  if (phone.length === 11 && phone[2] === '9') return '55' + phone;
  return null;
}

function classifyTemp(wa: string | null, email: string | null, site: string | null, instagram: string | null, linkedin: string | null): string {
  const w = !!wa, e = !!email, s = !!site, social = !!instagram || !!linkedin;
  if (w && e && (s || social)) return 'Fervendo';
  if (w && (e || s || social)) return 'Quente';
  if (w || !!cleanPhone(wa)) return 'Morno';
  if (s || e) return 'Frio';
  return 'Desinteressado';
}

interface Lead {
  nome_empresa: string; nicho: string; cidade: string; estado: string;
  telefone: string | null; whatsapp: string | null; email: string | null;
  site: string | null; fonte: string; status_funil: string; temperatura: string;
  endereco: string | null; instagram: string | null; linkedin: string | null;
  observacoes?: string | null;
}

// ─── Google Places Text Search (legacy) with full pagination ───
async function searchGoogleMaps(nicho: string, cidade: string, estado: string, qty: number, apiKey: string, logs: string[]): Promise<Lead[]> {
  const query = `${nicho} em ${cidade}, ${estado}, Brasil`;
  const allLeads: Lead[] = [];
  let pageToken: string | undefined;
  let page = 0;

  while (allLeads.length < qty && page < 3) {
    page++;
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=pt-BR&key=${apiKey}`;
    if (pageToken) url += `&pagetoken=${pageToken}`;

    logs.push(`Página ${page}: buscando resultados...`);

    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      console.error('Google Maps API error:', res.status, errText);
      logs.push(`Google retornou erro ${res.status} na página ${page}.`);
      break;
    }

    const data = await res.json();
    const results = data.results ?? [];
    logs.push(`Página ${page}: encontrados ${results.length} resultados.`);

    for (const place of results) {
      if (allLeads.length >= qty) break;

      let phone: string | null = null;
      let website: string | null = null;
      if (place.place_id) {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,international_phone_number,website&language=pt-BR&key=${apiKey}`;
          const detailsRes = await fetch(detailsUrl);
          if (detailsRes.ok) {
            const detailsData = await detailsRes.json();
            const result = detailsData.result ?? {};
            phone = cleanPhone(result.formatted_phone_number ?? result.international_phone_number);
            website = result.website ?? null;
          } else {
            await detailsRes.text();
          }
        } catch (e) {
          console.error('Details fetch error:', e);
        }
      }

      const whatsapp = inferWhatsapp(phone);

      allLeads.push({
        nome_empresa: place.name ?? 'Sem nome',
        nicho, cidade, estado,
        telefone: phone, whatsapp, email: null,
        site: website, fonte: 'Google Maps',
        status_funil: 'Novo',
        temperatura: classifyTemp(whatsapp, null, website, null, null),
        endereco: place.formatted_address ?? null,
        instagram: null, linkedin: null,
      });
    }

    pageToken = data.next_page_token;
    if (!pageToken) {
      logs.push('Não há mais páginas no Google Maps.');
      break;
    }

    logs.push('Próxima página encontrada, continuando...');
    await new Promise(r => setTimeout(r, 2000));
  }

  logs.push(`Busca Maps concluída: ${allLeads.length} leads capturados.`);
  return allLeads;
}

// ─── OpenStreetMap / Overpass fallback ───
async function searchOverpass(nicho: string, cidade: string, estado: string, qty: number, logs: string[]): Promise<Lead[]> {
  const nichoLower = nicho.toLowerCase();
  let osmFilter = `"name"~"${nicho}",i`;

  const tagMap: Record<string, string> = {
    dentist: '"amenity"="dentist"', dentista: '"amenity"="dentist"',
    restaurant: '"amenity"="restaurant"', restaurante: '"amenity"="restaurant"',
    'pet shop': '"shop"="pet"', petshop: '"shop"="pet"',
    farmácia: '"amenity"="pharmacy"', farmacia: '"amenity"="pharmacy"',
    padaria: '"shop"="bakery"', academia: '"leisure"="fitness_centre"',
    salão: '"shop"="hairdresser"', barbearia: '"shop"="hairdresser"',
    oficina: '"shop"="car_repair"', mecânico: '"shop"="car_repair"',
    advogado: '"office"="lawyer"', advocacia: '"office"="lawyer"',
    médico: '"amenity"="doctors"', clinica: '"amenity"="clinic"', clínica: '"amenity"="clinic"',
    hotel: '"tourism"="hotel"', pousada: '"tourism"="guest_house"',
    supermercado: '"shop"="supermarket"', mercado: '"shop"="supermarket"',
    escola: '"amenity"="school"', imobiliária: '"office"="estate_agent"',
    contabilidade: '"office"="accountant"', contador: '"office"="accountant"',
  };
  for (const [key, val] of Object.entries(tagMap)) {
    if (nichoLower.includes(key)) { osmFilter = val; break; }
  }

  logs.push('Tentando OpenStreetMap/Overpass (fallback)...');
  const query = `[out:json][timeout:25];area["name"="${cidade}"]["admin_level"~"8|7"]->.searchArea;(node[${osmFilter}](area.searchArea);way[${osmFilter}](area.searchArea););out body ${qty};`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    await res.text();
    logs.push(`OpenStreetMap retornou erro ${res.status}.`);
    return [];
  }

  const data = await res.json();
  const leads: Lead[] = (data.elements ?? []).filter((el: any) => el.tags?.name).map((el: any) => {
    const tags = el.tags ?? {};
    const phone = cleanPhone(tags.phone ?? tags['contact:phone']);
    const website = tags.website ?? tags['contact:website'] ?? null;
    const whatsapp = inferWhatsapp(phone);
    const email = tags.email ?? tags['contact:email'] ?? null;
    const instagram = tags['contact:instagram'] ?? null;
    const endereco = [tags['addr:street'], tags['addr:housenumber'], tags['addr:suburb']].filter(Boolean).join(', ') || null;
    return {
      nome_empresa: tags.name, nicho, cidade, estado,
      telefone: phone, whatsapp, email,
      site: website, fonte: 'OpenStreetMap', status_funil: 'Novo',
      temperatura: classifyTemp(whatsapp, email, website, instagram, null),
      endereco, instagram, linkedin: null,
    };
  });

  logs.push(leads.length > 0 ? `OpenStreetMap retornou ${leads.length} resultados.` : 'OpenStreetMap: sem resultados.');
  return leads;
}

// ─── Deduplicate leads by phone/name ───
function deduplicateLeads(leads: Lead[]): { unique: Lead[]; skipped: number } {
  const seen = new Set<string>();
  const unique: Lead[] = [];
  let skipped = 0;

  for (const lead of leads) {
    const phoneKey = lead.whatsapp ?? lead.telefone ?? '';
    const nameKey = lead.nome_empresa.toLowerCase().trim();
    const key = phoneKey ? `phone:${phoneKey}` : `name:${nameKey}`;

    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    if (phoneKey) seen.add(`name:${nameKey}`);
    unique.push(lead);
  }

  return { unique, skipped };
}

// ─── Google Custom Search Enrichment ───
async function enrichLeadsWithSearch(leads: Lead[], apiKey: string, cx: string, logs: string[]): Promise<void> {
  const priority: Record<string, number> = { 'Fervendo': 0, 'Quente': 1, 'Morno': 2, 'Frio': 3, 'Desinteressado': 4 };
  leads.sort((a, b) => (priority[a.temperatura] ?? 5) - (priority[b.temperatura] ?? 5));

  const BATCH = 5;
  let enriched = 0;

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    logs.push(`🔎 Enriquecendo com Google Search (lote ${batchNum}, ${batch.length} leads)...`);

    for (const lead of batch) {
      try {
        const q = `${lead.nome_empresa} ${lead.cidade} ${lead.estado} email OR instagram OR facebook OR linkedin`;
        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}&num=5`;

        const res = await fetch(url);
        if (!res.ok) {
          await res.text();
          if (res.status === 429 || res.status === 403) {
            logs.push(`⚠️ Limite da API Google Search atingido. Parando enriquecimento.`);
            return;
          }
          continue;
        }

        const data = await res.json();
        const items = data.items ?? [];
        const found: string[] = [];
        let facebook: string | null = null;

        for (const item of items) {
          const snippet = `${item.snippet ?? ''} ${item.title ?? ''} ${item.link ?? ''}`;
          const link: string = item.link ?? '';

          // Email
          if (!lead.email) {
            const m = snippet.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
            if (m && !m[0].includes('example') && !m[0].includes('sentry') && !m[0].includes('noreply')) {
              lead.email = m[0];
              found.push(`email`);
            }
          }

          // Instagram
          if (!lead.instagram && link.includes('instagram.com/')) {
            lead.instagram = link;
            found.push('Instagram');
          } else if (!lead.instagram) {
            const igM = snippet.match(/instagram\.com\/([\w.]{3,30})/i);
            if (igM) { lead.instagram = `https://instagram.com/${igM[1]}`; found.push('Instagram'); }
          }

          // Facebook
          if (!facebook && link.includes('facebook.com/') && !link.includes('/sharer') && !link.includes('/login')) {
            facebook = link;
            found.push('Facebook');
          }

          // LinkedIn
          if (!lead.linkedin && link.includes('linkedin.com/')) {
            lead.linkedin = link;
            found.push('LinkedIn');
          }
        }

        // Store facebook in observacoes
        if (facebook) {
          lead.observacoes = `Facebook: ${facebook}`;
        }

        if (found.length > 0) {
          enriched++;
          logs.push(`✅ Encontrado ${found.join(', ')} para "${lead.nome_empresa}"`);
        }

        // Reclassify temperature
        lead.temperatura = classifyTemp(lead.whatsapp, lead.email, lead.site, lead.instagram, lead.linkedin);

        await new Promise(r => setTimeout(r, 250));
      } catch (e) {
        console.error(`Enrichment error for "${lead.nome_empresa}":`, e);
      }
    }
  }

  logs.push(`🏁 Enriquecimento concluído: ${enriched} leads atualizados com dados extras.`);
}

// ─── MAIN HANDLER ───
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Token inválido.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { nicho, cidade, estado, maxResults = 20 } = await req.json();
    if (!nicho || !cidade || !estado) {
      return new Response(JSON.stringify({ success: false, error: 'Parâmetros obrigatórios: nicho, cidade, estado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const sNicho = String(nicho).slice(0, 100).trim();
    const sCidade = String(cidade).slice(0, 100).trim();
    const sEstado = String(estado).slice(0, 5).trim();
    const qty = Math.min(Math.max(Number(maxResults) || 20, 1), 100);

    console.log(`User ${user.id} buscando "${sNicho}" em ${sCidade}-${sEstado}, qty=${qty}`);

    const logs: string[] = [];
    let leads: Lead[] = [];
    let fonte = '';

    // 1) Google Maps
    const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (googleKey) {
      logs.push('🔍 Iniciando busca no Google Maps (todas as páginas)...');
      leads = await searchGoogleMaps(sNicho, sCidade, sEstado, qty, googleKey, logs);
      fonte = 'Google Maps';
    }

    // 2) OSM fallback
    if (leads.length === 0) {
      const osmLeads = await searchOverpass(sNicho, sCidade, sEstado, qty, logs);
      leads = osmLeads;
      fonte = 'OpenStreetMap';
    }

    // 3) Deduplicate
    const { unique, skipped } = deduplicateLeads(leads);
    if (skipped > 0) {
      logs.push(`🔄 ${skipped} leads duplicados ignorados.`);
    }

    // 4) Enrich with Google Custom Search
    const customSearchCx = Deno.env.get('GOOGLE_CUSTOM_SEARCH_CX');
    if (customSearchCx && googleKey && unique.length > 0) {
      logs.push('🔍 Iniciando enriquecimento via Google Search...');
      await enrichLeadsWithSearch(unique, googleKey, customSearchCx, logs);
    } else if (!customSearchCx) {
      logs.push('⚠️ Google Custom Search não configurado. Pulando enriquecimento.');
    }

    const finalLeads = unique.slice(0, qty);

    if (finalLeads.length > 0) {
      logs.push(`✅ Captura concluída! ${finalLeads.length} leads encontrados via ${fonte}.`);
    } else {
      logs.push('Nenhum lead encontrado nas fontes disponíveis.');
    }

    return new Response(
      JSON.stringify({ success: true, leads: finalLeads, total: finalLeads.length, fonte, logs, duplicatesSkipped: skipped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Erro inesperado:', err);
    return new Response(JSON.stringify({ success: false, error: 'Erro interno.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});