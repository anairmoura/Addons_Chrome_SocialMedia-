/**
 * tiktok.js
 * Captura passiva à medida que navegas manualmente no TikTok.
 * Não faz scroll nem cliques automáticos — apenas lê o que a página já expõe.
 *
 * NOTA SOBRE A FONTE DOS DADOS
 * O TikTok é totalmente client-side rendered (<div id="app" data-csr="1">),
 * mas injeta no HTML inicial um blob JSON em
 *   <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">
 * que, numa página de vídeo, contém o post completo em
 *   __DEFAULT_SCOPE__["webapp.video-detail"].itemInfo.itemStruct
 * com valores exatos: stats.diggCount / commentCount / playCount / shareCount,
 * createTime (epoch em segundos), desc (legenda completa), challenges
 * (hashtags) e author.uniqueId.
 *
 * Isto é muito mais fiável do que ler contadores do DOM (que vêm abreviados,
 * "1.2K", e dependem de classes ofuscadas). Por isso este script tenta o blob
 * primeiro e só cai para o DOM quando o blob não serve.
 *
 * LIMITE IMPORTANTE: o blob corresponde ao URL com que a página foi CARREGADA.
 * Se navegares dentro do TikTok sem recarregar (SPA), ele fica desatualizado —
 * daí a verificação do id do vídeo contra o URL atual antes de o usar.
 *
 * Na prática, isto acontece com frequência: ao clicar numa miniatura a
 * partir da própria grelha do perfil, o TikTok muda o URL para
 * /@user/video/ID por pushState mas mantém o blob da página de perfil
 * (só com "webapp.user-detail", sem "webapp.video-detail"). Nesse caso o
 * caminho DOM (extractOpenPostFromDOM) não é um recurso raro — é o caminho
 * mais usado no dia a dia. Só um load direto do URL do vídeo (ex.: seguir
 * um link, dar refresh) garante o blob "webapp.video-detail" completo.
 */
(function () {
  const seen = new Set();

  function profileFromURL() {
    const m = location.pathname.match(/^\/@([^/?]+)/);
    return m ? m[1] : "desconhecido";
  }

  function videoIdFromURL() {
    const m = location.pathname.match(/\/(?:video|photo)\/(\d+)/);
    return m ? m[1] : null;
  }

  function textFrom(el) {
    if (!el) return null;
    return el.getAttribute("aria-label") || el.textContent || "";
  }

  function metricFrom(el) {
    const raw = textFrom(el);
    if (!raw) return null;
    const m = raw.match(/([\d.,]+\s?[kKmMbB]?)/);
    return m ? window.SCT.parseCompactNumber(m[1]) : null;
  }

  // ------------------------------------------------------------------
  // Blob de rehydration
  // ------------------------------------------------------------------
  let rehydrationCache;

  function readRehydration() {
    if (rehydrationCache !== undefined) return rehydrationCache;
    rehydrationCache = null;
    try {
      const el = document.getElementById("__UNIVERSAL_DATA_FOR_REHYDRATION__");
      if (el && el.textContent) {
        const parsed = JSON.parse(el.textContent);
        rehydrationCache = parsed.__DEFAULT_SCOPE__ || null;
      }
    } catch (e) {
      rehydrationCache = null;
    }
    return rehydrationCache;
  }

  function itemStructFromRehydration() {
    const scope = readRehydration();
    if (!scope) return null;
    const detail = scope["webapp.video-detail"];
    const item = detail && detail.itemInfo && detail.itemInfo.itemStruct;
    if (!item || !item.id) return null;
    // Só serve se corresponder ao vídeo que está mesmo aberto agora.
    const current = videoIdFromURL();
    if (current && item.id !== current) return null;
    return item;
  }

  function toInt(v) {
    if (v == null) return null;
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    return isNaN(n) ? null : n;
  }

  function postFromItemStruct(item) {
    const stats = item.statsV2 || item.stats || {};
    const author = item.author || {};
    const hashtags = (item.challenges || [])
      .map((c) => c && c.title)
      .filter(Boolean);

    const createTime = toInt(item.createTime);
    const dateISO = createTime ? new Date(createTime * 1000).toISOString() : null;

    let format = "Vídeo";
    if (item.imagePost) format = "Carrossel de fotos";

    return {
      platform: "TikTok",
      profile: author.uniqueId || profileFromURL(),
      url: author.uniqueId
        ? `https://www.tiktok.com/@${author.uniqueId}/video/${item.id}`
        : location.href.split("?")[0],
      dateISO,
      likes: toInt(stats.diggCount),
      comments: toInt(stats.commentCount),
      views: toInt(stats.playCount),
      shares: toInt(stats.shareCount),
      saves: toInt(stats.collectCount),
      format,
      durationSec: item.video ? toInt(item.video.duration) : null,
      hashtags,
      // A legenda inclui as hashtags, o que ajuda a categorização em common.js.
      textSnippet: (item.desc || "").trim().slice(0, 500)
    };
  }

  // ------------------------------------------------------------------
  // Modo 1: grelha do perfil — URL, formato e visualizações
  // (o blob de /@utilizador não traz a lista de posts; é carregada por API
  //  depois do load, por isso aqui só resta o DOM)
  // ------------------------------------------------------------------
  function scanGrid() {
    // Âmbito à lista de posts (#user-post-item-list) quando existe, para não
    // apanhar itens semelhantes de secções de sugestões mais abaixo na página.
    const scope = document.getElementById("user-post-item-list") || document;
    const items = scope.querySelectorAll(
      '[data-e2e="user-post-item"], [data-e2e="user-liked-item"], div[class*="DivItemContainer"]'
    );
    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
      if (!inViewport) return;

      const linkEl = item.querySelector('a[href*="/video/"], a[href*="/photo/"]');
      if (!linkEl) return;
      const url = linkEl.href.split("?")[0];
      if (seen.has(url)) return;
      seen.add(url);

      // Na grelha o TikTok expõe visualizações, não likes.
      const views = metricFrom(
        item.querySelector('[data-e2e="video-views"], strong[class*="StrongVideoCount"]')
      );

      const coverEl = item.querySelector("img[alt]");
      const textSnippet = coverEl ? (coverEl.getAttribute("alt") || "").trim().slice(0, 500) : "";

      window.SCT.sendPost({
        platform: "TikTok",
        profile: profileFromURL(),
        url,
        dateISO: null,
        likes: null,
        comments: null,
        views,
        shares: null,
        saves: null,
        format: /\/photo\//.test(url) ? "Carrossel de fotos" : "Vídeo",
        durationSec: null,
        hashtags: [],
        textSnippet
      });
    });
  }

  // ------------------------------------------------------------------
  // Modo 2: vídeo/foto aberto — blob primeiro, DOM como recurso
  // ------------------------------------------------------------------
  function extractOpenPostFromDOM() {
    const root =
      document.querySelector('[data-e2e="browse-video"]') ||
      document.querySelector('[id*="column-item-video-container"]') ||
      document.body;

    const likes = metricFrom(root.querySelector('[data-e2e="like-count"], [data-e2e="browse-like-count"]'));
    const comments = metricFrom(root.querySelector('[data-e2e="comment-count"], [data-e2e="browse-comment-count"]'));
    // O TikTok não mostra um contador de partilhas no DOM do vídeo aberto
    // (só o grupo de botões [data-e2e="browse-share-group"], sem número) —
    // "shares" fica null aqui; só vem preenchido quando o blob de rehydration se aplica.
    const shares = metricFrom(root.querySelector('[data-e2e="share-count"]'));
    // Os favoritos/guardados usam data-e2e="browse-favorite-count".
    const saves = metricFrom(root.querySelector('[data-e2e="favorite-count"], [data-e2e="browse-favorite-count"]'));

    // Se as métricas ainda não renderizaram, desiste — volta na próxima passagem.
    if (likes == null && comments == null) return null;

    const descEl = root.querySelector('[data-e2e="browse-video-desc"], [data-e2e="video-desc"]');
    const textSnippet = descEl ? descEl.textContent.trim().slice(0, 500) : "";

    // Os links de hashtag são URLs absolutos (https://www.tiktok.com/tag/xxx),
    // não relativos — por isso vai por "includes", não por "starts with".
    const hashtags = Array.from(root.querySelectorAll('a[href*="/tag/"]'))
      .map((a) => {
        const m = a.getAttribute("href").match(/\/tag\/([^/?#]+)/);
        return m ? decodeURIComponent(m[1]) : null;
      })
      .filter(Boolean);

    return {
      platform: "TikTok",
      profile: profileFromURL(),
      url: location.href.split("?")[0],
      // O DOM só mostra datas relativas ("2-5", "3d"), pouco fiáveis de converter.
      dateISO: null,
      likes,
      comments,
      views: null,
      shares,
      saves,
      format: /\/photo\//.test(location.pathname) ? "Carrossel de fotos" : "Vídeo",
      durationSec: null,
      hashtags,
      textSnippet
    };
  }

  function extractOpenPost() {
    if (!/\/(video|photo)\//.test(location.pathname)) return;

    const url = location.href.split("?")[0];
    const key = url + "|full";
    if (seen.has(key)) return;

    const item = itemStructFromRehydration();
    const post = item ? postFromItemStruct(item) : extractOpenPostFromDOM();
    if (!post) return;

    post.source = item ? "rehydration" : "dom";
    seen.add(key);
    window.SCT.sendPost(post);
  }

  // ------------------------------------------------------------------
  // Reage a scroll natural do utilizador (throttled) e a novos elementos.
  // ------------------------------------------------------------------
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

  window.addEventListener("scroll", throttledScan, { passive: true });
  const observer = new MutationObserver(throttledScan);
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(throttledScan, 1500);
})();
