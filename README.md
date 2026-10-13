# 🍳 Friends' Cookbook

A website for sharing recipes with different groups of friends. It runs entirely in the browser, with no backend, so it can be hosted on GitHub Pages.

**Live site:** https://dinahain.github.io/friends-cookbook/

## Features

- **Three tabs:** 📚 My Cookbooks (welcome page, a + button for new cookbooks and an Invite friends button), 🍽️ My Recipes (every recipe from all cookbooks, filtered by "Added by me" or favorites) and 🤖 AI Chef. On phones the tabs sit at the bottom like an app.
- **Several cookbooks**, one for each group of friends (for example "Family" and "Uni Friends"). Each cookbook shows its recipes and who added them.
- **Your name:** the site asks for your name once and puts it on the recipes you add. There are no passwords, because accounts would need a server.
- **Invite friends:** one link contains a whole cookbook. A friend opens it and gets the cookbook on their own device. If they already have a cookbook with that name, only the new recipes are added.
- **Share one recipe** with a link (including a small version of its photo) or on WhatsApp. Your friend picks which cookbook to save it to.
- **Recipe photos**, shrunk automatically so they fit in browser storage. On a phone you can take one with the camera.
- **🤖 AI Chef:** type the ingredients you have and/or upload a photo of them, and Claude suggests 3 recipes you can save to any cookbook. It also shows matching recipes from your own cookbooks, and that part works without AI.
- Search, tag filters, favorites ★, and ingredient checkboxes while cooking.

## How the AI Chef works without a server

The AI needs a Claude API key, and anything uploaded to GitHub is public, so **the key is never in the code**. Each person pastes their own key in ⚙️ settings. It is stored only in their browser and sent only to Claude. Get a key at [platform.claude.com](https://platform.claude.com/settings/keys). Using it costs a small amount per request.

## Files

| File | What it does |
|------|--------------|
| `index.html` | The page structure: home, cookbook, AI Chef and popups |
| `style.css` | The design |
| `app.js` | All the logic: cookbooks, sharing links, photos, AI Chef |
| `data.js` | The starter cookbooks and recipes |

## Run it on your computer

Double-click `index.html` and it opens in your browser.

## 90-second demo script

Before you start, have the site open, an API key saved in ⚙️ settings, and an incognito window ready.

| Time | What to show | What to say |
|------|--------------|-------------|
| 0:00–0:15 | Home page with the cookbooks | "Friends' Cookbook gives every group of friends its own cookbook. It runs entirely in the browser on GitHub Pages." |
| 0:15–0:30 | Open "Uni Friends", point at the names, search "feta" | "Each cookbook has recipes from different friends, and you can search by recipe or ingredient." |
| 0:30–0:50 | Click **Invite friends**, paste the link in the incognito window, click **Add to my cookbooks** | "There's no server, so the whole cookbook is packed into this link. My friend opens it and gets the same cookbook." |
| 0:50–1:20 | Open **AI Chef**, type "eggs, tomatoes, cheese" (or upload a photo), click **Find me recipes**, open one, **Save** | "Don't know what to cook? The AI Chef suggests recipes from what you have, and you can save one straight to a cookbook." |
| 1:20–1:30 | Show the saved recipe in the cookbook | "Cook it, love it, share it. Thank you!" |

**Tip:** The AI takes a few seconds, so keep talking while it thinks.
