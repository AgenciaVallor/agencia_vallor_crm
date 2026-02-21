import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: validação JWT explícita ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido ou expirado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Google Maps API Key ──
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GOOGLE_MAPS_API_KEY não configurada.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { nicho, cidade, estado, pageToken, maxResults = 20 } = await req.json();

    if (!nicho || !cidade || !estado) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parâmetros nicho, cidade e estado são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitiza inputs
    const safeNicho = String(nicho).slice(0, 100).trim();
    const safeCidade = String(cidade).slice(0, 100).trim();
    const safeEstado = String(estado).slice(0, 5).trim();

    const textQuery = `${safeNicho} em ${safeCidade}, ${safeEstado}, Brasil`;

    console.log(`User ${claimsData.claims.sub} buscando: "${textQuery}"`);

    const body: Record<string, unknown> = {
      textQuery,
      maxResultCount: Math.min(Number(maxResults) || 20, 20),
      languageCode: 'pt-BR',
      regionCode: 'BR',
    };

    if (pageToken) {
      body.pageToken = String(pageToken);
    }

    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.nationalPhoneNumber',
          'places.internationalPhoneNumber',
          'places.websiteUri',
          'places.rating',
          'places.userRatingCount',
          'places.types',
          'nextPageToken',
        ].join(','),
      },
      body: JSON.stringify(body),
    });

    if (!placesRes.ok) {
      const errText = await placesRes.text();
      console.error('Google Places API error:', errText);
      return new Response(
        JSON.stringify({ success: false, error: `Google API retornou erro ${placesRes.status}` }),
        { status: placesRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await placesRes.json();
    const places = data.places ?? [];
    const nextPageToken = data.nextPageToken ?? null;

    const leads = places.map((place: Record<string, unknown>) => {
      const displayName = place.displayName as Record<string, string> | undefined;
      const nome_empresa = displayName?.text ?? 'Empresa sem nome';

      const address = (place.formattedAddress as string) ?? '';
      const addressParts = address.split(',').map((p: string) => p.trim());
      const cidadeDetected = addressParts.length >= 2 ? addressParts[addressParts.length - 3] || safeCidade : safeCidade;

      const telefone = (place.nationalPhoneNumber as string | null) ?? null;

      const whatsapp = telefone
        ? telefone.replace(/\D/g, '').replace(/^0/, '')
        : null;

      const site = (place.websiteUri as string | null) ?? null;
      const rating = (place.rating as number | null) ?? null;
      const ratingCount = (place.userRatingCount as number) ?? 0;

      let temperatura = 'Frio';
      if (rating && rating >= 4.5 && ratingCount > 50) temperatura = 'Fervendo';
      else if (rating && rating >= 4.0 && ratingCount > 20) temperatura = 'Quente';
      else if (rating && rating >= 3.5) temperatura = 'Morno';

      return {
        nome_empresa,
        nicho: safeNicho,
        cidade: cidadeDetected || safeCidade,
        estado: safeEstado,
        telefone,
        whatsapp,
        email: null,
        site,
        fonte: 'Google Maps',
        status_funil: 'Novo',
        temperatura,
      };
    });

    console.log(`Retornando ${leads.length} leads`);

    return new Response(
      JSON.stringify({ success: true, leads, nextPageToken, total: leads.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Erro inesperado:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
