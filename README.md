# SIO-K9 v0.6.0 — Módulo de Mídias

Novidades:
- seção Mídias no cadastro do BOU;
- campo de legenda;
- seleção múltipla de fotos e vídeos;
- botão compacto na consulta: 🗂️ 📷x 🎥x;
- visualização das mídias armazenadas no Google Drive;
- mídias não aparecem no fechamento mensal.

## ATENÇÃO — atualização do Google Apps Script

Antes de testar o envio de mídias:
1. Abra o projeto do Google Apps Script usado pelo SIO-K9.
2. Substitua o código atual pelo arquivo `Codigo_Google_Apps_Script_SIO_K9_v0_5_5.gs`.
3. Mantenha no campo `API_TOKEN` o mesmo token já usado no aplicativo.
4. Salve o projeto.
5. Crie uma **nova implantação** do tipo Aplicativo da Web.
6. Copie a nova URL terminada em `/exec` e salve-a na aba Backup do SIO-K9.

As mídias serão organizadas na pasta `SIO-K9_MIDIAS`, com uma subpasta para cada BOU.
Limite técnico desta versão: 25 MB por arquivo.

Publique todo o conteúdo deste pacote no Netlify.
