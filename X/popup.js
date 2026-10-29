const STORAGE_KEY = 'x_engagement_tweets';

function refreshCount() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const store = result[STORAGE_KEY] || {};
    document.getElementById('count').textContent = Object.keys(store).length;
  });
}

document.addEventListener('DOMContentLoaded', refreshCount);

document.getElementById('exportBtn').addEventListener('click', () => {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const store = result[STORAGE_KEY] || {};
    const records = Object.values(store);

    if (records.length === 0) {
      document.getElementById('status').textContent =
        'No posts captured yet — scroll through X first.';
      return;
    }

    records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const rows = records.map((r) => ({
      'Author Name': r.authorName,
      'Author Handle': r.authorHandle,
      'Posted At': r.timestamp,
      Text: r.text,
      'Media Type': r.mediaType,
      'Image Count': r.imageCount,
      'Is Repost': r.isRepost ? 'Yes' : 'No',
      'Has Quoted Post': r.hasQuoted ? 'Yes' : 'No',
      Likes: r.likeCount,
      Reposts: r.retweetCount,
      Comments: r.replyCount,
      Bookmarks: r.bookmarkCount,
      Views: r.viewCount != null ? r.viewCount : '',
      URL: r.tweetUrl,
      'First Captured': r.capturedAt,
      'Last Seen': r.lastSeenAt
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 60 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 8 },
      { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 42 }, { wch: 22 }, { wch: 22 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'X Engagement Data');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `x-engagement-report-${dateStr}.xlsx`);

    document.getElementById('status').textContent = `Exported ${rows.length} posts.`;
  });
});

document.getElementById('clearBtn').addEventListener('click', () => {
  chrome.storage.local.set({ [STORAGE_KEY]: {} }, () => {
    refreshCount();
    document.getElementById('status').textContent = 'Cleared.';
    chrome.action.setBadgeText({ text: '' });
  });
});
