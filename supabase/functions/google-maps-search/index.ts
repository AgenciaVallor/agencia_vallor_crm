import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Coordenadas aproximadas das capitais brasileiras
const COORDS: Record<string, { lat: number; lng: number }> = {
  AC: { lat: -9.9754, lng: -67.8249 },
  AL: { lat: -9.6658, lng: -35.7353 },
  AP: { lat: 0.0349, lng: -51.0694 },
  AM: { lat: -3.119, lng: -60.0217 },
  BA: { lat: -12.9714, lng: -38.5124 },
  CE: { lat: -3.7172, lng: -38.5433 },
  DF: { lat: -15.7975, lng: -47.8919 },
  ES: { lat: -20.3155, lng: -40.3128 },
  GO: { lat: -16.6869, lng: -49.2648 },
  MA: { lat: -2.5297, lng: -44.2825 },
  MT: { lat: -15.601, lng: -56.0974 },
  MS: { lat: -20.4697, lng: -54.6201 },
  MG: { lat: -19.9191, lng: -43.9386 },
  PA: { lat: -1.4558, lng: -48.5024 },
  PB: { lat: -7.1195, lng: -34.845 },
  PR: { lat: -25.4284, lng: -49.2733 },
  PE: { lat: -8.0476, lng: -34.877 },
  PI: { lat: -5.0892, lng: -42.8019 },
  RJ: { lat: -22.9068, lng: -43.1729 },
  RN: { lat: -5.7945, lng: -35.211 },
  RS: { lat: -30.0346, lng: -51.2177 },
  RO: { lat: -8.7612, lng: -63.9004 },
  RR: { lat: 2.8195, lng: -60.6714 },
  SC: { lat: -27.5954, lng: -48.548 },
  SP: { lat: -23.5505, lng: -46.6333 },
  SE: { lat: -10.9091, lng: -37.0677 },
  TO: { lat: -10.1689, lng: -48.3317 },
};

function cleanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 13) return digits;
  return null;
}

function inferWhatsapp(phone: string | null): string | null {
  if (!phone) return null;
  // Brazilian mobile: starts with 55 + 2-digit DDD + 9 + 8 digits = 13 digits
  // Or without country code: 2-digit DDD + 9 + 8 digits = 11 digits  
  if (phone.startsWith('55') && phone.length === 13 && phone[4] === '9') return phone;
  if (phone.length === 11 && phone[2] === '9') return '55' + phone;
  return null;
}

function classifyTemperature(whatsapp: string | null, email: string | null, site: string | null): string {
  const hasWa = !!whatsapp;
  const hasEmail = !!email;
  const hasSite = !!site;
  if (hasWa && hasEmail && hasSite) return 'Fervendo';
  if (hasWa && (hasEmail || hasSite)) return 'Quente';
  if (hasWa) return 'Morno';
  if (hasSite || hasEmail) return 'Frio';
  return 'Desinteressado';
}

interface Lead {
  nome_empresa: string;
  nicho: string;
  cidade: string;
  estado: string;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
  fonte: string;
  status_funil: string;
  temperatura: string;
}

async function searchHERE(nicho: string, cidade: string, estado: string, quantidade: number, apiKey: string): Promise<{ leads: Lead[]; error?: string }> {
  const coords = COORDS[estado] ?? { lat: -15.7975, lng: -47.8919 };
  const q = `${nicho} ${cidade} ${estado}`;
  const url = `https://browse.search.hereapi.com/v1/browse?q=${encodeURIComponent(q)}&at=${coords.lat},${coords.lng}&limit=${Math.min(quantidade, 100)}&apiKey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text();
    console.error('HERE API error:', res.status, errText);
    return { leads: [], error: `HERE retornou ${res.status}` };
  }

  const data = await res.json();
  const items = data.items ?? [];

  const leads: Lead[] = items.map((item: any) => {
    const nome = item.title ?? 'Empresa sem nome';
    const phone = cleanPhone(item.contacts?.[0]?.phone?.[0]?.value);
    const website = item.contacts?.[0]?.www?.[0]?.value ?? null;
    const whatsapp = inferWhatsapp(phone);

    return {
      nome_empresa: nome,
      nicho,
      cidade,
      estado,
      telefone: phone,
      whatsapp,
      email: null,
      site: website,
      fonte: 'HERE',
      status_funil: 'Novo',
      temperatura: classifyTemperature(whatsapp, null, website),
    };
  });

  return { leads };
}

async function searchOverpass(nicho: string, cidade: string, estado: string, quantidade: number): Promise<{ leads: Lead[]; error?: string }> {
  // Map common niches to OSM tags
  const nichoLower = nicho.toLowerCase();
  let osmFilter = `"name"~"${nicho}",i`;
  
  const tagMap: Record<string, string> = {
    dentist: '"amenity"="dentist"', dentista: '"amenity"="dentist"',
    restaurant: '"amenity"="restaurant"', restaurante: '"amenity"="restaurant"',
    'pet shop': '"shop"="pet"', petshop: '"shop"="pet"',
    farmácia: '"amenity"="pharmacy"', farmacia: '"amenity"="pharmacy"',
    padaria: '"shop"="bakery"', bakery: '"shop"="bakery"',
    academia: '"leisure"="fitness_centre"',
    salão: '"shop"="hairdresser"', barbearia: '"shop"="hairdresser"',
    oficina: '"shop"="car_repair"', mecânico: '"shop"="car_repair"',
    advogado: '"office"="lawyer"', advocacia: '"office"="lawyer"',
    médico: '"amenity"="doctors"', clinica: '"amenity"="clinic"', clínica: '"amenity"="clinic"',
    hotel: '"tourism"="hotel"', pousada: '"tourism"="guest_house"',
    supermercado: '"shop"="supermarket"', mercado: '"shop"="supermarket"',
    escola: '"amenity"="school"',
    imobiliária: '"office"="estate_agent"', imobiliaria: '"office"="estate_agent"',
    contabilidade: '"office"="accountant"', contador: '"office"="accountant"',
  };

  for (const [key, val] of Object.entries(tagMap)) {
    if (nichoLower.includes(key)) {
      osmFilter = val;
      break;
    }
  }

  const query = `[out:json][timeout:25];area["name"="${cidade}"]["admin_level"~"8|7"]->.searchArea;(node[${osmFilter}](area.searchArea);way[${osmFilter}](area.searchArea););out body ${quantidade};`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Overpass error:', res.status, errText);
    return { leads: [], error: `Overpass retornou ${res.status}` };
  }

  const data = await res.json();
  const elements = data.elements ?? [];

  const leads: Lead[] = elements
    .filter((el: any) => el.tags?.name)
    .map((el: any) => {
      const tags = el.tags ?? {};
      const phone = cleanPhone(tags.phone ?? tags['contact:phone']);
      const website = tags.website ?? tags['contact:website'] ?? null;
      const whatsapp = inferWhatsapp(phone);

      return {
        nome_empresa: tags.name,
        nicho,
        cidade,
        estado,
        telefone: phone,
        whatsapp,
        email: tags.email ?? tags['contact:email'] ?? null,
        site: website,
        fonte: 'OpenStreetMap',
        status_funil: 'Novo',
        temperatura: classifyTemperature(whatsapp, tags.email ?? null, website),
      };
    });

  return { leads };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ success: false, error: 'Token inválido.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { nicho, cidade, estado, maxResults = 20 } = await req.json();

    if (!nicho || !cidade || !estado) {
      return new Response(JSON.stringify({ success: false, error: 'Parâmetros obrigatórios: nicho, cidade, estado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const safeNicho = String(nicho).slice(0, 100).trim();
    const safeCidade = String(cidade).slice(0, 100).trim();
    const safeEstado = String(estado).slice(0, 5).trim();
    const qty = Math.min(Math.max(Number(maxResults) || 20, 1), 100);

    console.log(`User ${claimsData.claims.sub} buscando "${safeNicho}" em ${safeCidade}-${safeEstado}, qty=${qty}`);

    // 1) Try HERE
    const hereKey = Deno.env.get('HERE_API_KEY');
    let fonte = 'HERE';
    let leads: Lead[] = [];
    let fallbackReason = '';

    if (hereKey) {
      const hereResult = await searchHERE(safeNicho, safeCidade, safeEstado, qty, hereKey);
      if (hereResult.leads.length > 0) {
        leads = hereResult.leads;
        console.log(`HERE retornou ${leads.length} leads`);
      } else {
        fallbackReason = hereResult.error ?? 'Sem resultados';
        console.log(`HERE falhou: ${fallbackReason}`);
      }
    } else {
      fallbackReason = 'HERE_API_KEY não configurada';
      console.log(fallbackReason);
    }

    // 2) Fallback: Overpass/OSM
    if (leads.length === 0) {
      console.log('Tentando fallback OpenStreetMap/Overpass...');
      fonte = 'OpenStreetMap';
      const osmResult = await searchOverpass(safeNicho, safeCidade, safeEstado, qty);
      leads = osmResult.leads;
      if (osmResult.error) {
        fallbackReason += ` | OSM: ${osmResult.error}`;
      }
      console.log(`Overpass retornou ${leads.length} leads`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        leads: leads.slice(0, qty),
        total: leads.length,
        fonte,
        fallbackReason: leads.length === 0 ? fallbackReason : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Erro inesperado:', err);
    return new Response(JSON.stringify({ success: false, error: 'Erro interno.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
