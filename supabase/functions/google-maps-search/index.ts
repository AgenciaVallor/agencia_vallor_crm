const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const textQuery = `${nicho} em ${cidade}, ${estado}, Brasil`;

    console.log(`Buscando: "${textQuery}" | pageToken: ${pageToken ?? 'N/A'}`);

    const body: Record<string, unknown> = {
      textQuery,
      maxResultCount: Math.min(maxResults, 20), // Google limita 20 por página
      languageCode: 'pt-BR',
      regionCode: 'BR',
    };

    if (pageToken) {
      body.pageToken = pageToken;
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
        JSON.stringify({ success: false, error: `Google API retornou erro ${placesRes.status}: ${errText}` }),
        { status: placesRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await placesRes.json();
    const places = data.places ?? [];
    const nextPageToken = data.nextPageToken ?? null;

    // Transforma resultado no formato de lead do CRM
    const leads = places.map((place: Record<string, unknown>) => {
      const displayName = place.displayName as Record<string, string> | undefined;
      const nome_empresa = displayName?.text ?? 'Empresa sem nome';

      const address = (place.formattedAddress as string) ?? '';
      const addressParts = address.split(',').map((p: string) => p.trim());
      const cidadeDetected = addressParts.length >= 2 ? addressParts[addressParts.length - 3] || cidade : cidade;

      // Extrai telefone
      const telefone = (place.nationalPhoneNumber as string | null) ?? null;
      const intlPhone = (place.internationalPhoneNumber as string | null) ?? null;

      // Tenta detectar WhatsApp — se tem telefone nacional BR, considera WhatsApp
      const whatsapp = telefone
        ? telefone.replace(/\D/g, '').replace(/^0/, '')
        : null;

      const site = (place.websiteUri as string | null) ?? null;
      const rating = (place.rating as number | null) ?? null;

      // Temperatura baseada em rating e avaliações
      const ratingCount = (place.userRatingCount as number) ?? 0;
      let temperatura = 'Frio';
      if (rating && rating >= 4.5 && ratingCount > 50) temperatura = 'Fervendo';
      else if (rating && rating >= 4.0 && ratingCount > 20) temperatura = 'Quente';
      else if (rating && rating >= 3.5) temperatura = 'Morno';

      return {
        nome_empresa,
        nicho,
        cidade: cidadeDetected || cidade,
        estado,
        telefone,
        whatsapp,
        email: null, // Places API não fornece email
        site,
        fonte: 'Google Maps',
        status_funil: 'Novo',
        temperatura,
      };
    });

    console.log(`Retornando ${leads.length} leads | nextPageToken: ${nextPageToken ?? 'nenhum'}`);

    return new Response(
      JSON.stringify({ success: true, leads, nextPageToken, total: leads.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Erro inesperado:', err);
    const msg = err instanceof Error ? err.message : 'Erro interno.';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
