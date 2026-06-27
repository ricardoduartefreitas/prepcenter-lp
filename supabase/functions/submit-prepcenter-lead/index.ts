import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = 'https://prepcenter.ruahtecnologia.com.br';
const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET_KEY') ?? '';
const N8N_WEBHOOK_URL = Deno.env.get('N8N_PREPCENTER_WEBHOOK') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, string | boolean>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const {
    nome,
    whatsapp,
    volume,
    marketplace,
    turnstile_token,
    lgpd_consent,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
  } = body as Record<string, string>;

  if (!nome?.trim() || !whatsapp?.trim() || !volume || !marketplace) {
    return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 1. Validar Turnstile ANTES de qualquer operação
  const tsRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: TURNSTILE_SECRET,
      response: (turnstile_token as string) ?? '',
    }),
  });
  const tsData = await tsRes.json();

  if (!tsData.success) {
    return new Response(JSON.stringify({ error: 'Verificação de segurança falhou' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 2. INSERT no Supabase PRIMEIRO (lead preservado mesmo se n8n falhar)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: lead, error: dbError } = await supabase
    .from('prepcenter_leads')
    .insert({
      nome: (nome as string).trim(),
      whatsapp: (whatsapp as string).trim(),
      volume,
      marketplace,
      lgpd_consent: lgpd_consent === true || lgpd_consent === 'true',
      turnstile_validated: true,
      utm_source: utm_source ?? null,
      utm_medium: utm_medium ?? null,
      utm_campaign: utm_campaign ?? null,
      utm_content: utm_content ?? null,
      utm_term: utm_term ?? null,
    })
    .select('id')
    .single();

  if (dbError) {
    console.error('DB error:', dbError.message);
    return new Response(JSON.stringify({ error: 'Erro ao processar. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 3. Notificar n8n (async — não bloqueia resposta ao usuário)
  const leadId = lead?.id;
  if (N8N_WEBHOOK_URL) {
    fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, nome, whatsapp, volume, marketplace }),
    })
      .then(async (r) => {
        if (r.ok) {
          await supabase.from('prepcenter_leads')
            .update({ n8n_notified: true })
            .eq('id', leadId);
        }
      })
      .catch((err) => console.error('n8n error:', err));
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
