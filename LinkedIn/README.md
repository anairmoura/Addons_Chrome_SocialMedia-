# LinkedIn Feed Tracker

A simple Chrome extension that collects content type + engagement stats
(likes, comments, reposts) from LinkedIn posts as you scroll through your
feed or a profile timeline, then lets you export everything to a CSV file
(opens cleanly in Excel).

No LinkedIn API, no login automation — it just reads what's already
rendered on the page in your own browser as you browse normally.

## What it collects, per post

- Author name
- Content type: `Video`, `Document`, `Image`, `Poll`, `Article/Link`, `Text`, or `Other`
- Likes / reactions count
- Comments count
- Reposts count
- Page count (for Document/carousel posts only)
- Whether the post is Promoted (sponsored) content
- A short text snippet (first ~140 characters)
- A link back to the post
- The page you were on and the timestamp it was collected

Data is deduplicated by post ID, and stored locally in the browser
(`chrome.storage.local`) — nothing is sent anywhere.

## Install it locally (takes 1 minute)

1. Unzip this folder somewhere on your computer.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped `linkedin-tracker` folder.
5. Pin the extension (puzzle-piece icon in the toolbar → pin "LinkedIn Feed Tracker").
6. Go to `linkedin.com`, open your feed or someone's profile, and scroll —
   posts get collected automatically in the background.
7. Click the extension icon anytime to see how many posts you've collected
   and hit **Export to CSV**.

## Submitting to the Chrome Web Store (optional)

If you want it installable without Developer mode:

1. Zip the contents of the `linkedin-tracker` folder (not the folder itself —
   `manifest.json` should be at the root of the zip).
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   (one-time $5 registration fee if you haven't published before).
3. Click **New Item**, upload the zip.
4. Fill in a listing (screenshots, description, privacy practices — you'll
   need to briefly disclose what data the extension reads, since it accesses
   linkedin.com pages).
5. Submit for review.

Note: publishing publicly means anyone can install it, and LinkedIn's Terms
of Service restrict automated data collection from their site — that's
worth keeping in mind, especially if you publish rather than just using it
locally for yourself.

## If LinkedIn changes its layout and collection stops working

LinkedIn updates its page markup periodically. If posts stop being
detected, open `content.js` and check the `POST_CONTAINER_SELECTORS` and
the various selectors inside `detectContentType` / `extractCounts` — these
are the parts most likely to need small updates to match LinkedIn's current
HTML structure.

## Files

- `manifest.json` – extension configuration (Manifest V3)
- `content.js` – runs on LinkedIn pages, scans posts, saves data
- `popup.html` / `popup.css` / `popup.js` – the toolbar popup (stats + export button)
- `icons/` – extension icons
