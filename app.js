// Friends' Cookbook – runs entirely in the browser.
// Recipes and favorites are stored in localStorage.
// Sharing works by packing the whole recipe into the link (#recipe=...).

const STORAGE_KEY = 'friendsCookbook.recipes';
const FAVORITES_KEY = 'friendsCookbook.favorites';
const CARD_COLORS = ['#ffe5d9', '#fff1c1', '#dff3e3', '#e0ecff', '#f3e1ff', '#ffdfe8'];
const PHOTO_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_PHOTO_LENGTH = 400000;
// Links longer than this may not fit in a chat message, so the photo is left out.
const MAX_LINK_LENGTH = 30000;

let recipes = loadRecipes();
let favorites = new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
let activeTag = 'All';
let searchText = '';
let currentRecipe = null;
let currentIsShared = false;
let pendingPhoto = '';

const grid = document.getElementById('recipe-grid');
const emptyState = document.getElementById('empty-state');
const tagFilters = document.getElementById('tag-filters');
const searchInput = document.getElementById('search');
const recipeDialog = document.getElementById('recipe-dialog');
const recipeDetail = document.getElementById('recipe-detail');
const formDialog = document.getElementById('form-dialog');
const recipeForm = document.getElementById('recipe-form');
const photoInput = recipeForm.elements.photo;
const photoPreview = document.getElementById('photo-preview');
const toast = document.getElementById('toast');

// ---------- Storage ----------

function loadRecipes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved.map(normalizeRecipe);
  } catch (e) {
    // Broken data in storage – fall back to the starter recipes.
  }
  return STARTER_RECIPES.map(normalizeRecipe);
}

// Returns false when the browser storage is full (usually because of too many photos).
function saveRecipes() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
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

// Make sure a recipe (especially one from a shared link) has the right shape.
function normalizeRecipe(raw) {
  raw = raw || {};
  const text = (value, max) => String(value ?? '').trim().slice(0, max);
  const list = (value, max) =>
    (Array.isArray(value) ? value : []).map(item => text(item, max)).filter(Boolean).slice(0, 50);
  const photo = typeof raw.photo === 'string' && raw.photo.length <= MAX_PHOTO_LENGTH &&
    PHOTO_PATTERN.test(raw.photo) ? raw.photo : '';

  return {
    id: text(raw.id, 50) || newId(),
    title: text(raw.title, 80) || 'Untitled recipe',
    author: text(raw.author, 40) || 'A friend',
    emoji: text(raw.emoji, 8) || '🍽️',
    time: Math.max(0, parseInt(raw.time, 10) || 0),
    servings: Math.max(1, parseInt(raw.servings, 10) || 1),
    tags: list(raw.tags, 20).slice(0, 5),
    ingredients: list(raw.ingredients, 200),
    steps: list(raw.steps, 500),
    photo
  };
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

function recipeImage(recipe, className) {
  return recipe.photo
    ? `<img class="${className}" src="${esc(recipe.photo)}" alt="${esc(recipe.title)}">`
    : `<div class="${className} emoji-image" style="background:${colorFor(recipe.id)}">${esc(recipe.emoji)}</div>`;
}

// Escape text before putting it into HTML (protects against malicious shared links).
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
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ---------- Share links ----------

function encodeRecipe(recipe) {
  const { id, ...data } = recipe;
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeRecipe(code) {
  let base64 = code.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Share links include a small version of the photo, as long as the link stays short enough.
async function shareLinkFor(recipe) {
  const base = location.href.split('#')[0] + '#recipe=';
  if (recipe.photo) {
    try {
      const smallPhoto = await resizeImage(recipe.photo, 320, 0.5);
      const link = base + encodeRecipe({ ...recipe, photo: smallPhoto });
      if (link.length <= MAX_LINK_LENGTH) return link;
    } catch (e) {
      // Fall through and share without the photo.
    }
  }
  return base + encodeRecipe({ ...recipe, photo: '' });
}

function checkForSharedRecipe() {
  if (!location.hash.startsWith('#recipe=')) return;
  try {
    const shared = normalizeRecipe(decodeRecipe(location.hash.slice('#recipe='.length)));
    openRecipe(shared, true);
  } catch (e) {
    showToast('Sorry, this share link is broken 😕');
    history.replaceState(null, '', location.pathname + location.search);
  }
}

// ---------- Rendering ----------

function allTags() {
  const tags = new Set();
  recipes.forEach(r => r.tags.forEach(t => tags.add(t)));
  return ['All', ...[...tags].sort(), '★ Favorites'];
}

function renderFilters() {
  const tags = allTags();
  if (!tags.includes(activeTag)) activeTag = 'All';
  tagFilters.innerHTML = tags
    .map(tag => `<button class="chip ${tag === activeTag ? 'active' : ''}" data-tag="${esc(tag)}">${esc(tag)}</button>`)
    .join('');
}

function matches(recipe) {
  if (activeTag === '★ Favorites' && !favorites.has(recipe.id)) return false;
  if (activeTag !== 'All' && activeTag !== '★ Favorites' && !recipe.tags.includes(activeTag)) return false;
  if (!searchText) return true;
  const haystack = [recipe.title, recipe.author, ...recipe.tags, ...recipe.ingredients].join(' ').toLowerCase();
  return haystack.includes(searchText);
}

function renderGrid() {
  const visible = recipes.filter(matches);
  emptyState.hidden = visible.length > 0;
  grid.innerHTML = visible
    .map(r => `
      <article class="card" data-id="${esc(r.id)}" tabindex="0">
        ${recipeImage(r, 'card-image')}
        <button class="fav-btn ${favorites.has(r.id) ? 'on' : ''}" data-fav="${esc(r.id)}"
          aria-label="Toggle favorite">${favorites.has(r.id) ? '★' : '☆'}</button>
        <div class="card-body">
          <h3>${esc(r.title)}</h3>
          <p class="meta">by ${esc(r.author)} · ⏱ ${r.time} min</p>
          <div class="tags">${r.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        </div>
      </article>`)
    .join('');
}

function render() {
  renderFilters();
  renderGrid();
}

function openRecipe(recipe, isShared = false) {
  currentRecipe = recipe;
  currentIsShared = isShared;
  const isFav = favorites.has(recipe.id);

  const actions = isShared
    ? `<button class="btn btn-primary" data-action="save">💾 Save to my cookbook</button>`
    : `<button class="btn btn-primary" data-action="share">🔗 Share with a friend</button>
       <button class="btn" data-action="fav">${isFav ? '★ Favorite' : '☆ Add to favorites'}</button>
       <button class="btn btn-danger" data-action="delete">🗑 Delete</button>`;

  recipeDetail.innerHTML = `
    ${isShared ? '<div class="shared-note">🎁 A friend shared this recipe with you!</div>' : ''}
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
        <button class="btn" data-action="copy">📋 Copy</button>
        <a class="btn btn-whatsapp" target="_blank" rel="noopener">WhatsApp</a>
      </div>
    </div>`;

  if (!recipeDialog.open) recipeDialog.showModal();
}

// ---------- Actions ----------

function toggleFavorite(id) {
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  saveFavorites();
  renderGrid();
}

async function showShareBox() {
  const link = await shareLinkFor(currentRecipe);
  const box = recipeDetail.querySelector('.share-box');
  box.hidden = false;
  box.querySelector('.share-link').value = link;
  box.querySelector('.btn-whatsapp').href =
    'https://wa.me/?text=' + encodeURIComponent(`Try my recipe "${currentRecipe.title}" 😋 ${link}`);
  copyLink(link);
}

function copyLink(link) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(
      () => showToast('Link copied! Paste it to a friend 📨'),
      () => showToast('Copy the link from the box below')
    );
  } else {
    showToast('Copy the link from the box below');
  }
}

function saveSharedRecipe() {
  const exists = recipes.some(r => r.title === currentRecipe.title && r.author === currentRecipe.author);
  if (exists) {
    showToast('This recipe is already in your cookbook');
  } else {
    const saved = { ...currentRecipe, id: newId() };
    recipes.unshift(saved);
    if (saveRecipes()) {
      render();
      showToast(`"${saved.title}" was added to your cookbook! 🎉`);
    } else {
      recipes.shift();
      showToast('Your cookbook is full. Delete some recipes with photos first.');
    }
  }
  recipeDialog.close();
}

function deleteCurrentRecipe() {
  if (!confirm(`Delete "${currentRecipe.title}"?`)) return;
  recipes = recipes.filter(r => r.id !== currentRecipe.id);
  favorites.delete(currentRecipe.id);
  saveRecipes();
  saveFavorites();
  render();
  recipeDialog.close();
  showToast('Recipe deleted');
}

function linesOf(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

// ---------- Events ----------

document.getElementById('add-btn').addEventListener('click', () => {
  recipeForm.reset();
  pendingPhoto = '';
  photoPreview.hidden = true;
  formDialog.showModal();
});

photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  pendingPhoto = '';
  photoPreview.hidden = true;
  if (!file) return;
  const url = URL.createObjectURL(file);
  try {
    pendingPhoto = await resizeImage(url, 800, 0.75);
    photoPreview.src = pendingPhoto;
    photoPreview.hidden = false;
  } catch (e) {
    photoInput.value = '';
    showToast('Sorry, that file is not a photo we can use');
  } finally {
    URL.revokeObjectURL(url);
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
  recipes.unshift(recipe);
  if (!saveRecipes()) {
    recipes.shift();
    showToast('Your cookbook is full. Delete some recipes with photos first.');
    return;
  }
  render();
  formDialog.close();
  showToast('Recipe added! 🎉');
  openRecipe(recipe);
});

searchInput.addEventListener('input', () => {
  searchText = searchInput.value.trim().toLowerCase();
  renderGrid();
});

tagFilters.addEventListener('click', event => {
  const chip = event.target.closest('[data-tag]');
  if (!chip) return;
  activeTag = chip.dataset.tag;
  render();
});

grid.addEventListener('click', event => {
  const favButton = event.target.closest('[data-fav]');
  if (favButton) {
    toggleFavorite(favButton.dataset.fav);
    return;
  }
  const card = event.target.closest('.card');
  if (card) openRecipe(recipes.find(r => r.id === card.dataset.id));
});

grid.addEventListener('keydown', event => {
  const card = event.target.closest('.card');
  if (card && event.key === 'Enter') openRecipe(recipes.find(r => r.id === card.dataset.id));
});

recipeDetail.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'share') showShareBox();
  if (action === 'copy') copyLink(recipeDetail.querySelector('.share-link').value);
  if (action === 'save') saveSharedRecipe();
  if (action === 'delete') deleteCurrentRecipe();
  if (action === 'fav') {
    toggleFavorite(currentRecipe.id);
    openRecipe(currentRecipe);
  }
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

// Remove the share link from the address bar once the shared recipe is closed.
recipeDialog.addEventListener('close', () => {
  if (currentIsShared) history.replaceState(null, '', location.pathname + location.search);
});

window.addEventListener('hashchange', checkForSharedRecipe);

render();
checkForSharedRecipe();
