import { createClient } from 'jsr:@supabase/supabase-js@2'

// --- SEUS LINKS DE DOWNLOAD (Troque pelos seus links do Google Drive/S3) ---
const LINKS_PDF = {
  // Quando o site mandar 'guia_receitas_saudaveis', enviamos este PDF:
  'guia_receitas_saudaveis': 'https://seusite.com/downloads/guia-diabetes.pdf',
  
  // Exemplo para futuras landing pages:
  'guia_ansiedade': 'https://seusite.com/downloads/guia-ansiedade.pdf',
  
  // Link padrão caso dê algum erro
  'padrao': 'https://google.com' 
}
// -------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, email, whatsapp, interest } = await req.json()

    if (!email || !name) throw new Error('Dados incompletos')

    // 1. Salva no Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: dbError } = await supabaseAdmin
      .from('leads')
      .upsert(
        { 
          email: email, 
          name: name,
          whatsapp: whatsapp,
          interest: interest,
          source: 'vitrine-digital', // Mudei a fonte pra saber que veio da nova
          created_at: new Date()
        },
        { onConflict: 'email' }
      )

    if (dbError) throw dbError

    // 2. Envia Email com Resend
    // A chave é pega das variáveis de ambiente (segurança máxima)
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (resendApiKey) {
      // Define qual link enviar
      const linkDownload = LINKS_PDF[interest] || LINKS_PDF['padrao']
      
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: 'Seu Nome <onboarding@resend.dev>', // Depois que verificar domínio, troque aqui
          to: [email],
          subject: 'Seu Ebook Grátis Chegou! 🎁',
          html: `
            <div style="font-family: sans-serif; color: #333; padding: 20px;">
              <h1>Olá, ${name}!</h1>
              <p>Obrigado pelo cadastro. Aqui está seu material exclusivo.</p>
              <br>
              <a href="${linkDownload}" style="background-color: #00ff88; color: #000; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">BAIXAR EBOOK AGORA ⬇️</a>
              <br><br>
              <p>Ou acesse: ${linkDownload}</p>
              <hr>
              <p style="font-size: 12px; color: #888;">Equipe Empório Digital</p>
            </div>
          `
        })
      })
      
      if (!res.ok) {
        console.error("Erro Resend:", await res.text())
      }
    } else {
      console.log("Sem chave RESEND configurada.")
    }

    return new Response(JSON.stringify({ message: "Sucesso!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})