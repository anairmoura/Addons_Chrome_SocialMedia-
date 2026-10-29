const STORAGE_KEY = "linkedin_posts";

const countEl = document.getElementById("count");
const breakdownEl = document.getElementById("breakdown");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");

function getAllRecords(cb) {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const obj = result[STORAGE_KEY] || {};
    cb(Object.values(obj));
  });
}

function renderStats() {
  getAllRecords((records) => {
    countEl.textContent = records.length;
    exportBtn.disabled = records.length === 0;

    const byType = {};
    records.forEach((r) => {
      byType[r.type] = (byType[r.type] || 0) + 1;
    });

    breakdownEl.innerHTML = "";
    Object.keys(byType)
      .sort((a, b) => byType[b] - byType[a])
      .forEach((type) => {
        const span = document.createElement("span");
        span.textContent = `${type}: ${byType[type]}`;
        breakdownEl.appendChild(span);
      });
  });
}

function csvEscape(value) {
  const s = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(records) {
  const headers = [
    "Author",
    "Content Type",
    "Likes",
    "Comments",
    "Reposts",
    "Pages (Documents only)",
    "Is Promoted",
    "Snippet",
    "Post URL",
    "Collected From",
    "Collected At"
  ];

  const rows = records.map((r) => [
    r.author,
    r.type,
    r.likes,
    r.comments,
    r.reposts,
    r.pages === null || r.pages === undefined ? "" : r.pages,
    r.isPromoted ? "Yes" : "No",
    r.snippet,
    r.url,
    r.pageUrl,
    r.collectedAt
  ]);

  const lines = [headers, ...rows].map((row) =>
    row.map(csvEscape).join(",")
  );
  return lines.join("\r\n");
}

function exportCsv() {
  getAllRecords((records) => {
    if (records.length === 0) return;

    // Most recently collected first
    records.sort((a, b) => (a.collectedAt < b.collectedAt ? 1 : -1));

    const csv = toCsv(records);
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `linkedin_feed_export_${stamp}.csv`;

    chrome.downloads.download(
      {
        url,
        filename,
        saveAs: true
      },
      () => {
        URL.revokeObjectURL(url);
      }
    );
  });
}

function clearData() {
  if (!confirm("Clear all collected LinkedIn post data?")) return;
  chrome.storage.local.set({ [STORAGE_KEY]: {} }, renderStats);
}

exportBtn.addEventListener("click", exportCsv);
clearBtn.addEventListener("click", clearData);

document.addEventListener("DOMContentLoaded", renderStats);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) {
    renderStats();
  }
});
