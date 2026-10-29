/**
 * linkedin.js
 * Captura passiva à medida que navegas manualmente no feed/página de uma
 * empresa ou perfil no LinkedIn.
 */
(function () {
  const seen = new Set();

  function profileFromURL() {
    const m = location.pathname.match(/\/company\/([^/?]+)/) || location.pathname.match(/\/in\/([^/?]+)/);
    return m ? m[1] : "desconhecido";
  }

  function extractLikes(post) {
    const el = post.querySelector('[aria-label*="reaç"], [aria-label*="reaction"], .social-details-social-counts__reactions-count, _170ff3a8 f852cf51 ');
    if (!el) return null;
    const raw = el.getAttribute("aria-label") || el.textContent;
    const m = raw && raw.match(/([\d.,]+\s?[kKmM]?)/);
    return m ? window.SCT.parseCompactNumber(m[1]) : null;
  }

  function extractComments(post) {
    const el = Array.from(post.querySelectorAll("button, span")).find((s) =>
      /coment|comment/i.test(s.textContent || "") && /\d/.test(s.textContent || "")
    );
    if (!el) return null;
    const m = el.textContent.match(/([\d.,]+\s?[kKmM]?)/);
    return m ? window.SCT.parseCompactNumber(m[1]) : null;
  }

  function detectFormat(post) {
    if (post.querySelector("video")) return "Vídeo";
    if (post.querySelector('[data-test-id*="document"], .document-s-container')) return "Documento / Carrossel";
    const images = post.querySelectorAll('.update-components-image img, img[class*="feed-image"]');
    if (images.length > 1) return "Carrossel de imagens";
    if (images.length === 1) return "Imagem";
    if (post.querySelector('article[class*="poll"], [data-test-id*="poll"]')) return "Sondagem";
    return "Texto";
  }

  function extractText(post) {
    const el = post.querySelector(".update-components-text, .feed-shared-update-v2__description, span[dir='ltr']");
    return el ? el.textContent.trim().slice(0, 500) : "";
  }

  function extractDate(post) {
    const el = post.querySelector("time, .update-components-actor__sub-description span[aria-hidden='true']");
    if (!el) return null;
    if (el.tagName === "TIME" && el.getAttribute("datetime")) {
      return new Date(el.getAttribute("datetime")).toISOString();
    }
    // LinkedIn frequentemente mostra "3d", "2sem", "1mês" em vez de data absoluta.
    // Nesses casos não conseguimos calcular a data exata sem abrir o post.
    return null;
  }

  function processPost(post) {
    const linkEl = post.querySelector('a[href*="/posts/"], a[href*="/feed/update/"]');
    const url = linkEl ? linkEl.href.split("?")[0] : null;
    const id = url || post.getBoundingClientRect().top + "-" + Date.now();
    if (seen.has(id)) return;
    seen.add(id);

    window.SCT.sendPost({
      platform: "LinkedIn",
      profile: profileFromURL(),
      url,
      dateISO: extractDate(post),
      likes: extractLikes(post),
      comments: extractComments(post),
      format: detectFormat(post),
      textSnippet: extractText(post)
    });
  }

  function scanVisible() {
    const posts = document.querySelectorAll(
      'div.feed-shared-update-v2, div[data-urn*="activity"], div.occludable-update'
    );
    posts.forEach((post) => {
      const rect = post.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
      if (inViewport) processPost(post);
    });
  }

  let ticking = false;
  function throttledScan() {
    if (ticking) return;
    ticking = true;
    setTimeout(() => {
      scanVisible();
      ticking = false;
    }, 800);
  }

  window.addEventListener("scroll", throttledScan);
  const observer = new MutationObserver(throttledScan);
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(throttledScan, 1500);
})();
