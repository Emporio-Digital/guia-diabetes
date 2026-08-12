import { createClient } from 'jsr:@supabase/supabase-js@2'
import nodemailer from "npm:nodemailer@6.9.13";

// --- LINKS AJUSTADOS PARA O NOVO REPOSITÓRIO (pag-leads) ---
const PRODUTOS_CONFIG = {
  'guia_sono': {
    linkDownload: 'https://emporio-digital.github.io/pag-leads/Durma-Melhor-Viva-Melhor.pdf',
    assunto: 'Seu Guia: Sono Profundo e Restaurador 🌙',
    nomeGuia: 'Guia Durma Melhor, Viva Melhor',
    corBotao: '#0d9488' // Verde/Teal
  },
  'padrao': {
    linkDownload: 'https://emporio-digital.github.io/pag-leads/Durma-Melhor-Viva-Melhor.pdf',
    assunto: 'Seu Guia Digital Chegou! 🎁',
    nomeGuia: 'Guia Durma Melhor, Viva Melhor',
    corBotao: '#0f172a'
  }
}

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

    // 2. Seleciona as configurações com base no interesse
    const configAtual = PRODUTOS_CONFIG[interest] || PRODUTOS_CONFIG['padrao']

    // 3. Envia Email via Gmail
    const gmailUser = Deno.env.get('GMAIL_USER')
    const gmailPass = Deno.env.get('GMAIL_PASS')

    if (gmailUser && gmailPass) {
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });

      await transporter.sendMail({
        from: `"Empório Digital" <${gmailUser}>`,
        to: email,
        subject: configAtual.assunto,
        text: `Olá ${name}, seu guia chegou. Acesse para baixar: ${configAtual.linkDownload}`, 
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px; background-color: #ffffff;">
            <p style="font-size: 16px;">Olá, <strong>${name}</strong>!</p>
            <p style="font-size: 15px; line-height: 1.5; color: #555;">
              Conforme solicitado em nosso site, aqui está o seu acesso exclusivo ao material digital: 
              <br><strong style="color: #111;">${configAtual.nomeGuia}</strong>.
            </p>
            <br>
            <p style="text-align: center; margin: 20px 0;">
              <a href="${configAtual.linkDownload}" style="background-color: ${configAtual.corBotao}; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">BAIXAR E-BOOK AGORA ⬇️</a>
            </p>
            <br>
            <p style="font-size: 13px; color: #777;">Se o botão acima não funcionar, copie e cole o link abaixo no seu navegador:</p>
            <p style="font-size: 13px;"><a href="${configAtual.linkDownload}" style="color: ${configAtual.corBotao}; word-break: break-all;">${configAtual.linkDownload}</a></p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;">
            <p style="font-size: 11px; color: #aaa; text-align: center;">Enviado automaticamente por Empório Digital.</p>
          </div>
        `,
      });
      
      console.log(`Email enviado com sucesso para ${email}!`)
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