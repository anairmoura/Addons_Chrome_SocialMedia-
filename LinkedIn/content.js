/**
 * LinkedIn Feed Tracker - content script
 *
 * IMPORTANT CONTEXT: LinkedIn's current feed UI (as of late 2026) renders
 * with fully hashed/obfuscated CSS class names (e.g. "_9a220278") that
 * carry no semantic meaning and can change on every deploy. Because of
 * that, this script deliberately does NOT select elements by class name.
 * Everything below is based on inspecting a real saved LinkedIn page and
 * uses only things that are structurally/semantically stable:
 *   - the hidden accessibility label "Feed post" that prefixes every post
 *   - the per-post `data-lazy-mount-id` attribute
 *   - the always-English action button labels ("Like", "Comment",
 *     "Repost", "Send") even when the post content is in another language
 *   - <video> tags for video content
 *   - img alt text ("View image" = real content image, "View company: X"
 *     / "View: X's profile" = avatar, safe to ignore)
 *
 * If LinkedIn changes this structure again, the DEBUG logging below
 * (search the console for "[LI Tracker]") will show exactly how many
 * post containers were found, which is the fastest way to tell whether
 * a selector broke.
 */

(() => {
  const STORAGE_KEY = "linkedin_posts";
  const DEBUG_KEY = "linkedin_debug";
  const SCAN_DEBOUNCE_MS = 600;
  const POLL_INTERVAL_MS = 5000;
  const DEBUG = true;

  let scanTimeout = null;

  function log(...args) {
    if (DEBUG) console.log("[LI Tracker]", ...args);
  }

  // ---------- small helpers ----------

  function textOf(el) {
    return el ? (el.textContent || "").trim() : "";
  }

  function normalizeCompact(el) {
    return (el.textContent || "").replace(/\s+/g, "").toLowerCase();
  }

  function parseCount(raw) {
    if (!raw) return 0;
    const s = String(raw).trim().toLowerCase().replace(/,/g, "");
    const m = s.match(/([\d.]+)\s*([km]?)/i);
    if (!m) return 0;
    let num = parseFloat(m[1]);
    if (isNaN(num)) return 0;
    if (m[2] === "k") num *= 1000;
    if (m[2] === "m") num *= 1000000;
    return Math.round(num);
  }

  // ---------- finding post containers ----------

  function findPostContainers() {
    const results = [];
    const seen = new Set();

    // Primary strategy: per-post mount wrapper whose accessible label
    // starts with "Feed post".
    document.querySelectorAll("[data-lazy-mount-id]").forEach((el) => {
      const t = el.textContent.trim();
      if (t.startsWith("Feed post") && !seen.has(el)) {
        seen.add(el);
        results.push(el);
      }
    });

    // Fallback: walk up from every "Like" action button. Used only if the
    // primary strategy finds nothing (e.g. a different feed surface that
    // doesn't use data-lazy-mount-id).
    if (results.length === 0) {
      const likeButtons = Array.from(
        document.querySelectorAll("button, a, span, div")
      ).filter((el) => textOf(el).toLowerCase() === "like");

      likeButtons.forEach((btn) => {
        let node = btn;
        let container = null;
        for (let i = 0; i < 20 && node; i++) {
          node = node.parentElement;
          if (!node) break;
          const hasAuthorLink = node.querySelector(
            "a[href*='/in/'], a[href*='/company/']"
          );
          const len = textOf(node).length;
          if (hasAuthorLink && len > 150 && len < 20000) {
            container = node;
            break;
          }
        }
        if (container && !seen.has(container)) {
          seen.add(container);
          results.push(container);
        }
      });
      if (results.length > 0) log("used fallback container detection:", results.length);
    }

    return results;
  }

  // ---------- per-post extraction ----------

  function extractAuthor(post) {
    const link = Array.from(
      post.querySelectorAll(
        "a[href*='/company/'], a[href*='/in/'], a[href*='/school/']"
      )
    ).find((a) => a.textContent.trim().length > 0);
    return link ? link.textContent.trim() : "";
  }

  function extractTimestamp(post) {
    // Relative timestamps look like "18h", "21m", "1d", "2w", "3mo" and
    // sit directly before a "•" separator. Note: LinkedIn's real text has
    // no whitespace between "followers" and the timestamp (e.g.
    // "followers22h•"), so this intentionally does NOT use a \b word
    // boundary before the digits - digits directly after a letter would
    // fail a \b check since both are word characters.
    const m = textOf(post).match(/(\d+(?:mo|yr|[smhdw]))\s*•/);
    return m ? m[1] : "";
  }

  function extractSnippet(post) {
    // Grab the post's visible text and trim it down to something short.
    // We don't have a clean "body text only" selector (hashed classes),
    // so we take the full post text, strip the leading "Feed post
    // <Author> <followers> <time> • Edited •" boilerplate heuristically,
    // and cap the length.
    let text = textOf(post);
    text = text.replace(/^Feed post\s*/i, "");
    // Drop a leading "<Author> ... followers ... • (Edited •)?" chunk if present
    text = text.replace(
      /^.{0,80}?followers\s*[\d\w]*\s*(?:•\s*Edited\s*•\s*)?/i,
      ""
    );
    return text.length > 160 ? text.slice(0, 160) + "…" : text;
  }

  function findActionBar(post) {
    const divs = post.querySelectorAll("div");
    for (const div of divs) {
      if (normalizeCompact(div) === "likecommentrepostsend") {
        return div;
      }
    }
    return null;
  }

  function findCountsBar(actionBar) {
    let sib = actionBar.previousElementSibling;
    let hops = 0;
    // Skip empty separators (e.g. an <hr>) that sit between the counts
    // text and the action button row.
    while (sib && hops < 3 && textOf(sib).length === 0) {
      sib = sib.previousElementSibling;
      hops++;
    }
    return sib;
  }

  function extractCounts(post) {
    let likes = 0;
    let comments = 0;
    let reposts = 0;

    const actionBar = findActionBar(post);
    const countsBar = actionBar ? findCountsBar(actionBar) : null;
    if (!countsBar) return { likes, comments, reposts };

    // The counts bar's DOM children have no whitespace text node between
    // them (e.g. visible "8" glued directly to the next segment's "1
    // repost"), so flattening to one string causes digit concatenation
    // bugs ("8" + "1 repost" -> "81"). Parsing each direct child
    // separately avoids that. Typically: child[0] = reactions info,
    // child[1] (if present) = "N comment(s)" and/or "N repost(s)".
    const segments = Array.from(countsBar.children).map((c) => textOf(c));
    if (segments.length === 0) segments.push(textOf(countsBar));

    segments.forEach((text) => {
      if (!text) return;

      // Try the social-proof form first: "Name[, Name2] and N others
      // reacted...". Note: no \b after "reacted" - LinkedIn's duplicated
      // name text is glued directly onto it with no separating space.
      const reactedMatch = text.match(/^(.*?)\s+reacted/i);
      if (reactedMatch) {
        let namePart = reactedMatch[1];
        const othersMatch = namePart.match(/\band\s+(\d+)\s+others?$/i);
        let others = 0;
        if (othersMatch) {
          others = parseInt(othersMatch[1], 10);
          namePart = namePart.slice(0, othersMatch.index);
        }
        const names = namePart
          .split(",")
          .flatMap((s) => s.split(/\s+and\s+/i))
          .map((s) => s.trim())
          .filter(Boolean);
        likes = names.length + others;
      } else {
        // Bare-number form: "N reactionsN" (visible count glued right
        // after the accessible label, no \b at that join either).
        const m = text.match(/^(\d[\d,.]*\s*[kKmM]?)\s*reactions?/i);
        if (m) likes = parseCount(m[1]);
      }

      const commentMatch = text.match(/(\d[\d,.]*\s*[kKmM]?)\s*comments?/i);
      if (commentMatch) comments = parseCount(commentMatch[1]);

      const repostMatch = text.match(/(\d[\d,.]*\s*[kKmM]?)\s*reposts?/i);
      if (repostMatch) reposts = parseCount(repostMatch[1]);
    });

    return { likes, comments, reposts };
  }

  // Content-type detection. Video and Image are backed by confirmed real
  // markup (see header comment). Document/Poll/Article are best-effort
  // heuristics since no real example of those was available while
  // building this - if you see one misclassified, that's why.
  function detectContentType(post) {
    if (post.querySelector("video")) return "Video";

    const fullText = textOf(post);

    const pagesMatch = fullText.match(/\b(\d{1,3})\s*pages?\b/i);
    if (pagesMatch) return "Document";

    const contentImg = Array.from(post.querySelectorAll("img")).find(
      (img) => {
        const alt = (img.getAttribute("alt") || "").trim();
        return /^View image/i.test(alt);
      }
    );
    if (contentImg) return "Image";

    if (/\bmin read\b/i.test(fullText)) return "Article/Link";

    const snippet = extractSnippet(post);
    if (snippet.length > 0) return "Text";

    return "Other";
  }

  function extractPageCount(post) {
    const m = textOf(post).match(/\b(\d{1,3})\s*pages?\b/i);
    return m ? parseInt(m[1], 10) : null;
  }

  function extractIsPromoted(post) {
    return /\bPromoted\b/.test(textOf(post).slice(0, 300));
  }

  function extractId(post, author, snippet) {
    if (post.hasAttribute("data-lazy-mount-id")) {
      return "mount-" + post.getAttribute("data-lazy-mount-id");
    }
    const base = (author + "|" + snippet).toLowerCase().replace(/\s+/g, " ").trim();
    let hash = 0;
    for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) | 0;
    return "synthetic-" + hash;
  }

  // ---------- scan + save ----------

  function scanFeed() {
    const containers = findPostContainers();
    log("scan: found", containers.length, "post container(s)");

    const records = [];

    containers.forEach((post) => {
      const author = extractAuthor(post);
      const snippet = extractSnippet(post);
      const id = extractId(post, author, snippet);
      const { likes, comments, reposts } = extractCounts(post);
      const type = detectContentType(post);

      records.push({
        id,
        author,
        type,
        likes,
        comments,
        reposts,
        pages: type === "Document" ? extractPageCount(post) : null,
        isPromoted: extractIsPromoted(post),
        timestamp: extractTimestamp(post),
        snippet,
        pageUrl: location.href,
        collectedAt: new Date().toISOString()
      });
    });

    if (records.length > 0) {
      saveRecords(records, containers.length);
    } else {
      chrome.storage.local.set({
        [DEBUG_KEY]: {
          containersFound: containers.length,
          recordsSaved: 0,
          scannedAt: new Date().toISOString(),
          pageUrl: location.href
        }
      });
    }
  }

  function saveRecords(records, containersFound) {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const existing = result[STORAGE_KEY] || {};
      let changed = false;
      let changedCount = 0;

      records.forEach((rec) => {
        const prev = existing[rec.id];
        if (
          !prev ||
          prev.likes !== rec.likes ||
          prev.comments !== rec.comments ||
          prev.reposts !== rec.reposts
        ) {
          existing[rec.id] = { ...prev, ...rec };
          changed = true;
          changedCount++;
        }
      });

      if (changed) {
        chrome.storage.local.set({ [STORAGE_KEY]: existing });
      }

      chrome.storage.local.set({
        [DEBUG_KEY]: {
          containersFound,
          recordsSaved: changedCount,
          scannedAt: new Date().toISOString(),
          pageUrl: location.href
        }
      });
    });
  }

  function debouncedScan() {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scanFeed, SCAN_DEBOUNCE_MS);
  }

  // ---------- observers ----------

  const observer = new MutationObserver(() => debouncedScan());
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("scroll", debouncedScan, { passive: true });

  // Poll as a safety net in case LinkedIn updates the DOM in a way that
  // doesn't trigger the mutation observer (e.g. attribute-only changes).
  setInterval(scanFeed, POLL_INTERVAL_MS);

  // Initial scan shortly after load
  setTimeout(scanFeed, 1500);

  // Let the popup trigger an immediate scan on demand.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.action === "scanNow") {
      scanFeed();
      sendResponse({ ok: true });
    }
    return true;
  });

  log("content script loaded on", location.href);
})();
