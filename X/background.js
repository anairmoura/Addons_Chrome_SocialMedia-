// background.js
const STORAGE_KEY = 'x_engagement_tweets';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TWEETS_BATCH') {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const store = result[STORAGE_KEY] || {};

      message.records.forEach((rec) => {
        const existing = store[rec.tweetId];
        if (existing) {
          store[rec.tweetId] = {
            ...existing,
            likeCount: Math.max(existing.likeCount || 0, rec.likeCount || 0),
            retweetCount: Math.max(existing.retweetCount || 0, rec.retweetCount || 0),
            replyCount: Math.max(existing.replyCount || 0, rec.replyCount || 0),
            bookmarkCount: Math.max(existing.bookmarkCount || 0, rec.bookmarkCount || 0),
            viewCount:
              rec.viewCount != null
                ? Math.max(existing.viewCount || 0, rec.viewCount)
                : existing.viewCount,
            text: existing.text || rec.text,
            mediaType: existing.mediaType !== 'none' ? existing.mediaType : rec.mediaType,
            lastSeenAt: rec.capturedAt
          };
        } else {
          store[rec.tweetId] = { ...rec, lastSeenAt: rec.capturedAt };
        }
      });

      chrome.storage.local.set({ [STORAGE_KEY]: store }, () => {
        const count = Object.keys(store).length;
        chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
        chrome.action.setBadgeBackgroundColor({ color: '#1D9BF0' });
      });
    });
  }
  return true;
});
