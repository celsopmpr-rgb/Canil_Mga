# SIO-K9 v0.6.0

- Módulo de mídias refeito para confirmar no Google Drive cada upload antes de atualizar os contadores.
- A consulta passa a sincronizar os contadores com os arquivos realmente existentes no Drive.
- Registros antigos permanecem compatíveis; mídias de teste sem vínculo real são corrigidas para zero ao consultar.
- Nenhuma alteração no fechamento mensal ou nos demais registros.

# SIO-K9 v0.5.4

- Corrigido o campo de busca da tela Consultar no celular: o teclado não fecha mais após cada letra digitada.
- A lista agora é atualizada sem recriar o campo de pesquisa.
- Registros ordenados por data decrescente, mostrando os mais recentes primeiro.
- Datas da consulta mantidas no formato brasileiro DD/MM/AAAA.

## 0.5.4
- Campo editável ao lado de Outros para especificar a droga.
- Campo editável ao lado de Sintéticos para especificar a substância.
- Fechamento mensal detalha Outros e Sintéticos por nome e quantidade.
- Visitas ao Canil agrupadas por instituição, com total de visitas e visitantes.
- Apresentações agrupadas por local, com público por local e total geral.
- Novo formato visual profissional do fechamento mensal.


## 0.5.5
- Criada a seção Mídias abaixo das drogas no cadastro do BOU.
- Campo editável para legenda das mídias.
- Botões separados para inserir fotos e vídeos.
- Seleção de vários arquivos de uma única vez.
- Upload das mídias para o Google Drive por meio do Apps Script.
- Pasta automática `SIO-K9_MIDIAS`, organizada por BOU.
- Botão compacto na consulta com contadores: 🗂️ 📷x 🎥x.
- Galeria de fotos e acesso aos vídeos pelo Google Drive.
- Fechamento mensal permanece sem informações de mídia.
- Limite de 25 MB por arquivo nesta versão.

## 0.5.5.1
- Na edição do BOU, exibe as quantidades de fotos e vídeos já salvos.
- Mantém separado o total já salvo e os novos arquivos selecionados.
- Adicionado botão para visualizar as mídias já salvas diretamente na tela de edição.
