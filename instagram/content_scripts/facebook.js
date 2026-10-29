/**
 * facebook.js
 * Captura passiva: observa o DOM à medida que TU navegas/fazes scroll
 * manualmente no perfil/página do Facebook. Não faz scroll nem cliques
 * automáticos. Os seletores do Facebook usam nomes de classe ofuscados
 * e mudam com frequência — este código assenta sobretudo em atributos
 * mais estáveis (role, aria-label) e pode precisar de ajustes periódicos.
 */
(function () {
  const seen = new Set();

  function profileFromURL() {
    const m = location.pathname.match(/^\/([^/?]+)/);
    return m ? m[1] : "desconhecido";
  }

  function extractLikes(article) {
    // Facebook agrupa reações num span com aria-label tipo "45 mil pessoas gostam disto"
    const candidates = article.querySelectorAll('[aria-label*="gost"], [aria-label*="reaç"], [aria-label*="Like"], [aria-label*="reaction"]');
    for (const el of candidates) {
      const label = el.getAttribute("aria-label") || "";
      const m = label.match(/([\d.,]+\s?[kKmM]?)/);
      if (m) {
        const val = window.SCT.parseCompactNumber(m[1]);
        if (val != null) return val;
      }
    }
    return null;
  }

  function extractComments(article) {
    const candidates = article.querySelectorAll('[aria-label*="coment"], [aria-label*="comment"]');
    for (const el of candidates) {
      const label = el.getAttribute("aria-label") || el.textContent || "";
      const m = label.match(/([\d.,]+\s?[kKmM]?)/);
      if (m) {
        const val = window.SCT.parseCompactNumber(m[1]);
        if (val != null) return val;
      }
    }
    return null;
  }

  function detectFormat(article) {
    if (article.querySelector('video')) return "Vídeo";
    const images = article.querySelectorAll('img[src*="scontent"]');
    if (images.length > 1) return "Carrossel / Álbum";
    if (images.length === 1) return "Imagem";
    if (article.querySelector('a[href*="/events/"]')) return "Evento";
    return "Texto";
  }

  function extractDate(article) {
    const timeEl = article.querySelector("a[aria-label] abbr, abbr[data-utime]");
    if (timeEl) {
      const utime = timeEl.getAttribute("data-utime");
      if (utime) return new Date(parseInt(utime, 10) * 1000).toISOString();
      const title = timeEl.getAttribute("title");
      if (title) {
        const d = new Date(title);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    }
    return null; // desconhecida; o post ainda é capturado, mas cai em "Desconhecido"
  }

  function extractText(article) {
    const textEl = article.querySelector('[data-ad-preview="message"], [dir="auto"]');
    return textEl ? textEl.textContent.trim().slice(0, 500) : "";
  }

  function processArticle(article) {
    const linkEl = article.querySelector('a[href*="/posts/"], a[href*="/videos/"], a[href*="story_fbid"]');
    const url = linkEl ? linkEl.href.split("?")[0] : null;
    const id = url || article.getBoundingClientRect().top + "-" + Date.now();
    if (seen.has(id)) return;
    seen.add(id);

    const post = {
      platform: "Facebook",
      profile: profileFromURL(),
      url,
      dateISO: extractDate(article),
      likes: extractLikes(article),
      comments: extractComments(article),
      format: detectFormat(article),
      textSnippet: extractText(article)
    };
    window.SCT.sendPost(post);
  }

  function scanVisible() {
    const articles = document.querySelectorAll('div[role="article"]');
    articles.forEach((article) => {
      const rect = article.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
      if (inViewport) processArticle(article);
    });
  }

  // Reage a scroll natural do utilizador (throttled) e a novos elementos inseridos.
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    setTimeout(() => {
      scanVisible();
      ticking = false;
    }, 800);
  });

  const observer = new MutationObserver(() => {
    if (ticking) return;
    ticking = true;
    setTimeout(() => {
      scanVisible();
      ticking = false;
    }, 800);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(scanVisible, 1500);
})();
