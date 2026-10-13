// Friends' Cookbook – runs entirely in the browser.
// Cookbooks, favorites and your name are stored in localStorage.
// Sharing works by packing recipes into the link (#recipe=... or #cookbook=...).

const STORAGE_KEY = 'friendsCookbook.cookbooks';
const OLD_RECIPES_KEY = 'friendsCookbook.recipes';
const FAVORITES_KEY = 'friendsCookbook.favorites';
const PROFILE_KEY = 'friendsCookbook.profileName';
const API_KEY_KEY = 'friendsCookbook.claudeApiKey';

const CARD_COLORS = ['#ffe5d9', '#fff1c1', '#dff3e3', '#e0ecff', '#f3e1ff', '#ffdfe8'];
const PHOTO_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_PHOTO_LENGTH = 400000;
// Links longer than this may not fit in a chat message, so photos are left out.
const MAX_LINK_LENGTH = 30000;
const NEW_COOKBOOK = '__new__';

let cookbooks = loadCookbooks();
let favorites = new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
let profileName = localStorage.getItem(PROFILE_KEY) || '';
let currentCookbookId = null;
let currentView = 'home';
let recipesFilter = 'All';
let recipesSearch = '';
let activeTag = 'All';
let searchText = '';
let pendingPhoto = '';
let aiPhoto = '';
let aiSuggestions = [];
// What the detail popup is showing: { type: 'recipe', recipe, mode, sourceName } or { type: 'cookbook', cookbook }
let detailState = null;

const $ = id => document.getElementById(id);
const views = { home: $('home-view'), recipes: $('recipes-view'), cookbook: $('cookbook-view'), ai: $('ai-view') };
const cookbookGrid = $('cookbook-grid');
const recipeGrid = $('recipe-grid');
const emptyState = $('empty-state');
const tagFilters = $('tag-filters');
const searchInput = $('search');
const allRecipesGrid = $('all-recipes-grid');
const detailDialog = $('detail-dialog');
const detail = $('detail');
const formDialog = $('form-dialog');
const recipeForm = $('recipe-form');
const photoPreview = $('photo-preview');
const aiForm = $('ai-form');
const aiPhotoPreview = $('ai-photo-preview');
const aiStatus = $('ai-status');
const aiResults = $('ai-results');
const toast = $('toast');

// ---------- Storage ----------

function loadCookbooks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved.map(normalizeCookbook);
    // Move recipes from the older one-cookbook version of the site.
    const oldRecipes = JSON.parse(localStorage.getItem(OLD_RECIPES_KEY));
    if (Array.isArray(oldRecipes)) {
      return [normalizeCookbook({ name: 'My Friends', emoji: '📒', recipes: oldRecipes })];
    }
  } catch (e) {
    // Broken data in storage – fall back to the starter cookbooks.
  }
  return STARTER_COOKBOOKS.map(normalizeCookbook);
}

// Returns false when the browser storage is full (usually because of too many photos).
function saveCookbooks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cookbooks));
    return true;
  } catch (e) {
    return false;
  }
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
}

// ---------- Helpers ----------

function newId() {
  return 'r-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function textList(value, max) {
  return (Array.isArray(value) ? value : []).map(item => text(item, max)).filter(Boolean).slice(0, 50);
}

// Make sure a recipe (especially one from a link or the AI) has the right shape.
function normalizeRecipe(raw) {
  raw = raw || {};
  const photo = typeof raw.photo === 'string' && raw.photo.length <= MAX_PHOTO_LENGTH &&
    PHOTO_PATTERN.test(raw.photo) ? raw.photo : '';
  return {
    id: text(raw.id, 50) || newId(),
    title: text(raw.title, 80) || 'Untitled recipe',
    author: text(raw.author, 40) || 'A friend',
    emoji: text(raw.emoji, 8) || '🍽️',
    time: Math.max(0, parseInt(raw.time, 10) || 0),
    servings: Math.max(1, parseInt(raw.servings, 10) || 1),
    tags: textList(raw.tags, 20).slice(0, 5),
    ingredients: textList(raw.ingredients, 200),
    steps: textList(raw.steps, 500),
    photo
  };
}

function normalizeCookbook(raw) {
  raw = raw || {};
  return {
    id: text(raw.id, 50) || newId(),
    name: text(raw.name, 40) || 'Cookbook',
    emoji: text(raw.emoji, 12) || '📒',
    recipes: (Array.isArray(raw.recipes) ? raw.recipes : []).slice(0, 200).map(normalizeRecipe)
  };
}

// Escape text before putting it into HTML (protects against malicious links and AI output).
function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function colorFor(id) {
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return CARD_COLORS[sum % CARD_COLORS.length];
}

function showToast(message) {
  toast.textContent = message;
  // Re-open the popover so the message shows above any open dialog.
  if (toast.showPopover) {
    if (toast.matches(':popover-open')) toast.hidePopover();
    toast.showPopover();
  }
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function currentCookbook() {
  return cookbooks.find(c => c.id === currentCookbookId);
}

function findRecipe(id) {
  for (const cookbook of cookbooks) {
    const recipe = cookbook.recipes.find(r => r.id === id);
    if (recipe) return { cookbook, recipe };
  }
  return null;
}

function sameRecipe(a, b) {
  return a.title === b.title && a.author === b.author;
}

function authorsOf(cookbook) {
  return [...new Set(cookbook.recipes.map(r => r.author))];
}

function linesOf(value) {
  return value.split('\n').map(l => l.trim()).filter(Boolean);
}

// Shrink a photo so it fits in browser storage (and in share links).
function resizeImage(src, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('This file is not an image'));
    img.src = src;
  });
}

async function readPhotoFile(file, maxSize, quality) {
  const url = URL.createObjectURL(file);
  try {
    return await resizeImage(url, maxSize, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function recipeImage(recipe, className) {
  return recipe.photo
    ? `<img class="${className}" src="${esc(recipe.photo)}" alt="${esc(recipe.title)}">`
    : `<div class="${className} emoji-image" style="background:${colorFor(recipe.id)}">${esc(recipe.emoji)}</div>`;
}

function recipeCard(recipe, extraAttributes) {
  return `
    <article class="card" ${extraAttributes} tabindex="0">
      ${recipeImage(recipe, 'card-image')}
      ${recipe.id.startsWith('ai-') ? '' : `<button class="fav-btn ${favorites.has(recipe.id) ? 'on' : ''}"
        data-fav="${esc(recipe.id)}" aria-label="Toggle favorite">${favorites.has(recipe.id) ? '★' : '☆'}</button>`}
      <div class="card-body">
        <h3>${esc(recipe.title)}</h3>
        <p class="meta">by ${esc(recipe.author)} · ⏱ ${recipe.time} min</p>
        <div class="tags">${recipe.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      </div>
    </article>`;
}

function copyLink(link) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(
      () => showToast('Link copied! Paste it to a friend 📨'),
      () => showToast('Copy the link from the box')
    );
  } else {
    showToast('Copy the link from the box');
  }
}

function fillShareBox(box, link, message) {
  box.hidden = false;
  box.querySelector('.share-link').value = link;
  box.querySelector('.btn-whatsapp').href = 'https://wa.me/?text=' + encodeURIComponent(`${message} ${link}`);
  copyLink(link);
}

// ---------- Share links ----------

function encodeData(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeData(code) {
  let base64 = code.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function baseUrl() {
  return location.href.split('#')[0];
}

// Recipe links include a small version of the photo, as long as the link stays short enough.
async function recipeLinkFor(recipe, cookbookName) {
  const { id, ...data } = recipe;
  const base = baseUrl() + '#recipe=';
  if (recipe.photo) {
    try {
      const smallPhoto = await resizeImage(recipe.photo, 320, 0.5);
      const link = base + encodeData({ ...data, photo: smallPhoto, cookbook: cookbookName });
      if (link.length <= MAX_LINK_LENGTH) return link;
    } catch (e) {
      // Fall through and share without the photo.
    }
  }
  return base + encodeData({ ...data, photo: '', cookbook: cookbookName });
}

// Cookbook links leave photos out so the whole cookbook fits in one link.
function cookbookLinkFor(cookbook) {
  const recipes = cookbook.recipes.map(({ id, photo, ...rest }) => rest);
  return baseUrl() + '#cookbook=' + encodeData({ name: cookbook.name, emoji: cookbook.emoji, recipes });
}

function clearHash() {
  history.replaceState(null, '', location.pathname + location.search);
}

function checkForSharedLink() {
  const hash = location.hash;
  try {
    if (hash.startsWith('#recipe=')) {
      const data = decodeData(hash.slice('#recipe='.length));
      openRecipe(normalizeRecipe({ ...data, id: newId() }), 'shared', text(data.cookbook, 40));
    } else if (hash.startsWith('#cookbook=')) {
      openSharedCookbook(normalizeCookbook(decodeData(hash.slice('#cookbook='.length))));
    }
  } catch (e) {
    showToast('Sorry, this link is broken 😕');
    clearHash();
  }
}

// ---------- Navigation ----------

function showView(name) {
  currentView = name;
  Object.entries(views).forEach(([key, el]) => (el.hidden = key !== name));
  // A single cookbook belongs to the "My Cookbooks" tab.
  const tab = name === 'cookbook' ? 'home' : name;
  document.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  window.scrollTo(0, 0);
}

// Re-draw whatever is on screen after something changes.
function refreshCurrentView() {
  if (currentView === 'home') renderHome();
  if (currentView === 'recipes') renderMyRecipes();
  if (currentView === 'cookbook') renderCookbook();
}

function openTab(tab) {
  if (tab === 'home') goHome();
  if (tab === 'recipes') openMyRecipes();
  if (tab === 'ai') openAiChef();
}

function openMyRecipes() {
  currentCookbookId = null;
  renderMyRecipes();
  showView('recipes');
}

function goHome() {
  currentCookbookId = null;
  renderHome();
  showView('home');
}

function openCookbook(id) {
  currentCookbookId = id;
  activeTag = 'All';
  searchText = '';
  searchInput.value = '';
  renderCookbook();
  showView('cookbook');
}

function openAiChef() {
  renderAiSettingsHint();
  showView('ai');
}

// ---------- Rendering: home ----------

function avatar(name) {
  const initial = [...name][0] || '?';
  return `<span class="avatar" style="background:${colorFor(name)}" title="${esc(name)}">${esc(initial.toUpperCase())}</span>`;
}

function avatarRow(names, max = 4) {
  const extra = names.length > max ? `<span class="avatar avatar-more">+${names.length - max}</span>` : '';
  return names.slice(0, max).map(avatar).join('') + extra;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function renderHome() {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  $('greeting').textContent = `${timeOfDay}${profileName ? ', ' + profileName : ''} 👋`;

  const recipeCount = cookbooks.reduce((sum, c) => sum + c.recipes.length, 0);
  const friends = new Set(cookbooks.flatMap(authorsOf));
  $('hero-stats').innerHTML = `
    <span>📚 ${plural(cookbooks.length, 'cookbook')}</span>
    <span>🍽️ ${plural(recipeCount, 'recipe')}</span>
    <span>👥 ${plural(friends.size, 'friend')}</span>`;

  const cards = cookbooks.map(c => {
    const authors = authorsOf(c);
    return `
      <article class="card cookbook-card" data-cookbook="${esc(c.id)}" tabindex="0">
        <div class="cookbook-cover" style="background:${colorFor(c.id)}">
          <span class="cookbook-emoji">${esc(c.emoji)}</span>
          <div class="cover-dishes">${c.recipes.slice(0, 5).map(r => `<span>${esc(r.emoji)}</span>`).join('')}</div>
        </div>
        <div class="card-body">
          <h3>${esc(c.name)}</h3>
          <p class="meta">${plural(c.recipes.length, 'recipe')}</p>
          <div class="avatars">${authors.length ? avatarRow(authors) : '<span class="meta small">No recipes yet</span>'}</div>
        </div>
      </article>`;
  });
  cards.push(`
    <article class="card new-card" data-new-cookbook tabindex="0">
      <span class="new-card-plus">+</span>
      <h3>New cookbook</h3>
      <p class="meta">For family, roommates, the team...</p>
    </article>`);
  cookbookGrid.innerHTML = cards.join('');
}

function renderProfile() {
  $('profile-name').textContent = profileName || 'Set your name';
  const profileAvatar = $('profile-avatar');
  profileAvatar.textContent = profileName ? [...profileName][0].toUpperCase() : '?';
  profileAvatar.style.background = profileName ? colorFor(profileName) : '';
  if (currentView === 'home') renderHome();
}

// ---------- Rendering: all recipes ----------

function renderMyRecipes() {
  const filters = ['All', 'Added by me', '★ Favorites'];
  $('recipes-filters').innerHTML = filters
    .map(f => `<button class="chip ${f === recipesFilter ? 'active' : ''}" data-filter="${esc(f)}">${esc(f)}</button>`)
    .join('');

  const items = [];
  cookbooks.forEach(cookbook => cookbook.recipes.forEach(recipe => {
    if (recipesFilter === 'Added by me' && recipe.author !== profileName) return;
    if (recipesFilter === '★ Favorites' && !favorites.has(recipe.id)) return;
    const haystack = [recipe.title, recipe.author, cookbook.name, ...recipe.tags, ...recipe.ingredients].join(' ').toLowerCase();
    if (recipesSearch && !haystack.includes(recipesSearch)) return;
    items.push({ recipe, cookbook });
  }));

  $('recipes-empty').hidden = items.length > 0;
  $('recipes-empty').textContent = recipesFilter === 'Added by me' && !recipesSearch
    ? '🥄 You haven\'t added any recipes yet. Open a cookbook and click "Add a recipe"!'
    : '🥄 No recipes found.';
  allRecipesGrid.innerHTML = items.map(({ recipe, cookbook }) =>
    recipeCard(recipe, `data-id="${esc(recipe.id)}"`)
      .replace('</h3>', `</h3><p class="cookbook-badge">${esc(cookbook.emoji)} ${esc(cookbook.name)}</p>`)).join('');
}

// ---------- Invite friends ----------

function openInvite(cookbookId) {
  detailState = { type: 'invite' };
  const cookbook = cookbooks.find(c => c.id === cookbookId);
  if (!cookbook) {
    detail.innerHTML = `
      <h2>👥 Invite friends</h2>
      <p class="meta">Which cookbook do you want to share?</p>
      <div class="invite-picker">
        ${cookbooks.map(c => `
          <button class="invite-option" data-invite="${esc(c.id)}">
            <span class="invite-emoji" style="background:${colorFor(c.id)}">${esc(c.emoji)}</span>
            <span><strong>${esc(c.name)}</strong><br><span class="meta small">${plural(c.recipes.length, 'recipe')}</span></span>
          </button>`).join('')}
      </div>`;
  } else {
    const link = cookbookLinkFor(cookbook);
    const tooBig = link.length > MAX_LINK_LENGTH;
    detail.innerHTML = `
      <div class="invite-header">
        <span class="invite-emoji big" style="background:${colorFor(cookbook.id)}">${esc(cookbook.emoji)}</span>
        <div>
          <h2>Invite friends to “${esc(cookbook.name)}”</h2>
          <p class="meta">${tooBig
            ? 'This cookbook is too big for one link. Share recipes one by one instead.'
            : 'Send this link to your friends. They\'ll get a copy of this cookbook with all its recipes (without photos).'}</p>
        </div>
      </div>
      <div class="share-box" hidden>
        <div class="share-row">
          <input class="share-link" readonly>
          <button class="btn" data-copy>📋 Copy</button>
          <a class="btn btn-whatsapp" target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>`;
    if (!tooBig) fillShareBox(detail.querySelector('.share-box'), link, `Join my cookbook "${cookbook.name}" 🍳`);
  }
  if (!detailDialog.open) detailDialog.showModal();
}

function openNewCookbook() {
  $('cookbook-form').reset();
  $('cookbook-dialog').showModal();
}

// ---------- Rendering: one cookbook ----------

function allTags(cookbook) {
  const tags = new Set();
  cookbook.recipes.forEach(r => r.tags.forEach(t => tags.add(t)));
  return ['All', ...[...tags].sort(), '★ Favorites'];
}

function matches(recipe) {
  if (activeTag === '★ Favorites' && !favorites.has(recipe.id)) return false;
  if (activeTag !== 'All' && activeTag !== '★ Favorites' && !recipe.tags.includes(activeTag)) return false;
  if (!searchText) return true;
  const haystack = [recipe.title, recipe.author, ...recipe.tags, ...recipe.ingredients].join(' ').toLowerCase();
  return haystack.includes(searchText);
}

function renderCookbook() {
  const cookbook = currentCookbook();
  if (!cookbook) return goHome();
  $('cookbook-title').textContent = `${cookbook.emoji} ${cookbook.name}`;
  const authors = authorsOf(cookbook);
  $('cookbook-banner').style.background = colorFor(cookbook.id);
  $('cookbook-members').innerHTML = authors.length
    ? `${avatarRow(authors, 6)} <span class="meta small">Recipes from ${esc(authors.join(', '))}</span>`
    : '<span class="meta small">No recipes yet. Add the first one!</span>';

  const tags = allTags(cookbook);
  if (!tags.includes(activeTag)) activeTag = 'All';
  tagFilters.innerHTML = tags
    .map(tag => `<button class="chip ${tag === activeTag ? 'active' : ''}" data-tag="${esc(tag)}">${esc(tag)}</button>`)
    .join('');

  renderRecipeGrid();
}

function renderRecipeGrid() {
  const visible = currentCookbook().recipes.filter(matches);
  emptyState.hidden = visible.length > 0;
  recipeGrid.innerHTML = visible.map(r => recipeCard(r, `data-id="${esc(r.id)}"`)).join('');
}

// ---------- Detail popup ----------

function cookbookPicker(suggestedName) {
  const match = cookbooks.find(c => c.name.toLowerCase() === (suggestedName || '').toLowerCase());
  const options = cookbooks.map(c =>
    `<option value="${esc(c.id)}" ${match && match.id === c.id ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`);
  if (suggestedName && !match) {
    options.unshift(`<option value="${NEW_COOKBOOK}" selected>+ New cookbook: ${esc(suggestedName)}</option>`);
  } else if (!cookbooks.length) {
    options.push(`<option value="${NEW_COOKBOOK}">+ New cookbook: My Recipes</option>`);
  }
  return `<select class="cookbook-select" aria-label="Choose a cookbook">${options.join('')}</select>`;
}

// mode: 'own' (in one of your cookbooks), 'shared' (from a friend's link) or 'ai' (an AI Chef idea)
function openRecipe(recipe, mode = 'own', sourceName = '') {
  detailState = { type: 'recipe', recipe, mode, sourceName };
  const isFav = favorites.has(recipe.id);

  let banner = '';
  if (mode === 'shared') {
    banner = `<div class="shared-note">🎁 A friend shared this recipe with you${sourceName ? ` from “${esc(sourceName)}”` : ''}!</div>`;
  }

  const actions = mode === 'own'
    ? `<button class="btn btn-primary" data-action="share">🔗 Share with a friend</button>
       <button class="btn" data-action="fav">${isFav ? '★ Favorite' : '☆ Add to favorites'}</button>
       <button class="btn btn-danger" data-action="delete">🗑 Delete</button>`
    : `<span class="save-label">Save to</span> ${cookbookPicker(sourceName)}
       <button class="btn btn-primary" data-action="save">💾 Save</button>`;

  detail.innerHTML = `
    ${banner}
    ${recipeImage(recipe, 'detail-image')}
    <h2>${esc(recipe.title)}</h2>
    <p class="meta">by ${esc(recipe.author)} · ⏱ ${recipe.time} min · 🍽 ${recipe.servings} servings</p>
    <div class="tags">${recipe.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    <div class="detail-columns">
      <section>
        <h3>Ingredients</h3>
        <ul class="ingredients">
          ${recipe.ingredients.map(i => `<li><label><input type="checkbox"> <span>${esc(i)}</span></label></li>`).join('')}
        </ul>
      </section>
      <section>
        <h3>Steps</h3>
        <ol class="steps">${recipe.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      </section>
    </div>
    <div class="detail-actions">${actions}</div>
    <div class="share-box" hidden>
      <p>Send this link to a friend. The whole recipe is inside it!</p>
      <div class="share-row">
        <input class="share-link" readonly>
        <button class="btn" data-copy>📋 Copy</button>
        <a class="btn btn-whatsapp" target="_blank" rel="noopener">WhatsApp</a>
      </div>
    </div>`;

  if (!detailDialog.open) detailDialog.showModal();
}

function openSharedCookbook(cookbook) {
  detailState = { type: 'cookbook', cookbook };
  const authors = authorsOf(cookbook);
  detail.innerHTML = `
    <div class="shared-note">🎉 You're invited to a cookbook!</div>
    <div class="detail-image emoji-image" style="background:${colorFor(cookbook.name)}">${esc(cookbook.emoji)}</div>
    <h2>${esc(cookbook.name)}</h2>
    <p class="meta">${cookbook.recipes.length} recipes${authors.length ? ` from ${esc(authors.join(', '))}` : ''}</p>
    <ul class="invite-list">
      ${cookbook.recipes.map(r => `<li>${esc(r.emoji)} ${esc(r.title)} <span class="meta">by ${esc(r.author)}</span></li>`).join('')}
    </ul>
    <div class="detail-actions">
      <button class="btn btn-primary" data-action="join">📥 Add to my cookbooks</button>
    </div>`;
  if (!detailDialog.open) detailDialog.showModal();
}

// ---------- Actions ----------

function toggleFavorite(id) {
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  saveFavorites();
  refreshCurrentView();
}

function createCookbook(name, emoji) {
  const cookbook = normalizeCookbook({ name, emoji, recipes: [] });
  cookbooks.push(cookbook);
  return cookbook;
}

// Save a shared or AI recipe into the cookbook picked in the popup.
function saveRecipeFromDetail() {
  const { recipe, sourceName } = detailState;
  const choice = detail.querySelector('.cookbook-select').value;
  let cookbook = cookbooks.find(c => c.id === choice);
  let created = false;
  if (!cookbook) {
    cookbook = createCookbook(sourceName || 'My Recipes', '📒');
    created = true;
  }
  if (cookbook.recipes.some(r => sameRecipe(r, recipe))) {
    showToast(`This recipe is already in “${cookbook.name}”`);
    return;
  }
  cookbook.recipes.unshift({ ...recipe, id: newId() });
  if (!saveCookbooks()) {
    cookbook.recipes.shift();
    if (created) cookbooks.pop();
    showToast('Your storage is full. Delete some recipes with photos first.');
    return;
  }
  detailDialog.close();
  showToast(`Saved to “${cookbook.name}”! 🎉`);
  openCookbook(cookbook.id);
}

// Add a shared cookbook. If you already have one with the same name, only new recipes are added.
function joinSharedCookbook() {
  const shared = detailState.cookbook;
  let cookbook = cookbooks.find(c => c.name.toLowerCase() === shared.name.toLowerCase());
  let added = 0;
  if (!cookbook) {
    cookbook = createCookbook(shared.name, shared.emoji);
  }
  shared.recipes.forEach(recipe => {
    if (!cookbook.recipes.some(r => sameRecipe(r, recipe))) {
      cookbook.recipes.push({ ...recipe, id: newId() });
      added++;
    }
  });
  saveCookbooks();
  detailDialog.close();
  showToast(added ? `Added ${added} recipe${added === 1 ? '' : 's'} to “${cookbook.name}” 🎉` : `You already have all of these recipes`);
  openCookbook(cookbook.id);
}

function deleteCurrentRecipe() {
  const found = findRecipe(detailState.recipe.id);
  if (!found || !confirm(`Delete "${found.recipe.title}"?`)) return;
  found.cookbook.recipes = found.cookbook.recipes.filter(r => r.id !== found.recipe.id);
  favorites.delete(found.recipe.id);
  saveCookbooks();
  saveFavorites();
  if (currentView !== 'ai') refreshCurrentView();
  else aiResults.querySelector(`[data-id="${CSS.escape(found.recipe.id)}"]`)?.remove();
  detailDialog.close();
  showToast('Recipe deleted');
}

async function shareCurrentRecipe() {
  const found = findRecipe(detailState.recipe.id);
  const link = await recipeLinkFor(detailState.recipe, found ? found.cookbook.name : '');
  fillShareBox(detail.querySelector('.share-box'), link, `Try my recipe "${detailState.recipe.title}" 😋`);
}

// ---------- AI Chef ----------

const AI_SYSTEM_PROMPT = `You are the AI Chef on a recipe-sharing website for friends.
The user tells you which ingredients they have, by typing them, by sending a photo, or both.
First identify the ingredients (read the photo carefully if there is one). Then suggest 3 different recipes
that mainly use those ingredients. You may assume basic pantry items (salt, pepper, oil, water, sugar, flour, spices).
List anything else the recipe needs in missing_ingredients. Write in simple English for home cooks.
Each ingredient line includes a quantity. Keep steps short and clear, 3 to 8 steps.
Use a single food emoji for "emoji" and 1 to 3 short tags such as "Dinner", "Quick" or "Vegetarian".
If the photo does not show food, ignore it and use the typed ingredients only.`;

const AI_SCHEMA = {
  type: 'object',
  properties: {
    recognized_ingredients: { type: 'array', items: { type: 'string' } },
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          emoji: { type: 'string' },
          time: { type: 'integer' },
          servings: { type: 'integer' },
          tags: { type: 'array', items: { type: 'string' } },
          ingredients: { type: 'array', items: { type: 'string' } },
          steps: { type: 'array', items: { type: 'string' } },
          missing_ingredients: { type: 'array', items: { type: 'string' } }
        },
        required: ['title', 'emoji', 'time', 'servings', 'tags', 'ingredients', 'steps', 'missing_ingredients'],
        additionalProperties: false
      }
    }
  },
  required: ['recognized_ingredients', 'recipes'],
  additionalProperties: false
};

function getApiKey() {
  return localStorage.getItem(API_KEY_KEY) || '';
}

function renderAiSettingsHint() {
  if (getApiKey()) {
    aiStatus.hidden = true;
  } else {
    setAiStatus('💡 Without an API key, the AI Chef only searches your cookbooks. Add a key in ⚙️ settings to get new AI recipe ideas.');
  }
}

function setAiStatus(message, isError = false) {
  aiStatus.hidden = false;
  aiStatus.textContent = message;
  aiStatus.classList.toggle('error', isError);
}

// Find recipes in your cookbooks that use the typed ingredients (works without AI).
function matchingRecipes(ingredientWords) {
  const results = [];
  cookbooks.forEach(cookbook => cookbook.recipes.forEach(recipe => {
    const ingredientsText = recipe.ingredients.join(' ').toLowerCase();
    const used = ingredientWords.filter(word => ingredientsText.includes(word));
    if (used.length) results.push({ recipe, cookbook, used });
  }));
  return results.sort((a, b) => b.used.length - a.used.length).slice(0, 6);
}

async function askAiChef(ingredientsText, photo) {
  const { default: Anthropic } = await import('https://esm.sh/@anthropic-ai/sdk@0.133.0');
  // The key belongs to the person using the site and stays in their browser.
  const client = new Anthropic({ apiKey: getApiKey(), dangerouslyAllowBrowser: true });

  const content = [];
  if (photo) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo.split(',')[1] } });
  }
  content.push({
    type: 'text',
    text: ingredientsText
      ? `These are the ingredients I have: ${ingredientsText}`
      : 'Here is a photo of the ingredients I have.'
  });

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Low effort keeps the answer fast enough for a live demo.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: AI_SCHEMA } },
      system: AI_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }]
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('The AI Chef could not help with this request. Try different ingredients.');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error('The AI Chef\'s answer was cut off. Please try again.');
    }
    // If a fallback model took over, its answer comes after the last "fallback" block.
    const lastFallback = response.content.map(b => b.type).lastIndexOf('fallback');
    const answer = response.content.slice(lastFallback + 1)
      .filter(b => b.type === 'text').map(b => b.text).join('');
    return JSON.parse(answer);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new Error('Your API key was not accepted. Check it in ⚙️ settings.');
    } else if (error instanceof Anthropic.RateLimitError) {
      throw new Error('Too many requests right now. Wait a minute and try again.');
    } else if (error instanceof Anthropic.APIConnectionError) {
      throw new Error('Could not reach the AI. Check your internet connection.');
    } else if (error instanceof Anthropic.APIError) {
      throw new Error(`The AI service returned an error (${error.status}). Please try again.`);
    }
    throw error;
  }
}

function renderAiResults(fromCookbooks, aiData) {
  let html = '';
  if (aiData) {
    aiSuggestions = aiData.recipes.slice(0, 3).map((r, i) => ({
      recipe: normalizeRecipe({ ...r, id: `ai-${Date.now()}-${i}`, author: 'AI Chef 🤖' }),
      missing: textList(r.missing_ingredients, 60)
    }));
    const seen = textList(aiData.recognized_ingredients, 60);
    html += `<h3>✨ AI recipe ideas</h3>`;
    if (seen.length) html += `<p class="meta">I found: ${esc(seen.join(', '))}</p>`;
    html += `<div class="grid">${aiSuggestions.map((s, i) => recipeCard(s.recipe, `data-ai="${i}"`)
      .replace('</h3>', `</h3>${s.missing.length ? `<p class="meta small">🛒 You'll also need: ${esc(s.missing.join(', '))}</p>` : ''}`)).join('')}</div>`;
  }
  if (fromCookbooks.length) {
    html += `<h3>📒 From your cookbooks</h3>
      <div class="grid">${fromCookbooks.map(m => recipeCard(m.recipe, `data-id="${esc(m.recipe.id)}"`)
        .replace('</h3>', `</h3><p class="meta small">Uses: ${esc(m.used.join(', '))} · in ${esc(m.cookbook.name)}</p>`)).join('')}</div>`;
  }
  aiResults.innerHTML = html;
}

async function handleAiSubmit(event) {
  event.preventDefault();
  const typed = aiForm.elements.ingredients.value.trim();
  if (!typed && !aiPhoto) {
    setAiStatus('Type some ingredients or add a photo first 🙂', true);
    return;
  }
  const words = typed.toLowerCase().split(/[,\n]+/).map(w => w.trim()).filter(Boolean);
  const fromCookbooks = matchingRecipes(words);
  aiResults.innerHTML = '';

  if (!getApiKey()) {
    renderAiResults(fromCookbooks, null);
    setAiStatus(fromCookbooks.length
      ? '💡 These recipes from your cookbooks use your ingredients. Add an API key in ⚙️ settings for new AI ideas.'
      : '😕 No matching recipes in your cookbooks. Add an API key in ⚙️ settings to get AI ideas.');
    return;
  }

  const button = aiForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setAiStatus('👩‍🍳 The AI Chef is thinking...');
  try {
    const aiData = await askAiChef(typed, aiPhoto);
    renderAiResults(fromCookbooks, aiData);
    aiStatus.hidden = true;
  } catch (error) {
    renderAiResults(fromCookbooks, null);
    setAiStatus(error.message || 'Something went wrong. Please try again.', true);
  } finally {
    button.disabled = false;
  }
}

// ---------- Events ----------

$('home-link').addEventListener('click', goHome);
document.querySelectorAll('[data-go-home]').forEach(b => b.addEventListener('click', goHome));

document.querySelectorAll('[data-tab]').forEach(tab =>
  tab.addEventListener('click', () => openTab(tab.dataset.tab)));

function handleHomeOpen(target) {
  const card = target.closest('[data-cookbook], [data-new-cookbook]');
  if (!card) return;
  if (card.dataset.cookbook) openCookbook(card.dataset.cookbook);
  else openNewCookbook();
}
cookbookGrid.addEventListener('click', event => handleHomeOpen(event.target));
cookbookGrid.addEventListener('keydown', event => {
  if (event.key === 'Enter') handleHomeOpen(event.target);
});

$('new-cookbook-btn').addEventListener('click', openNewCookbook);
$('hero-ai-btn').addEventListener('click', openAiChef);
$('hero-invite-btn').addEventListener('click', () => {
  if (!cookbooks.length) return openNewCookbook();
  openInvite(cookbooks.length === 1 ? cookbooks[0].id : null);
});

$('recipes-filters').addEventListener('click', event => {
  const chip = event.target.closest('[data-filter]');
  if (!chip) return;
  recipesFilter = chip.dataset.filter;
  renderMyRecipes();
});
$('recipes-search').addEventListener('input', event => {
  recipesSearch = event.target.value.trim().toLowerCase();
  renderMyRecipes();
});

$('cookbook-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.target);
  const cookbook = createCookbook(data.get('name'), data.get('emoji'));
  saveCookbooks();
  $('cookbook-dialog').close();
  showToast(`“${cookbook.name}” created! Add a recipe or invite friends.`);
  openCookbook(cookbook.id);
});

$('delete-cookbook-btn').addEventListener('click', () => {
  const cookbook = currentCookbook();
  if (!confirm(`Delete the whole cookbook "${cookbook.name}" and its ${cookbook.recipes.length} recipes?`)) return;
  cookbooks = cookbooks.filter(c => c.id !== cookbook.id);
  saveCookbooks();
  showToast('Cookbook deleted');
  goHome();
});

$('invite-btn').addEventListener('click', () => openInvite(currentCookbookId));

$('add-btn').addEventListener('click', () => {
  recipeForm.reset();
  recipeForm.elements.author.value = profileName;
  pendingPhoto = '';
  photoPreview.hidden = true;
  formDialog.showModal();
});

recipeForm.elements.photo.addEventListener('change', async () => {
  const file = recipeForm.elements.photo.files[0];
  pendingPhoto = '';
  photoPreview.hidden = true;
  if (!file) return;
  try {
    pendingPhoto = await readPhotoFile(file, 800, 0.75);
    photoPreview.src = pendingPhoto;
    photoPreview.hidden = false;
  } catch (e) {
    recipeForm.elements.photo.value = '';
    showToast('Sorry, that file is not a photo we can use');
  }
});

recipeForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(recipeForm);
  const recipe = normalizeRecipe({
    id: newId(),
    title: data.get('title'),
    author: data.get('author'),
    emoji: data.get('emoji'),
    time: data.get('time'),
    servings: data.get('servings'),
    tags: data.get('tags').split(',').map(t => t.trim()).filter(Boolean)
      .map(t => t[0].toUpperCase() + t.slice(1)),
    ingredients: linesOf(data.get('ingredients')),
    steps: linesOf(data.get('steps')),
    photo: pendingPhoto
  });
  const cookbook = currentCookbook();
  cookbook.recipes.unshift(recipe);
  if (!saveCookbooks()) {
    cookbook.recipes.shift();
    showToast('Your storage is full. Delete some recipes with photos first.');
    return;
  }
  renderCookbook();
  formDialog.close();
  showToast('Recipe added! 🎉');
  openRecipe(recipe);
});

searchInput.addEventListener('input', () => {
  searchText = searchInput.value.trim().toLowerCase();
  renderRecipeGrid();
});

tagFilters.addEventListener('click', event => {
  const chip = event.target.closest('[data-tag]');
  if (!chip) return;
  activeTag = chip.dataset.tag;
  renderCookbook();
});

// Recipe cards appear in a cookbook and in the AI Chef results.
function handleRecipeCardClick(event) {
  const favButton = event.target.closest('[data-fav]');
  if (favButton) {
    toggleFavorite(favButton.dataset.fav);
    return;
  }
  const card = event.target.closest('.card');
  if (!card) return;
  if (card.dataset.ai !== undefined) {
    openRecipe(aiSuggestions[card.dataset.ai].recipe, 'ai');
  } else {
    const found = findRecipe(card.dataset.id);
    if (found) openRecipe(found.recipe);
  }
}
[recipeGrid, allRecipesGrid, aiResults].forEach(container => {
  container.addEventListener('click', handleRecipeCardClick);
  container.addEventListener('keydown', event => {
    if (event.key === 'Enter') handleRecipeCardClick(event);
  });
});

detail.addEventListener('click', event => {
  const copyButton = event.target.closest('[data-copy]');
  if (copyButton) return copyLink(detail.querySelector('.share-link').value);
  const inviteOption = event.target.closest('[data-invite]');
  if (inviteOption) return openInvite(inviteOption.dataset.invite);
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'share') shareCurrentRecipe();
  if (action === 'save') saveRecipeFromDetail();
  if (action === 'join') joinSharedCookbook();
  if (action === 'delete') deleteCurrentRecipe();
  if (action === 'fav') {
    toggleFavorite(detailState.recipe.id);
    openRecipe(detailState.recipe);
  }
});


// AI Chef form
aiForm.addEventListener('submit', handleAiSubmit);
aiForm.elements.photo.addEventListener('change', async () => {
  const file = aiForm.elements.photo.files[0];
  aiPhoto = '';
  aiPhotoPreview.hidden = true;
  if (!file) return;
  try {
    aiPhoto = await readPhotoFile(file, 1024, 0.8);
    aiPhotoPreview.src = aiPhoto;
    aiPhotoPreview.hidden = false;
  } catch (e) {
    aiForm.elements.photo.value = '';
    showToast('Sorry, that file is not a photo we can use');
  }
});

// Your name
$('profile-btn').addEventListener('click', () => {
  $('profile-form').elements.name.value = profileName;
  $('profile-dialog').showModal();
});
$('profile-form').addEventListener('submit', event => {
  event.preventDefault();
  profileName = text(event.target.elements.name.value, 40);
  localStorage.setItem(PROFILE_KEY, profileName);
  renderProfile();
  $('profile-dialog').close();
  showToast(`Nice to meet you, ${profileName}! 👋`);
});

// AI settings
$('settings-btn').addEventListener('click', () => {
  $('settings-form').elements.apiKey.value = getApiKey();
  $('settings-dialog').showModal();
});
$('settings-form').addEventListener('submit', event => {
  event.preventDefault();
  const key = event.target.elements.apiKey.value.trim();
  if (key) localStorage.setItem(API_KEY_KEY, key);
  else localStorage.removeItem(API_KEY_KEY);
  $('settings-dialog').close();
  renderAiSettingsHint();
  showToast(key ? 'API key saved in this browser 🔑' : 'API key removed');
});
$('remove-key-btn').addEventListener('click', () => {
  localStorage.removeItem(API_KEY_KEY);
  $('settings-dialog').close();
  renderAiSettingsHint();
  showToast('API key removed');
});

// Close buttons and clicking the dark background close dialogs.
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => {
    if (event.target.closest('[data-close]')) return dialog.close();
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const outside = event.clientX < box.left || event.clientX > box.right ||
      event.clientY < box.top || event.clientY > box.bottom;
    if (outside) dialog.close();
  });
});

// Remove a share link from the address bar once it has been handled.
detailDialog.addEventListener('close', () => {
  if (location.hash) clearHash();
});

window.addEventListener('hashchange', checkForSharedLink);

renderProfile();
goHome();
if (location.hash) {
  checkForSharedLink();
} else if (!profileName) {
  $('profile-dialog').showModal();
}
