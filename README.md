# 🍳 Friends' Cookbook

A website for sharing recipes with friends. It runs entirely in the browser, with no backend, so it can be hosted on GitHub Pages.

## Features

- Browse recipes as cards, search by name, ingredient or friend, and filter by tag
- Add your own recipes (saved in the browser with `localStorage`)
- Add a photo to a recipe. Photos are shrunk automatically so they fit in browser storage, and on a phone you can take one with the camera
- Mark favorites ★
- **Share a recipe with a link:** the whole recipe is encoded inside the link, so your friend can open it and save it to their own cookbook with no server needed
- Check off ingredients while cooking
- Works on phones too

## Files

| File | What it does |
|------|--------------|
| `index.html` | The page structure |
| `style.css` | The design |
| `app.js` | All the logic (search, add, favorites, share links) |
| `data.js` | The starter recipes |

## Run it on your computer

Double-click `index.html` and it opens in your browser.

## Put it on GitHub Pages

1. Sign in at [github.com](https://github.com) and click **New repository**. Name it, for example, `friends-cookbook`, make it **Public**, and click **Create repository**.
2. On the new repository page, click **uploading an existing file**. Drag in the 5 files (`index.html`, `style.css`, `app.js`, `data.js`, `README.md`) and click **Commit changes**.
3. Go to **Settings → Pages**. Under **Source**, choose **Deploy from a branch**. Pick **main** and **/(root)**, then click **Save**.
4. Wait about 1 minute and refresh. Your site's address will appear at the top, for example
   `https://YOUR-USERNAME.github.io/friends-cookbook/`

## 90-second demo script

| Time | What to show | What to say |
|------|--------------|-------------|
| 0:00–0:15 | Home page | "This is Friends' Cookbook, a place to collect and share recipes with friends. It runs 100% in the browser on GitHub Pages, with no server." |
| 0:15–0:30 | Type "eggs" in search, click the "Dessert" tag | "You can search by recipe, ingredient or friend, and filter by tags." |
| 0:30–0:50 | Click **+ Add a recipe**, fill in a short recipe you prepared earlier, then save | "Anyone can add their own recipe. It's saved in the browser." |
| 0:50–1:15 | Click **Share with a friend**, then open the link in a second browser window (e.g., incognito) and click **Save to my cookbook** | "Here's the trick: without a server, the whole recipe is packed inside the link. My friend opens it and saves it to their own cookbook." |
| 1:15–1:30 | Click a ★ favorite and show the Favorites filter | "And you can keep favorites. Thank you!" |

**Tip:** Have the recipe text ready to paste, and keep the incognito window open before you start.
