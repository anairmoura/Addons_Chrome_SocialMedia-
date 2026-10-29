// content.js
// Runs on twitter.com / x.com. Watches the timeline as the user scrolls
// (no auto-scrolling, no simulated clicks) and extracts publicly visible
// engagement data from each post that renders on screen.

(function () {
  function parseCount(str) {
    if (!str) return 0;
    str = str.trim().replace(/,/g, '');
    if (str === '') return 0;
    const m = str.match(/^([\d.]+)\s*([KkMmBb]?)$/);
    if (!m) {
      const n = parseInt(str, 10);
      return isNaN(n) ? 0 : n;
    }
    let num = parseFloat(m[1]);
    const suffix = m[2].toUpperCase();
    if (suffix === 'K') num *= 1e3;
    else if (suffix === 'M') num *= 1e6;
    else if (suffix === 'B') num *= 1e9;
    return Math.round(num);
  }

  function getCountFromTestId(article, testIds) {
    for (const tid of testIds) {
      const el = article.querySelector(`[data-testid="${tid}"]`);
      if (el) {
        const span = el.querySelector('span');
        const text = (span ? span.textContent : el.textContent) || '';
        return parseCount(text);
      }
    }
    return 0;
  }

  function getViewsCount(article) {
    const link = article.querySelector('a[href$="/analytics"]');
    if (link) {
      const span = link.querySelector('span');
      if (span) return parseCount(span.textContent);
    }
    const group = article.querySelector('div[role="group"][aria-label]');
    if (group) {
      const label = group.getAttribute('aria-label') || '';
      const m = label.match(/([\d,.]+\s*[KMB]?)\s*views?/i);
      if (m) return parseCount(m[1]);
    }
    return null;
  }

  function extractTweet(article) {
    try {
      const timeEl = article.querySelector('time');
      if (!timeEl) return null;
      const linkEl = timeEl.closest('a');
      const href = linkEl ? linkEl.getAttribute('href') : null;
      if (!href) return null;
      const match = href.match(/\/status\/(\d+)/);
      if (!match) return null;
      const tweetId = match[1];
      const tweetUrl = `https://x.com${href}`;

      let authorName = '';
      let authorHandle = '';
      const nameBlock = article.querySelector('div[data-testid="User-Name"]');
      if (nameBlock) {
        const spans = nameBlock.querySelectorAll('span');
        for (const s of spans) {
          const t = s.textContent.trim();
          if (t.startsWith('@')) {
            authorHandle = t;
            break;
          }
        }
        const firstLink = nameBlock.querySelector('a');
        if (firstLink) {
          const nameSpan = firstLink.querySelector('span');
          if (nameSpan) authorName = nameSpan.textContent.trim();
        }
      }

      const textEl = article.querySelector('div[data-testid="tweetText"]');
      const text = textEl ? textEl.innerText.trim() : '';

      const images = article.querySelectorAll('div[data-testid="tweetPhoto"] img');
      const hasVideo = !!article.querySelector(
        'div[data-testid="videoPlayer"], div[data-testid="videoComponent"], video'
      );
      let mediaType = 'none';
      if (hasVideo) mediaType = 'video';
      else if (images.length > 0) mediaType = 'image';

      const socialContext = article.querySelector('div[data-testid="socialContext"]');
      const isRepost = !!(socialContext && /repost|retweet/i.test(socialContext.textContent));
      const hasQuoted = article.querySelectorAll('time').length > 1;

      const replyCount = getCountFromTestId(article, ['reply']);
      const retweetCount = getCountFromTestId(article, ['retweet', 'unretweet']);
      const likeCount = getCountFromTestId(article, ['like', 'unlike']);
      const bookmarkCount = getCountFromTestId(article, ['bookmark', 'removeBookmark']);
      const viewCount = getViewsCount(article);

      return {
        tweetId,
        tweetUrl,
        authorName,
        authorHandle,
        text,
        mediaType,
        imageCount: images.length,
        isRepost,
        hasQuoted,
        replyCount,
        retweetCount,
        likeCount,
        bookmarkCount,
        viewCount,
        timestamp: timeEl.getAttribute('datetime') || '',
        capturedAt: new Date().toISOString()
      };
    } catch (e) {
      return null;
    }
  }

  function scan() {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    if (articles.length === 0) return;
    const records = [];
    articles.forEach((a) => {
      const rec = extractTweet(a);
      if (rec) records.push(rec);
    });
    if (records.length > 0) {
      chrome.runtime.sendMessage({ type: 'TWEETS_BATCH', records });
    }
  }

  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scan, 400);
  });

  function start() {
    observer.observe(document.body, { childList: true, subtree: true });
    scan();
    // Fallback in case some updates don't trigger the observer as expected
    setInterval(scan, 3000);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    start();
  } else {
    window.addEventListener('DOMContentLoaded', start);
  }
})();
