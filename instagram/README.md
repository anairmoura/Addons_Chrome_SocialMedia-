# Social Content Tracker (extensão Chrome)

Extensão que regista publicações de perfis de **Facebook, Instagram, LinkedIn e X**
enquanto navegas normalmente, e gera um relatório mensal em Excel com:

- Número de publicações, likes e comentários por mês
- Formato mais utilizado (imagem, vídeo, carrossel, texto, etc.)
- Categoria do conteúdo (RH, Liderança, Produtos/Serviços, ESG, Responsabilidade
  Social, Eventos/Institucional, ou Outro), atribuída por análise de palavras‑chave
  ao texto da publicação

## Como funciona (importante)

Esta extensão **não automatiza scroll, cliques nem simula comportamento humano**.
Ela lê apenas o conteúdo que já está visível no ecrã, à medida que **tu próprio**
navegas manualmente pelo perfil. Isto foi uma opção deliberada: todas estas redes
proíbem scraping automatizado nos seus Termos de Serviço, por isso a extensão
funciona como um "bloco de notas inteligente" que regista o que vês, e não como
um robô que navega sozinho.

Isto significa:
- Continuas a controlar totalmente o ritmo de navegação.
- Deves fazer login normalmente nas redes sociais no browser, como habitualmente.
- Para perfis com muitas publicações, terás de percorrer o histórico manualmente
  (scroll) para que os dados mais antigos sejam capturados.
- No Instagram, para obter likes/comentários/data com fiabilidade, é recomendável
  abrires cada publicação individualmente (clicando nela) — a vista em grelha só
  regista o formato.

## Instalação

1. Descarrega e descompacta esta pasta.
2. Abre `chrome://extensions` no Chrome.
3. Ativa o "Modo de programador" (canto superior direito).
4. Clica em "Carregar sem compactação" e seleciona a pasta `social-tracker`.
5. Fixa o ícone da extensão na barra de ferramentas.

## Utilização

1. Abre o perfil que queres analisar (ex.: `facebook.com/nomeempresa`,
   `instagram.com/nomeempresa`, `linkedin.com/company/nomeempresa`,
   `x.com/nomeutilizador`).
2. Faz scroll normalmente pelo perfil, ao teu ritmo. Os posts visíveis vão
   sendo capturados automaticamente em segundo plano.
3. Clica no ícone da extensão para ver quantas publicações já foram capturadas.
4. Repete para os outros perfis/redes que queiras acompanhar.
5. Quando quiseres o relatório, clica em **"Exportar relatório Excel"** — o
   ficheiro `.xlsx` é descarregado com 4 folhas:
   - **Resumo Mensal**: publicações, likes, comentários (totais e médias) por
     rede, perfil e mês
   - **Formatos**: contagem de publicações por formato
   - **Categorias de Conteúdo**: contagem de publicações por categoria
   - **Dados Brutos**: lista completa de publicações capturadas

## Limitações a ter em conta

- As redes sociais mudam frequentemente o HTML das suas páginas. Se a captura
  parar de funcionar numa rede específica, os seletores em
  `content_scripts/<rede>.js` provavelmente precisam de ser atualizados.
- Nem sempre é possível extrair a data exata (algumas redes mostram "3d",
  "2 sem" em vez da data completa) — nesses casos a publicação aparece como
  "Desconhecido" no mês.
- A categorização de conteúdo é feita por palavras‑chave, não por um modelo de
  IA — é um ponto de partida útil, mas convém rever manualmente casos
  ambíguos. As listas de palavras-chave podem ser editadas em
  `content_scripts/common.js` (`CATEGORY_KEYWORDS`).
- Os dados ficam guardados localmente no browser (`chrome.storage.local`).
  Usa "Limpar todos os dados" no popup para reiniciar.
- Respeita sempre os Termos de Serviço de cada rede social e a privacidade dos
  perfis analisados.
