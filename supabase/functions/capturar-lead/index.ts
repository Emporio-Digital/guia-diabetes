import { createClient } from 'jsr:@supabase/supabase-js@2'

// --- SEUS LINKS DE DOWNLOAD DOS EBOOKS ---
const LINKS_PDF = {
  'guia_receitas_saudaveis': 'https://seusite.com/downloads/guia-diabetes.pdf', // Link real do PDF da Isca
  'guia_ansiedade': 'https://seusite.com/downloads/guia-ansiedade.pdf',
  'padrao': 'https://seusite.com/downloads/aviso-erro.pdf'
}
// ----------------------------------------

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
          source: 'landing-vitrine',
          created_at: new Date()
        },
        { onConflict: 'email' }
      )

    if (dbError) throw dbError

    // 2. Envia Email com Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (resendApiKey) {
      const linkDownload = LINKS_PDF[interest] || LINKS_PDF['padrao']
      
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: 'Seu Projeto <onboarding@resend.dev>', // Use esse email de teste até configurar seu dominio
          to: [email],
          subject: 'Seu Ebook Grátis Chegou! 🎁',
          html: `
            <div style="font-family: sans-serif; color: #333; padding: 20px;">
              <h1>Olá, ${name}!</h1>
              <p>Obrigado pelo cadastro. Como prometido, aqui está seu material.</p>
              <br>
              <a href="${linkDownload}" style="background-color: #00ff88; color: #000; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">BAIXAR AGORA ⬇️</a>
              <br><br>
              <p>Atenciosamente,<br>Equipe Empório Digital</p>
            </div>
          `
        })
      })
      
      if (!res.ok) console.error("Erro email:", await res.text())
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