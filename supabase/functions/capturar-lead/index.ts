import { createClient } from 'jsr:@supabase/supabase-js@2'
import nodemailer from "npm:nodemailer@6.9.13";

// --- SEUS LINKS (Apontando para o GitHub) ---
const LINKS_PDF = {
  'guia_receitas_saudaveis': 'https://emporio-digital.github.io/guia-diabetes/guia-diabetes.pdf',
  'padrao': 'https://emporio-digital.github.io/guia-diabetes/guia-diabetes.pdf'
}
// ---------------------------------------------

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
          source: 'vitrine-gmail',
          created_at: new Date()
        },
        { onConflict: 'email' }
      )

    if (dbError) throw dbError

    // 2. Envia Email via Gmail
    const gmailUser = Deno.env.get('GMAIL_USER')
    const gmailPass = Deno.env.get('GMAIL_PASS')

    if (gmailUser && gmailPass) {
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });

      const linkDownload = LINKS_PDF[interest] || LINKS_PDF['padrao']
      const assunto = `Seu Guia: Diabetes Controlada`;

      await transporter.sendMail({
        from: `"Empório Digital" <${gmailUser}>`,
        to: email,
        subject: assunto,
        text: `Olá ${name}, seu guia chegou. Acesse: ${linkDownload}`, 
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
            <p>Olá, <strong>${name}</strong>.</p>
            <p>Conforme solicitado, aqui está o acesso ao <strong>Guia de Receitas Saudáveis</strong>.</p>
            <br>
            <p style="text-align: center;">
              <a href="${linkDownload}" style="background-color: #00AA66; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">BAIXAR GUIA AGORA ⬇️</a>
            </p>
            <br>
            <p>Se o botão não funcionar, clique no link abaixo:</p>
            <p><a href="${linkDownload}" style="color: #00AA66;">${linkDownload}</a></p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #888;">Enviado automaticamente por Empório Digital.</p>
          </div>
        `,
      });
      
      console.log("Email enviado!")
    }

    return new Response(JSON.stringify({ message: "Sucesso" }), {
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