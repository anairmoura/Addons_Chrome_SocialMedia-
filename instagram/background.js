// background.js — service worker (Manifest V3)
// Guarda todos os posts capturados em chrome.storage.local, deduplicados por URL.

const STORAGE_KEY = "sct_posts_v1";

async function getAllPosts() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || [];
}

async function saveAllPosts(posts) {
  await chrome.storage.local.set({ [STORAGE_KEY]: posts });
}

async function addPost(post) {
  const posts = await getAllPosts();
  const key = post.url || `${post.platform}|${post.profile}|${post.textSnippet}|${post.dateISO}`;
  const exists = posts.some((p) => (p.url || `${p.platform}|${p.profile}|${p.textSnippet}|${p.dateISO}`) === key);
  if (exists) return { added: false, total: posts.length };
  posts.push(post);
  await saveAllPosts(posts);
  return { added: true, total: posts.length };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SCT_NEW_POST") {
    addPost(message.post).then((result) => sendResponse(result));
    return true; // resposta assíncrona
  }
  if (message?.type === "SCT_GET_ALL") {
    getAllPosts().then((posts) => sendResponse({ posts }));
    return true;
  }
  if (message?.type === "SCT_CLEAR_ALL") {
    saveAllPosts([]).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "SCT_GET_SUMMARY") {
    getAllPosts().then((posts) => {
      const byPlatformProfile = {};
      for (const p of posts) {
        const key = `${p.platform}|${p.profile}`;
        byPlatformProfile[key] = (byPlatformProfile[key] || 0) + 1;
      }
      sendResponse({ total: posts.length, byPlatformProfile });
    });
    return true;
  }
});
