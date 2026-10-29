/**
 * instagram.js
 * Captura passiva à medida que navegas manualmente no perfil do Instagram.
 * O Instagram usa muito código gerado dinamicamente com classes ofuscadas;
 * a captura fiável de likes/comentários funciona melhor quando abres cada
 * publicação individualmente (o utilizador clica, não o script).
 */
(function () {
  const seen = new Set();

  function profileFromURL() {
    const m = location.pathname.match(/^\/([^/?]+)/);
    return m ? m[1] : "desconhecido";
  }

  function detectFormatFromGrid(article) {
    if (article.querySelector('svg[aria-label*="Carrossel"], svg[aria-label*="Carousel"]')) return "Carrossel";
    if (article.querySelector('svg[aria-label*="Vídeo"], svg[aria-label*="Video"], svg[aria-label*="Clip"], svg[aria-label*="Reel"]')) return "Vídeo / Reel";
    return "Imagem";
  }

  // --- Modo 1: grelha do perfil (apenas deteta formato + URL; sem likes/comentários) ---
  function scanGrid() {
    const links = document.querySelectorAll('article a[href*="/p/"], article a[href*="/reel/"]');
    links.forEach((link) => {
      const url = link.href.split("?")[0];
      const id = url;
      if (seen.has(id)) return;
      seen.add(id);

      const format = detectFormatFromGrid(link);
      const post = {
        platform: "Instagram",
        profile: profileFromURL(),
        url,
        dateISO: null,
        likes: null,
        comments: null,
        format,
        textSnippet: ""
      };
      window.SCT.sendPost(post);
    });
  }

  // --- Modo 2: publicação aberta (modal ou página /p/xxx) — likes, comentários, legenda, data ---
  function extractOpenPost() {
    const main = document.querySelector('article');
    if (!main) return;

    const url = location.href.split("?")[0];
    if (!/\/(p|reel)\//.test(location.pathname)) return;
    if (seen.has(url + "|full")) return;

    let likes = null;
    const likeEl = main.querySelector('section span[title], a[href*="/liked_by/"] span');
    if (likeEl) {
      const raw = likeEl.getAttribute("title") || likeEl.textContent;
      likes = window.SCT.parseCompactNumber(raw);
    }
    if (likes == null) {
      const likeTextEl = Array.from(main.querySelectorAll("section span")).find((s) =>
        /gosto|like/i.test(s.textContent)
      );
      if (likeTextEl) likes = window.SCT.parseCompactNumber(likeTextEl.textContent);
    }

    let comments = null;
    const commentNodes = main.querySelectorAll('ul > div, ul li');
    if (commentNodes.length) comments = commentNodes.length;

    const timeEl = main.querySelector("time");
    const dateISO = timeEl ? timeEl.getAttribute("datetime") : null;

    const captionEl = main.querySelector("h1, div[data-testid='post-comment-root'] span, span[dir='auto']");
    const textSnippet = captionEl ? captionEl.textContent.trim().slice(0, 500) : "";

    const format = main.querySelector("video") ? "Vídeo / Reel"
      : main.querySelectorAll('ul[class] li[class] img, div[role="button"][aria-label*="róximo"]').length > 0 ? "Carrossel"
      : "Imagem";

    seen.add(url + "|full");
    window.SCT.sendPost({
      platform: "Instagram",
      profile: profileFromURL() === url ? profileFromURL() : profileFromURL(),
      url,
      dateISO,
      likes,
      comments,
      format,
      textSnippet
    });
  }

  let ticking = false;
  function throttledScan() {
    if (ticking) return;
    ticking = true;
    setTimeout(() => {
      scanGrid();
      extractOpenPost();
      ticking = false;
    }, 800);
  }

  window.addEventListener("scroll", throttledScan);
  const observer = new MutationObserver(throttledScan);
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(throttledScan, 1500);
})();
