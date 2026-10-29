const fs = require("fs");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(
  "/mnt/user-data/uploads/Claranet_Portugal__Posts___LinkedIn.html",
  "utf-8"
);
const dom = new JSDOM(html);
const document = dom.window.document;

// ---- copy of the extraction logic from content.js (chrome-free) ----

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
function findPostContainers() {
  const results = [];
  const seen = new Set();
  document.querySelectorAll("[data-lazy-mount-id]").forEach((el) => {
    const t = el.textContent.trim();
    if (t.startsWith("Feed post") && !seen.has(el)) {
      seen.add(el);
      results.push(el);
    }
  });
  return results;
}
function extractAuthor(post) {
  const link = Array.from(
    post.querySelectorAll(
      "a[href*='/company/'], a[href*='/in/'], a[href*='/school/']"
    )
  ).find((a) => a.textContent.trim().length > 0);
  return link ? link.textContent.trim() : "";
}
function extractTimestamp(post) {
  const m = textOf(post).match(/(\d+(?:mo|yr|[smhdw]))\s*•/);
  return m ? m[1] : "";
}
function extractSnippet(post) {
  let text = textOf(post);
  text = text.replace(/^Feed post\s*/i, "");
  text = text.replace(
    /^.{0,80}?followers\s*[\d\w]*\s*(?:•\s*Edited\s*•\s*)?/i,
    ""
  );
  return text.length > 160 ? text.slice(0, 160) + "…" : text;
}
function findActionBar(post) {
  const divs = post.querySelectorAll("div");
  for (const div of divs) {
    if (normalizeCompact(div) === "likecommentrepostsend") return div;
  }
  return null;
}
function findCountsBar(actionBar) {
  let sib = actionBar.previousElementSibling;
  let hops = 0;
  while (sib && hops < 3 && textOf(sib).length === 0) {
    sib = sib.previousElementSibling;
    hops++;
  }
  return sib;
}
function extractCounts(post) {
  let likes = 0,
    comments = 0,
    reposts = 0;
  const actionBar = findActionBar(post);
  const countsBar = actionBar ? findCountsBar(actionBar) : null;
  if (!countsBar) return { likes, comments, reposts };

  const segments = Array.from(countsBar.children).map((c) => textOf(c));
  if (segments.length === 0) segments.push(textOf(countsBar));

  segments.forEach((text) => {
    if (!text) return;

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
function detectContentType(post) {
  if (post.querySelector("video")) return "Video";
  const fullText = textOf(post);
  const pagesMatch = fullText.match(/\b(\d{1,3})\s*pages?\b/i);
  if (pagesMatch) return "Document";
  const contentImg = Array.from(post.querySelectorAll("img")).find((img) => {
    const alt = (img.getAttribute("alt") || "").trim();
    return /^View image/i.test(alt);
  });
  if (contentImg) return "Image";
  if (/\bmin read\b/i.test(fullText)) return "Article/Link";
  const snippet = extractSnippet(post);
  if (snippet.length > 0) return "Text";
  return "Other";
}

// ---- run ----
const containers = findPostContainers();
console.log("Containers found:", containers.length);
console.log("");

containers.forEach((post, i) => {
  const author = extractAuthor(post);
  const ts = extractTimestamp(post);
  const { likes, comments, reposts } = extractCounts(post);
  const type = detectContentType(post);
  const snippet = extractSnippet(post).slice(0, 60);
  console.log(
    `${i + 1}. [${type}] ${author} | ${ts} | L=${likes} C=${comments} R=${reposts} | "${snippet}"`
  );
});
