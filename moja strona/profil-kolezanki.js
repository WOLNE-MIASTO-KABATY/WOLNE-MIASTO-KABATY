/**
 * DyskiHub.pl — Profil koleżanki (galeria + odblokowania zdjęć)
 */

const PHOTO_UNLOCK_API = '/.netlify/functions/photo-unlock';
const SUPERFAN_API = '/.netlify/functions/superfan';
const PHOTO_UNLOCK_COST = 20;
const PHOTO_MAX_INDEX = 20;
const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

const FALLBACK_PROFILES = [
  { id: 1, imie: 'Paulincie', wiek: 18, miasto: 'WARSZAWA', bio: 'Tak jestem altką' },
  { id: 2, imie: 'Wikaa_', wiek: 19, miasto: 'KRAKÓW', bio: 'Hejka;) Zapraszam.' },
  { id: 3, imie: 'Monikapv', wiek: 18, miasto: 'WROCŁAW', bio: 'Co tam u ciebie;)' },
  { id: 4, imie: 'Weronikaaa', wiek: 19, miasto: 'WARSZAWA', bio: 'pvvvvv' },
  { id: 5, imie: 'Oliwia<3', wiek: 19, miasto: 'WARSZAWA', bio: 'Cała twoja❤️' },
  { id: 6, imie: 'Karolcia09_', wiek: 20, miasto: 'GDAŃSK', bio: 'Aktywna teraz, napisz do mnie.' },
  { id: 7, imie: 'Zuzaa08', wiek: 18, miasto: 'POZNAŃ', bio: 'Hejj pvvv' },
  { id: 8, imie: 'Zosia_08', wiek: 20, miasto: 'ŁÓDŹ', bio: 'Hejka jestem alternatywką i chce się poznać' },
  { id: 9, imie: 'Majaa.', wiek: 19, miasto: 'SOPOT', bio: 'Ktoś coś?' },
  { id: 10, imie: 'Domi_nika', wiek: 20, miasto: 'KRAKÓW', bio: 'Zapraszam na pv❤️❤️' },
];

const state = {
  profileId: null,
  profile: null,
  photos: [],
  unlocked: new Set(),
  loadingUnlock: new Set(),
  isSuperFan: false,
  purchasingSuperFan: false,
};

function isSuperFanActive() {
  return state.isSuperFan || (typeof window.isSuperFanForProfile === 'function' && window.isSuperFanForProfile(state.profileId));
}

function parseProfileIdFromUrl() {
  const id = Number(new URLSearchParams(window.location.search).get('id'));
  if (!Number.isFinite(id) || id < 1) return null;
  return Math.floor(id);
}

function isLoggedIn() {
  return Boolean(window.DyskiAuth?.getAccessToken?.());
}

function getAvatarForProfile(id) {
  if (typeof window.getProfileAvatarPath === 'function') {
    return window.getProfileAvatarPath(id);
  }
  return 'images/profiles/natalia.png';
}

async function loadProfiles() {
  try {
    const res = await fetch('data/kolezanki.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error('empty');
    return data;
  } catch {
    return FALLBACK_PROFILES;
  }
}

function imageExists(src) {
  return new Promise((resolve) => {
    const img = new Image();
    const timeout = setTimeout(() => resolve(false), 2500);
    img.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
    img.src = src;
  });
}

function buildPhotoCandidates(profileId) {
  const items = [];
  for (let i = 1; i <= PHOTO_MAX_INDEX; i += 1) {
    PHOTO_EXTENSIONS.forEach((ext, extIndex) => {
      items.push({
        key: `${i}.${ext}`,
        src: `images/kolezanki/${profileId}/${i}.${ext}`,
        order: i * 10 + extIndex,
      });
    });
  }
  return items;
}

async function discoverProfilePhotos(profileId) {
  const candidates = buildPhotoCandidates(profileId);
  const checks = await Promise.all(
    candidates.map(async (item) => ({
      ...item,
      exists: await imageExists(item.src),
    }))
  );

  return checks
    .filter((item) => item.exists)
    .sort((a, b) => a.order - b.order)
    .map(({ key, src }) => ({ key, src }));
}

async function getAuthToken() {
  if (window.DyskiAuth?.ensureAccessToken) {
    return window.DyskiAuth.ensureAccessToken();
  }
  return window.DyskiAuth?.getAccessToken?.() || null;
}

async function callUnlockApi(method, payload = null) {
  const token = await getAuthToken();
  if (!token) throw new Error('Zaloguj się, aby odblokować zdjęcia');

  const profileId = state.profileId;
  const url = method === 'GET'
    ? `${PHOTO_UNLOCK_API}?profileId=${encodeURIComponent(profileId)}`
    : PHOTO_UNLOCK_API;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method === 'POST' ? JSON.stringify(payload || {}) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Nie udało się pobrać odblokowań zdjęć');
  }
  return data;
}

async function loadUnlocks() {
  if (!isLoggedIn()) {
    state.unlocked = new Set();
    return;
  }

  const data = await callUnlockApi('GET');
  state.unlocked = new Set(data.unlockedKeys || []);
  state.isSuperFan = Boolean(data.isSuperFan);
  if (state.isSuperFan && typeof window.markSuperFanProfile === 'function') {
    window.markSuperFanProfile(state.profileId);
  }
}

function renderProfileHeader() {
  const p = state.profile;
  const titleEl = document.getElementById('profile-gallery-name');
  const cityEl = document.getElementById('profile-gallery-city');
  const bioEl = document.getElementById('profile-gallery-bio');
  const avatarEl = document.getElementById('profile-gallery-avatar');
  const writeBtn = document.getElementById('profile-gallery-write-btn');

  if (!p) {
    if (titleEl) titleEl.textContent = 'Nie znaleziono profilu';
    if (cityEl) cityEl.textContent = 'Sprawdź poprawność linku';
    if (bioEl) bioEl.textContent = 'Ten profil nie istnieje lub został usunięty.';
    if (writeBtn) writeBtn.hidden = true;
    document.getElementById('profile-gallery-superfan-btn')?.setAttribute('hidden', '');
    const socialEl = document.getElementById('profile-gallery-social');
    if (socialEl) {
      socialEl.innerHTML = '';
      socialEl.hidden = true;
    }
    return;
  }

  document.getElementById('profile-gallery-superfan-btn')?.removeAttribute('hidden');

  if (titleEl) titleEl.textContent = `${p.imie || 'Koleżanka'}, ${p.wiek ?? ''}`.trim();
  if (cityEl) cityEl.textContent = (p.miasto || '—').toUpperCase();
  if (bioEl) bioEl.textContent = p.bio || 'Brak opisu.';
  const socialEl = document.getElementById('profile-gallery-social');
  if (socialEl) {
    if (typeof window.buildProfileSocialHtml === 'function' && window.hasProfileSocial(p.id)) {
      socialEl.innerHTML = window.buildProfileSocialHtml(p.id);
      socialEl.hidden = false;
    } else {
      socialEl.innerHTML = '';
      socialEl.hidden = true;
    }
  }
  if (avatarEl) {
    avatarEl.src = getAvatarForProfile(p.id);
    avatarEl.alt = p.imie || 'Zdjęcie profilowe';
  }
  if (writeBtn) {
    writeBtn.hidden = false;
    writeBtn.href = `index.html?inbox=${p.id}#messages`;
  }

  updateSuperfanButton();
  updateGalleryHint();
}

function updateGalleryHint() {
  const hint = document.getElementById('profile-gallery-hint');
  if (!hint || !state.profile) return;

  if (isSuperFanActive()) {
    hint.innerHTML = 'Masz aktywny <strong>SuperFan</strong> — wszystkie zdjęcia i filmy odblokowane, czat bez limitu.';
    hint.classList.add('profile-gallery-page__hint--superfan');
  } else {
    hint.innerHTML = 'Wszystkie zdjęcia są zablokowane. Odblokowanie jednego zdjęcia kosztuje <strong>20 żetonów</strong>.';
    hint.classList.remove('profile-gallery-page__hint--superfan');
  }
}

function updateSuperfanButton() {
  const btn = document.getElementById('profile-gallery-superfan-btn');
  const hero = document.querySelector('.profile-gallery-hero');
  if (!btn) return;

  if (!state.profile) {
    btn.hidden = true;
    return;
  }

  btn.hidden = false;

  if (isSuperFanActive()) {
    btn.disabled = true;
    btn.classList.add('is-active');
    btn.innerHTML = '<span class="profile-gallery-hero__superfan-icon" aria-hidden="true">◆</span> SuperFan aktywny';
    hero?.classList.add('profile-gallery-hero--superfan');
  } else {
    btn.disabled = false;
    btn.classList.remove('is-active');
    btn.innerHTML = '<span class="profile-gallery-hero__superfan-icon" aria-hidden="true">◆</span> Zostań SuperFanem';
    hero?.classList.remove('profile-gallery-hero--superfan');
  }
}

function openSuperfanModal() {
  if (!state.profile) return;

  if (!isLoggedIn()) {
    if (typeof openAuthModal === 'function') openAuthModal('login');
    return;
  }

  if (isSuperFanActive()) {
    if (typeof showToast === 'function') showToast('Masz już aktywny SuperFan u tej koleżanki.');
    return;
  }

  const modal = document.getElementById('superfan-modal');
  const nameEl = document.getElementById('superfan-modal-name');
  const subtitle = document.getElementById('superfan-modal-subtitle');
  const title = document.getElementById('superfan-modal-title');

  if (nameEl) nameEl.textContent = state.profile.imie || 'koleżanki';
  if (subtitle) subtitle.textContent = `Subskrypcja u ${state.profile.imie || 'koleżanki'}`;
  if (title) title.textContent = `SuperFan — ${state.profile.imie || 'koleżanka'}`;

  modal?.classList.add('is-open');
  modal?.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeSuperfanModal() {
  const modal = document.getElementById('superfan-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  if (
    !document.getElementById('token-modal')?.classList.contains('is-open') &&
    !document.getElementById('auth-modal')?.classList.contains('is-open')
  ) {
    document.body.style.overflow = '';
  }
}

async function purchaseSuperfan() {
  if (!state.profile || state.purchasingSuperFan) return;

  if (!isLoggedIn()) {
    if (typeof openAuthModal === 'function') openAuthModal('login');
    return;
  }

  if (isSuperFanActive()) {
    if (typeof showToast === 'function') showToast('Masz już aktywny SuperFan u tej koleżanki.');
    return;
  }

  const btn = document.getElementById('superfan-purchase-btn');
  state.purchasingSuperFan = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Przetwarzanie…';
  }

  try {
    const token = await getAuthToken();
    if (!token) throw new Error('Zaloguj się, aby kupić SuperFan');

    const res = await fetch(SUPERFAN_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ profileId: state.profile.id }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Zakup SuperFan nie powiódł się');

    state.isSuperFan = true;
    if (typeof window.markSuperFanProfile === 'function') {
      window.markSuperFanProfile(state.profile.id);
    }
    if (typeof window.refreshSuperfanProfiles === 'function') {
      await window.refreshSuperfanProfiles();
    }

    closeSuperfanModal();
    updateSuperfanButton();
    updateGalleryHint();
    renderGallery();

    if (typeof showToast === 'function') {
      showToast(`SuperFan aktywowany u ${state.profile.imie || 'koleżanki'}!`);
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message || 'Nie udało się kupić SuperFan');
  } finally {
    state.purchasingSuperFan = false;
    if (btn) {
      btn.disabled = isSuperFanActive();
      btn.textContent = isSuperFanActive() ? 'SuperFan aktywny' : 'Kup SuperFan — 59,99 zł';
    }
  }
}

function buildPhotoCard(photo) {
  const unlocked = isSuperFanActive() || state.unlocked.has(photo.key);
  const isUnlocking = state.loadingUnlock.has(photo.key);
  const lockText = isUnlocking ? 'Odblokowuję…' : `Odblokuj za ${PHOTO_UNLOCK_COST} żetonów`;
  const overlayHtml = unlocked
    ? ''
    : `
        <div class="profile-gallery-card__overlay">
          <button type="button" class="btn profile-gallery-card__unlock" data-photo-key="${photo.key}" ${isUnlocking ? 'disabled' : ''}>
            ${lockText}
          </button>
        </div>
      `;

  return `
    <article class="profile-gallery-card${unlocked ? ' is-unlocked' : ''}">
      <div class="profile-gallery-card__photo-wrap${unlocked ? '' : ' is-locked'}">
        <img src="${photo.src}" alt="Zdjęcie profilowe" class="profile-gallery-card__photo${unlocked ? '' : ' is-blurred'}" loading="lazy">
        ${overlayHtml}
      </div>
    </article>
  `;
}

function renderGallery() {
  const grid = document.getElementById('profile-gallery-grid');
  const empty = document.getElementById('profile-gallery-empty');
  if (!grid || !empty) return;

  if (!state.profile || !state.photos.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    empty.textContent = state.profile
      ? 'Ta koleżanka nie ma jeszcze dodanych zdjęć.'
      : 'Nie można wyświetlić galerii dla tego profilu.';
    return;
  }

  empty.hidden = true;
  grid.innerHTML = state.photos.map((photo) => buildPhotoCard(photo)).join('');
}

async function unlockPhoto(photoKey) {
  if (!state.profile) return;

  if (isSuperFanActive()) {
    if (typeof showToast === 'function') showToast('Masz SuperFan — wszystkie zdjęcia są już odblokowane.');
    return;
  }

  if (!isLoggedIn()) {
    if (typeof openAuthModal === 'function') openAuthModal('login');
    return;
  }

  if (state.unlocked.has(photoKey) || state.loadingUnlock.has(photoKey)) return;
  state.loadingUnlock.add(photoKey);
  renderGallery();

  try {
    const data = await callUnlockApi('POST', {
      profileId: state.profile.id,
      photoKey,
    });

    state.unlocked = new Set(data.unlockedKeys || []);

    if (typeof data.newTokens === 'number') {
      window.DyskiAuth?.applyTokensFromServer?.(data.newTokens);
      if (typeof updateTokenUI === 'function') updateTokenUI(data.newTokens);
      if (typeof syncTokenDisplay === 'function') syncTokenDisplay();
    }

    if (typeof showToast === 'function') {
      showToast(data.alreadyUnlocked ? 'To zdjęcie było już odblokowane' : 'Zdjęcie odblokowane');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message || 'Nie udało się odblokować zdjęcia');
  } finally {
    state.loadingUnlock.delete(photoKey);
    renderGallery();
  }
}

function bindGalleryActions() {
  const grid = document.getElementById('profile-gallery-grid');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    const button = e.target.closest('[data-photo-key]');
    if (!button) return;
    unlockPhoto(button.dataset.photoKey);
  });

  document.getElementById('profile-gallery-superfan-btn')?.addEventListener('click', openSuperfanModal);
  document.getElementById('superfan-modal-close')?.addEventListener('click', closeSuperfanModal);
  document.getElementById('superfan-modal-backdrop')?.addEventListener('click', closeSuperfanModal);
  document.getElementById('superfan-purchase-btn')?.addEventListener('click', purchaseSuperfan);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSuperfanModal();
  });
}

async function initProfilePage() {
  state.profileId = parseProfileIdFromUrl();
  const profiles = await loadProfiles();
  state.profile = profiles.find((p) => Number(p.id) === state.profileId) || null;

  renderProfileHeader();

  if (!state.profile) {
    renderGallery();
    return;
  }

  bindGalleryActions();
  state.photos = await discoverProfilePhotos(state.profile.id);

  try {
    if (typeof window.refreshSuperfanProfiles === 'function') {
      await window.refreshSuperfanProfiles();
    }
    await loadUnlocks();
  } catch (err) {
    console.error(err);
  }

  updateSuperfanButton();
  updateGalleryHint();
  renderGallery();

  window.addEventListener('dyskihub-auth', async () => {
    try {
      if (typeof window.refreshSuperfanProfiles === 'function') {
        await window.refreshSuperfanProfiles();
      }
      await loadUnlocks();
    } catch (err) {
      console.error(err);
    }
    updateSuperfanButton();
    updateGalleryHint();
    renderGallery();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('page-profile-gallery')) return;
  initProfilePage().catch((err) => {
    console.error(err);
    if (typeof showToast === 'function') {
      showToast('Nie udało się załadować profilu koleżanki');
    }
  });
});
