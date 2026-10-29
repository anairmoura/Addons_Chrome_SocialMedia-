/**
 * x.js
 * Captura passiva à medida que navegas manualmente no perfil do X/Twitter.
 * O X usa atributos data-testid relativamente estáveis, o que ajuda.
 */
(function () {
  const seen = new Set();

  function profileFromURL() {
    const m = location.pathname.match(/^\/([^/?]+)/);
    return m ? m[1] : "desconhecido";
  }

  function extractMetric(tweet, testId) {
    const el = tweet.querySelector(`[data-testid="${testId}"]`);
    if (!el) return null;
    const label = el.getAttribute("aria-label") || el.textContent || "";
    const m = label.match(/([\d.,]+\s?[kKmM]?)/);
    return m ? window.SCT.parseCompactNumber(m[1]) : null;
  }

  function detectFormat(tweet) {
    if (tweet.querySelector('div[data-testid="videoPlayer"]')) return "Vídeo";
    const images = tweet.querySelectorAll('div[data-testid="tweetPhoto"]');
    if (images.length > 1) return "Carrossel de imagens";
    if (images.length === 1) return "Imagem";
    if (tweet.querySelector('div[data-testid="card.wrapper"]')) return "Link / Card";
    if (tweet.querySelector('div[role="group"][aria-label*="oll"]')) return "Sondagem";
    return "Texto";
  }

  function extractText(tweet) {
    const el = tweet.querySelector('div[data-testid="tweetText"]');
    return el ? el.textContent.trim().slice(0, 500) : "";
  }

  function extractDate(tweet) {
    const el = tweet.querySelector("time");
    if (el && el.getAttribute("datetime")) return new Date(el.getAttribute("datetime")).toISOString();
    return null;
  }

  function processTweet(tweet) {
    const linkEl = tweet.querySelector('a[href*="/status/"] time');
    const url = linkEl && linkEl.parentElement ? linkEl.parentElement.href.split("?")[0] : null;
    const id = url || tweet.getBoundingClientRect().top + "-" + Date.now();
    if (seen.has(id)) return;
    seen.add(id);

    window.SCT.sendPost({
      platform: "X (Twitter)",
      profile: profileFromURL(),
      url,
      dateISO: extractDate(tweet),
      likes: extractMetric(tweet, "like"),
      comments: extractMetric(tweet, "reply"),
      format: detectFormat(tweet),
      textSnippet: extractText(tweet)
    });
  }

  function scanVisible() {
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    tweets.forEach((tweet) => {
      const rect = tweet.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
      if (inViewport) processTweet(tweet);
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
