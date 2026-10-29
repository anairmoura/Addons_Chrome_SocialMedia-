/**
 * common.js
 * Utilitários partilhados por todos os content scripts.
 * IMPORTANTE: este script é passivo. Nunca faz scroll automático, nunca clica
 * em botões, nunca simula comportamento humano. Apenas lê o DOM que já está
 * visível no ecrã à medida que o próprio utilizador navega normalmente.
 */

(function () {
  if (window.__SCT_COMMON_LOADED__) return;
  window.__SCT_COMMON_LOADED__ = true;

  // ---------------------------------------------------------------------
  // Categorização de conteúdo por palavras-chave (PT + EN, minúsculas)
  // ---------------------------------------------------------------------
  const CATEGORY_KEYWORDS = {
    "RH / Recrutamento": [
      "vaga", "vagas", "recrutamos", "recrutamento", "estamos a contratar",
      "junta-te à equipa", "junta-te a equipa", "candidata-te", "talento",
      "carreira", "carreiras", "colaborador", "colaboradores", "onboarding",
      "hiring", "we're hiring", "join our team", "career", "careers", "job opening",
      "pessoas", "people", "together", "activity", "join us", "encontro"
    ],
    "Liderança": [
      "liderança", "lider", "líder", "ceo", "administração", "board",
      "visão estratégica", "gestão de topo", "leadership", "executive",
      "management team", "diretor geral", "presidente do conselho", 
      "CTO", "CFO", "head", "manager", "senior"
    ],
    "Produtos / Serviços": [
      "lançamento", "novo produto", "nova coleção", "solução", "serviço",
      "disponível agora", "compra já", "descubra", "funcionalidade",
      "product launch", "new feature", "shop now", "buy now", "our solution",
      "software", "hardware", "IBM", "CRM", "case study", "sucess"
    ],
    "ESG / Ambiente": [
      "esg", "sustentabilidade", "sustentável", "pegada de carbono",
      "carbono neutro", "energias renováveis", "reciclagem", "ambiente",
      "environment", "sustainability", "carbon neutral", "net zero", "green"
    ],
    "Responsabilidade Social": [
      "responsabilidade social", "comunidade", "voluntariado", "doação",
      "donativo", "causa social", "solidariedade", "ipss", "ong",
      "community", "volunteering", "donation", "charity", "give back"
    ],
    "Eventos / Institucional": [
      "evento", "conferência", "webinar", "feira", "aniversário", "prémio",
      "premiado", "parceria", "conference", "award", "anniversary",
      "partnership", "summit", "partner", "parceiro", "thank you"
    ]
  };

  function categorizeText(text) {
    if (!text) return "Não classificado";
    const lower = text.toLowerCase();
    const scores = {};
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) score++;
      }
      if (score > 0) scores[category] = score;
    }
    const entries = Object.entries(scores);
    if (entries.length === 0) return "Outro / Não classificado";
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }

  function parseCompactNumber(raw) {
    if (raw == null) return null;
    let s = String(raw).trim().toLowerCase();
    s = s.replace(/\./g, "").replace(",", ".");
    s = s.replace(/[^\d.,kmb]/gi, "");
    if (s === "") return null;
    const mult = { k: 1000, m: 1000000, b: 1000000000 };
    const lastChar = s.slice(-1);
    if (mult[lastChar]) {
      const num = parseFloat(s.slice(0, -1));
      if (isNaN(num)) return null;
      return Math.round(num * mult[lastChar]);
    }
    const num = parseInt(s, 10);
    return isNaN(num) ? null : num;
  }

  function monthKeyFromDate(date) {
    if (!date || isNaN(date.getTime())) return "Desconhecido";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function sendPost(post) {
    // post: { platform, profile, url, dateISO, likes, comments, format, textSnippet }
    post.category = categorizeText(post.textSnippet || "");
    post.month = monthKeyFromDate(post.dateISO ? new Date(post.dateISO) : null);
    post.capturedAt = new Date().toISOString();
    chrome.runtime.sendMessage({ type: "SCT_NEW_POST", post }).catch(() => {});
  }

  window.SCT = { categorizeText, parseCompactNumber, monthKeyFromDate, sendPost };
})();
