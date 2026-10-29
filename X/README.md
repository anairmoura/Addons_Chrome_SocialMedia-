# X (Twitter) Engagement Tracker — Chrome Extension

Passively captures likes, comments (replies), reposts, bookmarks, views, post text,
and media type (image/video/none) for every post that renders on your screen as you
scroll X/Twitter normally. No auto-scrolling, no clicking — it just reads what's
already visible in the page. Export everything to an Excel (.xlsx) file whenever
you want.

## What it captures per post
- Author name & handle
- Posted-at timestamp
- Full text
- Media type (image / video / none) and image count
- Whether it's a repost, and whether it contains a quoted post
- Likes, reposts, comments (replies), bookmarks, views (when visible)
- Post URL
- First captured / last seen timestamps

## Install (load unpacked)
1. Unzip this folder somewhere permanent (don't delete it after installing — Chrome
   loads the extension directly from these files).
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
5. The extension icon will appear in your toolbar.

## How to use it
1. Go to `x.com` or `twitter.com` and browse/scroll normally — your home timeline,
   a profile, a search results page, etc. all work.
2. Every post that scrolls into view gets captured automatically in the background.
   Click the extension icon any time to see how many posts have been captured so far
   (shown as a badge number on the icon too).
3. When you're ready, click the extension icon and press **Export to Excel**. This
   downloads an `.xlsx` file with one row per post.
4. Use **Clear captured data** to start a fresh session.

## Notes & limitations
- Counts (likes/reposts/etc.) reflect what X displays at the moment a post is on
  screen. If a count updates later and you don't revisit that post, the export will
  show the last value seen. The extension keeps the *highest* count it has ever seen
  for a post to avoid stale rendering glitches.
- View counts aren't always shown by X for every post, so that column may be blank.
- This only reads data already rendered in your browser — it doesn't call any X
  API, doesn't auto-scroll, and doesn't interact with the page on your behalf.
- Works on the current X.com DOM structure. If X changes its page markup, the
  selectors in `content.js` may need updating.
