/**
 * DyskiHub.pl — profile data & chat system
 * Edit profiles array to add/change cards. Replace #LINK_N with affiliate URLs.
 */

const MAX_OPEN_CHATS = 3;
const TOKEN_STORAGE_KEY = 'flirtmatch_tokens';
const SIDEBAR_COLLAPSED_KEY = 'flirtmatch_sidebar_collapsed';
const USERS_STORAGE_KEY = 'flirtmatch_users';
const REFERRAL_STATS_KEY = 'flirtmatch_referral_stats';
const PENDING_REF_KEY = 'flirtmatch_pending_ref';
const REFERRAL_TIERS = [1, 5, 15, 50];
const DEFAULT_TOKENS = 25;

const USERNAME_REGEX = /^[a-zA-Z0-9_.\-\u00C0-\u024F]{3,32}$/;
const USERNAME_MAX_LEN = 32;

const TOKEN_PACKAGES = [
  { id: 'pack-50', tokens: 50, bonusTokens: 0, price: '19,99 zł', popular: false },
  { id: 'pack-120', tokens: 120, bonusTokens: 20, price: '39,99 zł', popular: true, bonus: '+20 żetonów gratis' },
  { id: 'pack-300', tokens: 300, bonusTokens: 50, price: '79,99 zł', popular: false, bonus: '+50 żetonów gratis' },
];

/** Linki doładowania żetonów — podmień po integracji płatności */
const TOPUP_CRYPTO_URL = '#';
const TOPUP_DISCORD_URL = '#';

const DISC_GRID_PHOTOS = [
  'images/discs/disc-1.png',
  'images/discs/disc-2.png',
  'images/discs/disc-3.png',
  'images/discs/disc-4.png',
  'images/discs/disc-5.png',
  'images/discs/disc-6.png',
  'images/discs/disc-7.png',
  'images/discs/disc-8.png',
  'images/discs/disc-9.png',
  'images/discs/disc-10.png',
  'images/discs/disc-11.png',
  'images/discs/disc-12.png',
  'images/discs/disc-13.png',
  'images/discs/disc-14.png',
  'images/discs/disc-15.png',
  'images/discs/disc-16.png',
  'images/discs/disc-17.png',
  'images/discs/disc-18.png',
  'images/discs/disc-19.png',
];

/** Kadrowanie miniatur — domyślnie center; tu twarze w centrum karty */
const DISC_PHOTO_POSITIONS = {
  'images/discs/disc-2.png': 'center 18%',
  'images/discs/disc-5.png': '68% 22%',
  'images/discs/disc-6.png': 'center 24%',
  'images/discs/disc-7.png': 'center 20%',
  'images/discs/disc-8.png': 'center 22%',
  'images/discs/disc-9.png': 'center 20%',
  'images/discs/disc-10.png': '72% 22%',
  'images/discs/disc-11.png': 'center 20%',
  'images/discs/disc-12.png': 'center 18%',
  'images/discs/disc-13.png': '32% 22%',
  'images/discs/disc-14.png': 'center 20%',
  'images/discs/disc-15.png': 'center 22%',
  'images/discs/disc-16.png': 'center 22%',
  'images/discs/disc-17.png': 'center 26%',
  'images/discs/disc-18.png': 'center 30%',
  'images/discs/disc-19.png': 'center 38%',
};

function buildDiscPhotoHtml(item, wrapExtraClass = '') {
  if (!item?.image) return '<span class="disc-card__disc" aria-hidden="true"></span>';
  const pos = DISC_PHOTO_POSITIONS[item.image];
  const styleAttr = pos ? ` style="object-position: ${pos}"` : '';
  const wrapClass = wrapExtraClass ? ` disc-card__photo-wrap--${wrapExtraClass}` : '';
  return `<span class="disc-card__photo-wrap${wrapClass}"><img src="${item.image}" alt="" class="disc-card__photo" loading="lazy"${styleAttr}></span>`;
}

let discCatalogFilter = 'all';
let discCatalogSearch = '';
let profileCatalogSearch = '';

function getDiscCreatorName(gridIndex) {
  return DISC_GRID_NAMES[gridIndex] || `Dysk ${gridIndex + 1}`;
}

/** Dyski w karuzeli hero — gridIndex łączy ze zdjęciem i stanem odblokowania siatki */
const DISC_CAROUSEL_ITEMS = [
  { packId: 'pack-50', discName: 'Dysk Fagata', tag: 'Fagata', popular: true, gridIndex: 0 },
  { packId: 'pack-120', discName: 'Dysk Natsu', tag: 'Natsu', gridIndex: 1 },
  { packId: 'pack-300', discName: 'Dysk Vanessaszwaczka', tag: 'Vanessaszwaczka', gridIndex: 2 },
  { packId: 'pack-50', discName: 'Dysk BadGirlSandra', tag: 'BadGirlSandra', gridIndex: 3 },
  { packId: 'pack-120', discName: 'Dysk Julka Guzik', tag: 'Julka', popular: true, gridIndex: 4 },
  { packId: 'pack-300', discName: 'Dysk HannahOwO', tag: 'HannahOwO', gridIndex: 17 },
  { packId: 'pack-50', discName: 'Dysk Songheli', tag: 'Songheli', gridIndex: 10 },
].map((item) => ({
  ...item,
  image: DISC_GRID_PHOTOS[item.gridIndex],
  discId: `disc-grid-${item.gridIndex}`,
}));

const DISC_GRID_NAMES = [
  'Fagata', 'Natsu', 'Vanessaszwaczka', 'BadGirlSandra', 'Julka Guzik',
  'Hotjulcia', 'Amxnduh', 'Llleasy', 'Ultrafioletova', 'Sheeya',
  'Songheli', 'Tanamongeau', 'Klaudusiek', 'Jaworowa', 'Amouranth',
  'Sophieraiin', 'Mia_tattoo', 'HannahOwO', 'BelleDelphine',
];

const DISC_UNLOCK_COST = 20;
const UNLOCKED_DISCS_KEY = 'flirtmatch_unlocked_discs';

/** Link do dysku — podmień na swój URL lub zostaw placeholder */
const DISC_LINK_BASE = '#DISC_LINK_HERE';

/** Link do reklamy (odblokowanie dysku) — podmień na swój URL */
const DISC_AD_LINK = '#DISC_AD_LINK_HERE';

let pendingDiscPurchase = null;

function getUnlockedDiscIds() {
  try {
    const raw = localStorage.getItem(UNLOCKED_DISCS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function isDiscUnlocked(discId) {
  if (!discId) return false;
  return getUnlockedDiscIds().includes(discId);
}

function markDiscUnlocked(discId) {
  if (!discId) return;
  const ids = getUnlockedDiscIds();
  if (ids.includes(discId)) return;
  ids.push(discId);
  localStorage.setItem(UNLOCKED_DISCS_KEY, JSON.stringify(ids));
  refreshDiscClaimButton(discId);
  renderDiscGrid();
}

function refreshDiscClaimButton(discId) {
  const unlocked = isDiscUnlocked(discId);
  document.querySelectorAll(`.disc-card[data-disc-id="${discId}"]`).forEach((card) => {
    card.querySelectorAll('.disc-card__claim').forEach((btn) => {
      btn.textContent = unlocked ? 'Odbierz swój dysk' : 'Odbierz';
    });
    card.querySelectorAll('.disc-card__lock').forEach((lock) => {
      lock.outerHTML = buildDiscLockHtml(discId);
    });
  });
}

function buildDiscLockHtml(discId) {
  const unlocked = isDiscUnlocked(discId);
  const label = unlocked ? 'Dysk odblokowany' : 'Dysk zablokowany';
  const mod = unlocked ? 'disc-card__lock--open' : 'disc-card__lock--closed';
  const icon = unlocked
    ? '<path d="M7 11V7a5 5 0 0 1 9.5-1M7 11h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    : '<rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>';
  return `<span class="disc-card__lock ${mod}" title="${label}" aria-label="${label}"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">${icon}</svg></span>`;
}

function getDiscLink(item) {
  if (!item) return '';
  if (item.link && /^https?:\/\//i.test(item.link)) return item.link;

  const base = DISC_LINK_BASE;
  if (!base || base === '#DISC_LINK_HERE' || !/^https?:\/\//i.test(base)) return '';

  const trimmed = base.replace(/\/$/, '');
  const ref = encodeURIComponent(item.discId || 'dysk');
  return `${trimmed}/${ref}`;
}

function getDiscAdLink() {
  const base = DISC_AD_LINK;
  if (!base || base === '#DISC_AD_LINK_HERE' || !/^https?:\/\//i.test(base)) return '';
  return base;
}

function getDiscGridItems() {
  const packIds = TOKEN_PACKAGES.map((p) => p.id);
  return DISC_GRID_PHOTOS.map((photo, i) => ({
    discId: `disc-grid-${i}`,
    packId: packIds[i % packIds.length],
    discName: `Dysk ${DISC_GRID_NAMES[i] || i + 1}`,
    popular: i % 6 === 0,
    tag: String(i + 1),
    image: photo,
    gridIndex: i,
  })).sort((a, b) => {
    const aUnlocked = isDiscUnlocked(a.discId);
    const bUnlocked = isDiscUnlocked(b.discId);
    if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;
    return a.gridIndex - b.gridIndex;
  });
}

const PERSON_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;

const ATTACH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;

function triggerFileAttach() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,.pdf,.doc,.docx,.txt';
  input.hidden = true;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) showToast(`Załączono plik: ${file.name}`);
    input.remove();
  });
  document.body.appendChild(input);
  input.click();
}

function bindAttachButton(button) {
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerFileAttach();
  });
}

let profiles = [];

const DEFAULT_PROFILES_DATA = [
  { id: 1, imie: 'Natalcia', wiek: 18, miasto: 'WARSZAWA', bio: 'Tak jestem altką', aktywnosci: 142, status: 'online' },
  { id: 2, imie: 'Wikaa_', wiek: 19, miasto: 'KRAKÓW', bio: 'Hejka;) Zapraszam.', aktywnosci: 89, status: 'online' },
  { id: 3, imie: 'Monikapv', wiek: 18, miasto: 'WROCŁAW', bio: 'Co tam u ciebie;)', aktywnosci: 167, status: 'online' },
  { id: 4, imie: 'Weronikaaa', wiek: 19, miasto: 'WARSZAWA', bio: 'pvvvvv', aktywnosci: 203, status: 'online' },
  { id: 5, imie: 'Oliwia<3', wiek: 19, miasto: 'WARSZAWA', bio: 'Cała twoja❤️', aktywnosci: 311, status: 'online' },
  { id: 6, imie: 'Karolcia09_', wiek: 20, miasto: 'GDAŃSK', bio: 'Aktywna teraz, napisz do mnie.', aktywnosci: 178, status: 'online' },
  { id: 7, imie: 'Zuzaa08', wiek: 18, miasto: 'POZNAŃ', bio: 'Hejj pvvv', aktywnosci: 96, status: 'online' },
  { id: 8, imie: 'Zosia_08', wiek: 20, miasto: 'ŁÓDŹ', bio: 'Hejka jestem alternatywką i chce się poznać', aktywnosci: 54, status: 'online' },
  { id: 9, imie: 'Majaa.', wiek: 19, miasto: 'SOPOT', bio: 'Ktoś coś?', aktywnosci: 121, status: 'online' },
  { id: 10, imie: 'Domi_nika', wiek: 20, miasto: 'KRAKÓW', bio: 'Zapraszam na pv❤️❤️', aktywnosci: 87, status: 'online' },
];

function mapKolezankaToProfile(entry) {
  return {
    id: entry.id,
    name: entry.imie,
    age: entry.wiek,
    city: entry.miasto,
    bio: entry.bio,
    image: `images/kolezanki/${entry.id}/avatar.jpg`,
    available: entry.status === 'online',
    aktywnosci: entry.aktywnosci ?? 0,
  };
}

async function loadProfiles() {
  try {
    const res = await fetch('data/kolezanki.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error('empty');
    profiles = data.map(mapKolezankaToProfile);
  } catch (err) {
    console.error('Nie udało się wczytać data/kolezanki.json — używam danych zapasowych', err);
    profiles = DEFAULT_PROFILES_DATA.map(mapKolezankaToProfile);
  }
}

function handleProfileImageError(img) {
  const wrap = img.closest('.profile-card__visual');
  if (!wrap || wrap.querySelector('.profile-img__placeholder')) return;
  img.style.display = 'none';
  const placeholder = document.createElement('div');
  placeholder.className = 'profile-img__placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.innerHTML = `${PERSON_ICON}<span>Zdjęcie wkrótce</span>`;
  wrap.appendChild(placeholder);
}
window.handleProfileImageError = handleProfileImageError;

function getFilteredProfiles() {
  const q = profileCatalogSearch.trim().toLowerCase();
  return profiles.filter((p) => {
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      String(p.age).includes(q) ||
      (p.bio || '').toLowerCase().includes(q)
    );
  });
}

function formatProfileCount(count) {
  if (count === 1) return '1 profil';
  if (count >= 2 && count <= 4) return `${count} profile`;
  return `${count} profili`;
}

function formatDiscCount(count) {
  if (count === 1) return '1 dysk';
  if (count >= 2 && count <= 4) return `${count} dyski`;
  return `${count} dysków`;
}

function buildProfileCardHtml(p) {
  const onlineBadge = p.available ? '<span class="profile-card__badge">ONLINE</span>' : '';
  const statusDot = p.available
    ? '<span class="profile-card__online" title="Online" aria-label="Online"></span>'
    : '<span class="profile-card__offline" title="Offline" aria-label="Offline"></span>';

  return `
    <article class="profile-card profile-card--catalog" data-profile-id="${p.id}" data-profile-online="${p.available ? '1' : '0'}" tabindex="0" role="button" aria-label="Otwórz czat z ${escapeHtml(p.name)}">
      <div class="profile-card__visual">
        ${onlineBadge}
        <div class="profile-card__img-wrap">
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" class="profile-img" data-profile-id="${p.id}" loading="lazy" onerror="handleProfileImageError(this)">
          <div class="profile-img__placeholder" hidden aria-hidden="true">${PERSON_ICON}<span>Zdjęcie wkrótce</span></div>
        </div>
        <span class="profile-card__activity">${p.aktywnosci} aktywności</span>
      </div>
      <div class="profile-card__meta">
        <div class="profile-card__meta-head">
          <h3 class="profile-card__creator">${escapeHtml(p.name.toUpperCase())}, ${p.age}</h3>
        </div>
        <p class="profile-card__stats">${escapeHtml(p.city)}</p>
        <p class="profile-card__bio">${escapeHtml(p.bio || '')}</p>
        <div class="profile-card__actions">
          ${statusDot}
          ${getProfileChatButtonHtml(p.id)}
        </div>
      </div>
    </article>
  `;
}

function initProfileCatalog() {
  const search = document.getElementById('profiles-catalog-search');
  search?.addEventListener('input', () => {
    profileCatalogSearch = search.value;
    renderProfiles();
  });
}

/** Tasuje kolejność kart i listy w skrzynce (Fisher–Yates) */
function shuffleProfiles() {
  for (let i = profiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
  }
}

const CHAT_MESSAGES = [
  'Hej! Cieszę się, że się odezwałeś 😊',
  'Mam nadzieję, że się poznamy lepiej...',
  'Napisz mi coś o sobie 👀',
];

/** Usługi kupowane za żetony (cennik w czacie) */
const PRICING_SHOP_ITEMS = [
  { id: 'shop-rose', name: 'Wirtualna róża', desc: 'Wyślij prezent w czacie', cost: 15 },
  { id: 'shop-photo-unlock', name: 'Odblokowanie zdjęcia', desc: 'Zdejmij blur ze zdjęcia w czacie', cost: 20 },
];

const INBOX_META = {
  1: { time: '2 min' },
  2: { time: '15 min' },
  3: { time: '1 godz.' },
  4: { time: '3 godz.' },
  5: { time: 'Wczoraj' },
  6: { time: '5 min' },
  7: { time: '22 min' },
  8: { time: '2 godz.' },
  9: { time: '4 godz.' },
  10: { time: 'Wczoraj' },
};

function chatHistoryKey(profileId) {
  return `chat_history_${profileId}`;
}

function chatUpdatedKey(profileId) {
  return `chat_updated_${profileId}`;
}

function chatStartStorageKey(profileId) {
  return `chat_start_${profileId}`;
}

function chatSessionEndKey(profileId) {
  return `chat_session_end_${profileId}`;
}

const CHAT_STORAGE_VERSION_KEY = 'chat_storage_v2';

function sanitizeChatHistory(arr) {
  if (!Array.isArray(arr) || !arr.length) return [];
  const firstUser = arr.findIndex((m) => m.role === 'user');
  if (firstUser === -1) return [];
  return arr.slice(firstUser);
}

function historyHasUserMessage(history) {
  return Array.isArray(history) && history.some((m) => m.role === 'user');
}

function migrateChatStorageV2() {
  if (localStorage.getItem(CHAT_STORAGE_VERSION_KEY) === '1') return;

  for (let id = 1; id <= 10; id += 1) {
    localStorage.removeItem(chatHistoryKey(id));
    localStorage.removeItem(chatUpdatedKey(id));
    localStorage.removeItem(chatStartStorageKey(id));
    localStorage.removeItem(chatSessionEndKey(id));
  }

  localStorage.setItem(CHAT_STORAGE_VERSION_KEY, '1');
}

function loadProfileChatHistory(profileId) {
  try {
    const raw = JSON.parse(localStorage.getItem(chatHistoryKey(profileId)) || '[]');
    if (!Array.isArray(raw)) return [];

    const sanitized = sanitizeChatHistory(raw);
    if (sanitized.length !== raw.length) {
      if (sanitized.length === 0) {
        localStorage.removeItem(chatHistoryKey(profileId));
        localStorage.removeItem(chatUpdatedKey(profileId));
      } else {
        localStorage.setItem(chatHistoryKey(profileId), JSON.stringify(sanitized));
      }
    }

    return sanitized;
  } catch {
    return [];
  }
}

function stripInboxPhotoTag(text) {
  return (text || '').replace(/\s*\[SEND_PHOTO\]\s*/gi, '').trim();
}

function inboxHasPhotoTag(text) {
  return /\[SEND_PHOTO\]/i.test(text || '');
}

function getLastProfileChatSnippet(history) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    const text = stripInboxPhotoTag(msg.content);
    if (text) return { role: msg.role, text };
    if (inboxHasPhotoTag(msg.content)) return { role: msg.role, text: 'Zdjęcie' };
  }
  return null;
}

function getProfileChatUpdatedAt(profileId) {
  const updated = parseInt(localStorage.getItem(chatUpdatedKey(profileId)), 10);
  if (Number.isFinite(updated)) return updated;
  const started = parseInt(localStorage.getItem(chatStartStorageKey(profileId)), 10);
  return Number.isFinite(started) ? started : 0;
}

function formatInboxRelativeTime(timestamp) {
  if (!timestamp) return '';
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Teraz';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} godz.`;
  if (hours < 48) return 'Wczoraj';
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Wczoraj' : `${days} dni`;
}

function getInboxContactMeta(profile) {
  const history = loadProfileChatHistory(profile.id);

  if (!historyHasUserMessage(history)) {
    return {
      preview: profile.bio,
      time: INBOX_META[profile.id]?.time || '',
      unread: 0,
      sortKey: 0,
      hasChat: false,
    };
  }

  const last = getLastProfileChatSnippet(history);
  const updatedAt = getProfileChatUpdatedAt(profile.id);

  if (last) {
    const previewText = last.role === 'user' ? `Ty: ${last.text}` : last.text;
    const preview =
      previewText.length > 72 ? `${previewText.slice(0, 72).trim()}…` : previewText;
    return {
      preview,
      time: formatInboxRelativeTime(updatedAt),
      unread: 0,
      sortKey: updatedAt || 1,
      hasChat: true,
    };
  }

  return {
    preview: profile.bio,
    time: INBOX_META[profile.id]?.time || '',
    unread: 0,
    sortKey: 0,
    hasChat: false,
  };
}

function appendInboxTextBubble(container, text, fromUser) {
  if (!container || !text) return;
  const bubble = document.createElement('div');
  bubble.className = `inbox-bubble inbox-bubble--${fromUser ? 'me' : 'her'}`;
  bubble.textContent = text;
  container.appendChild(bubble);
}

function renderInboxThreadMessages(profileId, profile) {
  const messagesEl = document.getElementById('inbox-thread-messages');
  if (!messagesEl) return;

  const history = loadProfileChatHistory(profileId);
  messagesEl.innerHTML = '';

  if (!history.length) {
    return;
  }

  history.forEach((msg) => {
    if (msg.role === 'user') {
      const text = stripInboxPhotoTag(msg.content);
      if (text) appendInboxTextBubble(messagesEl, text, true);
      return;
    }
    if (msg.role === 'assistant') {
      const text = stripInboxPhotoTag(msg.content);
      if (text) appendInboxTextBubble(messagesEl, text, false);
    }
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/** AI czat — blokady profili (localStorage) */
const CHAT_TALKED_TO_KEY = 'talked_to';
const CHAT_COOLDOWN_KEY = 'cooldown_until';
let profileCooldownInterval = null;

function getChatTalkedTo() {
  try {
    const raw = localStorage.getItem(CHAT_TALKED_TO_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(Number) : [];
  } catch {
    return [];
  }
}

function getChatCooldownUntil() {
  const n = parseInt(localStorage.getItem(CHAT_COOLDOWN_KEY), 10);
  return Number.isFinite(n) ? n : 0;
}

function isProfileChatCooldownActive() {
  return Date.now() < getChatCooldownUntil();
}

function formatProfileChatCountdown(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function getProfileChatButtonHtml(profileId) {
  if (isProfileChatCooldownActive()) {
    const remaining = getChatCooldownUntil() - Date.now();
    return `<span class="profile-card__btn profile-card__btn--cooldown" data-cooldown-profile="${profileId}">Dostępna za ${formatProfileChatCountdown(remaining)}</span>`;
  }
  return `<button type="button" class="profile-card__btn profile-card__btn--chat" data-open-inbox="${profileId}">Napisz</button>`;
}

function tickProfileCooldownButtons() {
  const remaining = getChatCooldownUntil() - Date.now();
  if (remaining <= 0) {
    clearInterval(profileCooldownInterval);
    profileCooldownInterval = null;
    renderProfiles();
    return;
  }
  document.querySelectorAll('[data-cooldown-profile]').forEach((el) => {
    el.textContent = `Dostępna za ${formatProfileChatCountdown(remaining)}`;
  });
}

function startProfileCooldownTicker() {
  if (profileCooldownInterval) clearInterval(profileCooldownInterval);
  if (!isProfileChatCooldownActive()) return;
  profileCooldownInterval = setInterval(tickProfileCooldownButtons, 1000);
}

let activeInboxId = null;

/** Uniwersalny link polecający — podmień na swój URL lub zostaw placeholder (wtedy używa adresu strony) */
const INVITE_LINK_BASE = '#INVITE_LINK_HERE';

function getInviteReferralLink() {
  const user = getCurrentUser();
  const ref = encodeURIComponent(user?.username || 'gosc');
  let base = INVITE_LINK_BASE;
  if (!base || base === '#INVITE_LINK_HERE' || !/^https?:\/\//i.test(base)) {
    const path = window.location.pathname.replace(/\/[^/]*$/, '/') || '/';
    base = `${window.location.origin}${path}`;
  }
  const trimmed = base.replace(/\/$/, '');
  const joiner = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${joiner}ref=${ref}`;
}

function captureReferralFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    sessionStorage.setItem(PENDING_REF_KEY, ref.trim().toLowerCase());
  }
}

function getReferralStats() {
  try {
    return JSON.parse(localStorage.getItem(REFERRAL_STATS_KEY)) || {};
  } catch {
    return {};
  }
}

function getReferralSignupCount(username) {
  if (!username) return 0;
  const key = username.toLowerCase();
  const statsCount = getReferralStats()[key] || 0;
  const usersCount = getStoredUsers().filter(
    (u) => u.referredBy?.toLowerCase() === key
  ).length;
  return Math.max(statsCount, usersCount);
}

function incrementReferralSignup(referrerUsername) {
  const key = referrerUsername.toLowerCase();
  const stats = getReferralStats();
  stats[key] = (stats[key] || 0) + 1;
  localStorage.setItem(REFERRAL_STATS_KEY, JSON.stringify(stats));
}

function attributeReferralOnRegister(newUser) {
  const pendingRef = sessionStorage.getItem(PENDING_REF_KEY);
  if (!pendingRef) return;

  sessionStorage.removeItem(PENDING_REF_KEY);

  const referrer = pendingRef.toLowerCase();
  if (referrer === newUser.username.toLowerCase()) return;

  incrementReferralSignup(referrer);
}

function showInviteLinkPanel() {
  const panel = document.getElementById('invite-link-panel');
  const input = document.getElementById('invite-link-input');
  if (!panel || !input) return;

  input.value = getInviteReferralLink();
  panel.hidden = false;
}

function hideInviteLinkPanel() {
  const panel = document.getElementById('invite-link-panel');
  if (panel) panel.hidden = true;
}

async function copyInviteLink() {
  const input = document.getElementById('invite-link-input');
  const link = input?.value || getInviteReferralLink();
  try {
    await navigator.clipboard.writeText(link);
    showToast('Link skopiowany do schowka.');
  } catch {
    input?.select();
    showToast('Zaznaczono link — skopiuj ręcznie (Ctrl+C).');
  }
}

/** Affiliate link placeholders — replace href values */
function getAffiliateHref(id) {
  const links = {
    1: '#LINK_1',
    2: '#LINK_2',
    3: '#LINK_3',
    4: '#LINK_4',
    5: '#LINK_5',
    6: '#LINK_6',
    7: '#LINK_7',
    8: '#LINK_8',
    9: '#LINK_9',
    10: '#LINK_10',
  };
  return links[id] || '#AFFILIATE_LINK_HERE';
}

const openChats = new Map();

function renderProfiles() {
  const grid = document.getElementById('profile-grid');
  if (!grid) return;

  const filtered = getFilteredProfiles();
  grid.innerHTML = filtered.map((p) => buildProfileCardHtml(p)).join('');

  const totalEl = document.getElementById('profiles-catalog-total');
  if (totalEl) totalEl.textContent = `${filtered.length} TOTAL`;

  grid.querySelectorAll('.profile-card').forEach((card) => {
    const id = Number(card.dataset.profileId);
    card.addEventListener('click', (e) => {
      if (e.target.closest('.profile-card__btn--chat, .profile-card__btn--ended, .profile-card__btn--cooldown')) return;
      openInbox(id);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openInbox(id);
      }
    });
  });

  grid.querySelectorAll('.profile-card__btn--chat').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openInbox(Number(btn.dataset.openInbox));
    });
  });

  startProfileCooldownTicker();
}

function getProfile(id) {
  return profiles.find((p) => p.id === id);
}

function openChat(profileId) {
  const profile = getProfile(profileId);
  if (!profile) return;

  if (openChats.has(profileId)) {
    const existing = openChats.get(profileId);
    existing.classList.remove('chat-bubble--minimized');
    existing.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  if (openChats.size >= MAX_OPEN_CHATS) {
    const oldest = openChats.keys().next().value;
    closeChat(oldest);
  }

  const container = document.getElementById('chat-container');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.dataset.profileId = String(profileId);
  bubble.setAttribute('role', 'dialog');
  bubble.setAttribute('aria-label', `Czat z ${profile.name}`);

  bubble.innerHTML = `
    <header class="chat-bubble__header">
      <div class="chat-bubble__avatar">${PERSON_ICON}</div>
      <div class="chat-bubble__info">
        <div class="chat-bubble__name">
          ${profile.name}, ${profile.age}
          <span class="chat-bubble__online"></span>
        </div>
        <span class="chat-bubble__status">Online</span>
      </div>
      <button type="button" class="chat-bubble__close" aria-label="Zamknij czat">&times;</button>
    </header>
    <div class="chat-bubble__body">
      <div class="chat-bubble__messages" data-messages></div>
      <div class="chat-bubble__input-wrap">
        <button type="button" class="chat-bubble__attach" data-attach-chat aria-label="Załącz plik">${ATTACH_ICON}</button>
        <input type="text" class="chat-bubble__input" placeholder="Napisz wiadomość..." autocomplete="off" data-input>
        <button type="button" class="chat-bubble__send" aria-label="Wyślij">${SEND_ICON}</button>
      </div>
    </div>
  `;

  container.appendChild(bubble);
  openChats.set(profileId, bubble);

  const messagesEl = bubble.querySelector('[data-messages]');
  CHAT_MESSAGES.forEach((text, i) => {
    setTimeout(() => {
      appendMessage(messagesEl, text, false);
    }, 300 + i * 400);
  });

  const input = bubble.querySelector('[data-input]');
  const sendBtn = bubble.querySelector('.chat-bubble__send');
  const closeBtn = bubble.querySelector('.chat-bubble__close');
  bindAttachButton(bubble.querySelector('[data-attach-chat]'));

  const handleSend = () => {
    const text = input.value.trim();
    if (!text) return;
    appendMessage(messagesEl, text, true);
    input.value = '';
    showAffiliateOverlay(bubble, profileId);
  };

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });
  closeBtn.addEventListener('click', () => closeChat(profileId));
}

function appendMessage(container, text, isUser) {
  const msg = document.createElement('div');
  msg.className = `chat-msg${isUser ? ' chat-msg--user' : ''}`;
  msg.textContent = text;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function showAffiliateOverlay(bubble, profileId) {
  if (bubble.querySelector('.chat-affiliate-overlay')) return;

  const body = bubble.querySelector('.chat-bubble__body');
  const overlay = document.createElement('div');
  overlay.className = 'chat-affiliate-overlay';
  overlay.innerHTML = `
    <p>Aby kontynuować rozmowę, potwierdź swój wiek i zarejestruj się za darmo</p>
    <!-- AFFILIATE LINK ${profileId} -->
    <a href="${getAffiliateHref(profileId)}" class="btn btn--primary" id="affiliate-link-${profileId}" target="_blank" rel="noopener sponsored">
      Kontynuuj rozmowę →
    </a>
  `;
  body.appendChild(overlay);

  const inputWrap = bubble.querySelector('.chat-bubble__input-wrap');
  if (inputWrap) inputWrap.style.visibility = 'hidden';
}

function closeChat(profileId) {
  const bubble = openChats.get(profileId);
  if (!bubble) return;

  bubble.classList.add('closing');
  bubble.addEventListener(
    'animationend',
    () => {
      bubble.remove();
      openChats.delete(profileId);
    },
    { once: true }
  );
}

function getTokenBalance() {
  if (window.DyskiAuth?.getCurrentUser()) {
    return window.DyskiAuth.getTokenBalanceSync();
  }
  return 0;
}

function setTokenBalance(amount) {
  const value = Math.max(0, Math.floor(amount));
  const user = window.DyskiAuth?.getCurrentUser();

  if (user) {
    const current = window.DyskiAuth.getTokenBalanceSync();
    const delta = value - current;
    if (delta < 0) {
      const spend = -delta;
      window.DyskiAuth.spendTokens(spend).catch((err) => {
        showToast(err.message || 'Błąd aktualizacji żetonów');
        window.DyskiAuth.loadProfile();
      });
      return Math.max(0, current - spend);
    }
    return current;
  }

  return 0;
}

function updateTokenUI(balance) {
  const formatted = balance.toLocaleString('pl-PL');
  document.querySelectorAll('#token-balance, #token-balance-dropdown, #token-balance-modal').forEach((el) => {
    if (el) el.textContent = formatted;
  });
}

function syncTokenDisplay() {
  updateTokenUI(getTokenBalance());
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

async function purchaseTokenPack(packId) {
  const pack = TOKEN_PACKAGES.find((p) => p.id === packId);
  if (!pack) return;

  if (!window.DyskiAuth?.getCurrentUser()) {
    showToast('Zaloguj się, aby doładować żetony.');
    openAuthModal('login');
    return;
  }

  const tokens = pack.tokens + (pack.bonusTokens || 0);
  const label = pack.bonus ? `${pack.tokens} + ${pack.bonusTokens} bonus` : String(tokens);

  try {
    const result = await window.DyskiAuth.purchasePack(packId);
    updateInboxPricingBalance();
    renderInboxPricingShop();
    showToast(`Dodano ${label} żetonów. Stan konta: ${result.newTokens}`);
  } catch (err) {
    showToast(err.message || 'Nie udało się doładować żetonów');
  }
}

function buildDiscCardHtml(item, extraClass = '') {
  const pack = TOKEN_PACKAGES.find((p) => p.id === item.packId);
  if (!pack) return '';

  const total = pack.tokens + (pack.bonusTokens || 0);
  const popularClass = item.popular || pack.popular ? ' disc-card--popular' : '';
  const visual = buildDiscPhotoHtml(item);

  return `
    <button type="button" class="disc-card${popularClass}${extraClass}${item.image ? ' disc-card--photo' : ''}" data-pack-id="${pack.id}" aria-label="Kup ${item.discName}: ${total} żetonów za ${pack.price}">
      ${item.popular || pack.popular ? '<span class="disc-card__badge">Hit</span>' : ''}
      ${visual}
      <span class="disc-card__amount">${total}</span>
      <span class="disc-card__unit">żetonów</span>
      <span class="disc-card__name">${item.discName}</span>
      ${pack.bonus ? `<span class="disc-card__bonus">${pack.bonus}</span>` : ''}
      <span class="disc-card__price">${pack.price}</span>
    </button>
  `;
}

function buildDiscClaimCardHtml(item, variant = 'grid') {
  const unlocked = isDiscUnlocked(item.discId);
  const creator = getDiscCreatorName(item.gridIndex ?? 0);
  const popularClass = item.popular ? ' disc-card--popular' : '';
  const unlockedClass = unlocked ? ' disc-card--unlocked' : '';
  const variantClass = variant === 'carousel' ? ' disc-card--carousel' : ' disc-card--grid';

  if (variant === 'carousel') {
    return `
    <article class="disc-card disc-card--catalog${variantClass}${popularClass}${unlockedClass} disc-card--photo" data-disc-id="${item.discId}">
      <div class="disc-card__visual">
        ${item.popular ? '<span class="disc-card__new">NEW</span>' : ''}
        ${buildDiscPhotoHtml(item, 'catalog')}
      </div>
      <div class="disc-card__meta">
        <div class="disc-card__meta-head">
          <h3 class="disc-card__creator">${escapeHtml(item.discName.toUpperCase())}</h3>
        </div>
        <div class="disc-card__actions">
          ${buildDiscLockHtml(item.discId)}
          <button type="button" class="disc-card__claim">${unlocked ? 'Odbierz swój dysk' : 'Odbierz'}</button>
        </div>
      </div>
    </article>
  `;
  }

  return `
    <article class="disc-card disc-card--catalog${variantClass}${popularClass}${unlockedClass} disc-card--photo" data-disc-id="${item.discId}" data-disc-creator="${escapeHtml(creator.toLowerCase())}" data-disc-locked="${unlocked ? '0' : '1'}">
      <div class="disc-card__visual">
        ${item.popular ? '<span class="disc-card__new">NEW</span>' : ''}
        ${buildDiscPhotoHtml(item, 'catalog')}
      </div>
      <div class="disc-card__meta">
        <div class="disc-card__meta-head">
          <h3 class="disc-card__creator">${escapeHtml(creator.toUpperCase())}</h3>
        </div>
        <div class="disc-card__actions">
          ${buildDiscLockHtml(item.discId)}
          <button type="button" class="disc-card__claim">${unlocked ? 'Odbierz swój dysk' : 'Odbierz'}</button>
        </div>
      </div>
    </article>
  `;
}

function getFilteredDiscGridItems() {
  const q = discCatalogSearch.trim().toLowerCase();
  return getDiscGridItems().filter((item) => {
    const creator = getDiscCreatorName(item.gridIndex ?? 0).toLowerCase();
    if (q && !creator.includes(q) && !item.discName.toLowerCase().includes(q)) return false;
    const unlocked = isDiscUnlocked(item.discId);
    if (discCatalogFilter === 'unlocked' && !unlocked) return false;
    if (discCatalogFilter === 'locked' && unlocked) return false;
    return true;
  });
}

function initDiscCatalog() {
  const search = document.getElementById('discs-catalog-search');
  search?.addEventListener('input', () => {
    discCatalogSearch = search.value;
    renderDiscGrid();
  });

  document.querySelectorAll('[data-disc-filter]').forEach((tab) => {
    tab.addEventListener('click', () => {
      discCatalogFilter = tab.dataset.discFilter || 'all';
      document.querySelectorAll('.discs-catalog__tab').forEach((t) => {
        t.classList.toggle('is-active', t.dataset.discFilter === discCatalogFilter);
      });
      renderDiscGrid();
    });
  });
}

function findDiscItemById(discId) {
  if (!discId) return null;
  return (
    getDiscGridItems().find((i) => i.discId === discId) ||
    DISC_CAROUSEL_ITEMS.find((i) => i.discId === discId) ||
    null
  );
}

function bindDiscClaimButtons(container) {
  if (!container) return;
  container.querySelectorAll('.disc-card__claim').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.disc-card');
      const item = findDiscItemById(card?.dataset.discId);
      if (item) openDiscPurchase(item);
    });
  });
}

function resetDiscPurchaseModal() {
  const payStep = document.getElementById('disc-purchase-step-pay');
  const claimStep = document.getElementById('disc-purchase-step-claim');
  const subtitle = document.querySelector('#disc-purchase-modal .token-modal__subtitle');

  if (payStep) payStep.hidden = false;
  if (claimStep) claimStep.hidden = true;
  if (subtitle) subtitle.textContent = 'Odblokuj zawartość dysku za żetony';
}

function showDiscClaimStep(item) {
  const payStep = document.getElementById('disc-purchase-step-pay');
  const claimStep = document.getElementById('disc-purchase-step-claim');
  const linkInput = document.getElementById('disc-purchase-link');
  const subtitle = document.querySelector('#disc-purchase-modal .token-modal__subtitle');
  const discLink = getDiscLink(item);

  if (payStep) payStep.hidden = true;
  if (claimStep) claimStep.hidden = false;
  if (subtitle) subtitle.textContent = 'Twój dysk jest gotowy do odebrania';
  if (linkInput) {
    linkInput.value = discLink || '';
    linkInput.placeholder = discLink ? '' : 'Link zostanie uzupełniony';
  }
}

async function copyDiscLink() {
  const input = document.getElementById('disc-purchase-link');
  const link = input?.value || getDiscLink(pendingDiscPurchase);
  if (!link) {
    showToast('Link do dysku nie jest jeszcze skonfigurowany.');
    return;
  }
  try {
    await navigator.clipboard.writeText(link);
    showToast('Link skopiowany do schowka.');
  } catch {
    input?.select();
    showToast('Zaznaczono link — skopiuj ręcznie (Ctrl+C).');
  }
}

function claimDisc() {
  const item = pendingDiscPurchase;
  const link = getDiscLink(item);
  if (!link) {
    showToast('Link do dysku nie jest jeszcze skonfigurowany.');
    return;
  }
  const name = item?.discName || 'dysk';
  window.open(link, '_blank', 'noopener,noreferrer');
  closeDiscPurchase();
  showToast(`Otwarto ${name}.`);
}

function unlockDiscViaAd() {
  if (!pendingDiscPurchase) return;

  const adLink = getDiscAdLink();
  if (adLink) {
    window.open(adLink, '_blank', 'noopener,noreferrer');
    showToast('Otwarto reklamę — po obejrzeniu odbierz dysk poniżej.');
  } else {
    showToast('Link do reklamy zostanie uzupełniony wkrótce.');
  }

  markDiscUnlocked(pendingDiscPurchase.discId);
  showDiscClaimStep(pendingDiscPurchase);
}

function openDiscPurchase(item) {
  const modal = document.getElementById('disc-purchase-modal');
  if (!modal) return;

  pendingDiscPurchase = item;

  const title = document.getElementById('disc-purchase-title');
  const preview = document.getElementById('disc-purchase-preview');
  const balanceEl = document.getElementById('disc-purchase-balance');
  const alreadyUnlocked = isDiscUnlocked(item.discId);

  if (title) title.textContent = item.discName;

  if (preview) {
    preview.innerHTML = item.image
      ? `<img src="${item.image}" alt="" class="disc-purchase__photo" loading="lazy">`
      : '<span class="disc-purchase__disc" aria-hidden="true"></span>';
  }

  if (alreadyUnlocked) {
    showDiscClaimStep(item);
  } else {
    resetDiscPurchaseModal();
    if (balanceEl) balanceEl.textContent = getTokenBalance().toLocaleString('pl-PL');
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  closeWalletDropdown();
}

function closeDiscPurchase() {
  const modal = document.getElementById('disc-purchase-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  pendingDiscPurchase = null;
  resetDiscPurchaseModal();
}

function confirmDiscPurchase() {
  if (!pendingDiscPurchase) return;

  const balance = getTokenBalance();
  if (balance < DISC_UNLOCK_COST) {
    showToast(`Potrzebujesz ${DISC_UNLOCK_COST} żetonów, aby odebrać dysk.`);
    closeDiscPurchase();
    openTokenShop();
    return;
  }

  const newBalance = setTokenBalance(balance - DISC_UNLOCK_COST);
  updateTokenUI(newBalance);
  updateInboxPricingBalance();
  renderInboxPricingShop();
  markDiscUnlocked(pendingDiscPurchase.discId);
  showDiscClaimStep(pendingDiscPurchase);
  showToast(`Odblokowano za ${DISC_UNLOCK_COST} żetonów. Stan: ${newBalance.toLocaleString('pl-PL')}`);
}

function initDiscPurchase() {
  const modalClose = document.getElementById('disc-purchase-close');
  const modalBackdrop = document.getElementById('disc-purchase-backdrop');
  const confirmBtn = document.getElementById('disc-purchase-confirm');
  const tokensBtn = document.getElementById('disc-purchase-tokens');
  const claimBtn = document.getElementById('disc-purchase-claim');
  const linkCopyBtn = document.getElementById('disc-purchase-link-copy');

  modalClose?.addEventListener('click', closeDiscPurchase);
  modalBackdrop?.addEventListener('click', closeDiscPurchase);
  confirmBtn?.addEventListener('click', confirmDiscPurchase);
  document.getElementById('disc-purchase-ad')?.addEventListener('click', unlockDiscViaAd);
  claimBtn?.addEventListener('click', claimDisc);
  linkCopyBtn?.addEventListener('click', copyDiscLink);
  tokensBtn?.addEventListener('click', () => {
    closeDiscPurchase();
    openTokenShop();
  });
}

function renderDiscGrid() {
  const grid = document.getElementById('discs-grid');
  if (!grid) return;

  const items = getFilteredDiscGridItems();
  grid.innerHTML = items.map((item) => buildDiscClaimCardHtml(item, 'grid')).join('');
  bindDiscClaimButtons(grid);

  const totalEl = document.getElementById('discs-catalog-total');
  if (totalEl) totalEl.textContent = formatDiscCount(items.length);
}

function renderDiscCarousel() {
  const track = document.getElementById('disc-carousel-track');
  if (!track) return;

  const oneSet = DISC_CAROUSEL_ITEMS.map((item) => buildDiscClaimCardHtml(item, 'carousel')).join('');
  track.innerHTML = oneSet.repeat(8);

  bindDiscClaimButtons(track);

  initDiscCarouselDrag();
}

function initDiscCarouselDrag() {
  const carousel = document.querySelector('.hero__carousel');
  const track = document.getElementById('disc-carousel-track');
  if (!carousel || !track || carousel.dataset.dragReady) return;

  carousel.dataset.dragReady = '1';

  const AUTO_SCROLL_SPEED = 0.65;
  const MOMENTUM_FRICTION = 0.96;
  const MOMENTUM_FROM_DRAG = 0.4;
  const SET_COUNT = DISC_CAROUSEL_ITEMS.length;

  let activePointer = null;
  let isDragging = false;
  let startX = 0;
  let offsetStart = 0;
  let dragDistance = 0;
  let lastMoveX = 0;
  let lastMoveTime = 0;
  let dragVelocity = 0;
  let momentum = 0;
  let offset = 0;
  let segment = 0;
  let lastFrame = performance.now();

  const measureSegment = () => {
    const cards = track.querySelectorAll('.disc-card');
    if (cards.length > SET_COUNT && cards[SET_COUNT]) {
      segment = cards[SET_COUNT].offsetLeft;
    } else {
      segment = track.scrollWidth / 8;
    }
  };

  const wrapOffset = () => {
    if (segment <= 0) return;
    offset = ((offset % segment) + segment) % segment;
    if (offset !== 0) offset -= segment;
  };

  const applyOffset = () => {
    track.style.transform = `translate3d(${offset.toFixed(2)}px, 0, 0)`;
  };

  const tick = (now) => {
    const dt = Math.min((now - lastFrame) / 16.667, 2.5);
    lastFrame = now;

    if (!isDragging) {
      if (Math.abs(momentum) > 0.015) {
        momentum *= MOMENTUM_FRICTION;
      } else {
        momentum = 0;
      }
      offset -= (AUTO_SCROLL_SPEED + momentum) * dt;
      wrapOffset();
      applyOffset();
    }
    requestAnimationFrame(tick);
  };

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    activePointer = null;
    momentum = -dragVelocity * MOMENTUM_FROM_DRAG;
    carousel.classList.remove('is-dragging');
  };

  carousel.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('.disc-card__claim')) return;

    activePointer = e.pointerId;
    isDragging = true;
    startX = e.clientX;
    offsetStart = offset;
    lastMoveX = e.clientX;
    lastMoveTime = performance.now();
    dragVelocity = 0;
    momentum = 0;
    dragDistance = 0;
    carousel.classList.add('is-dragging');
    carousel.setPointerCapture(e.pointerId);
  });

  carousel.addEventListener('pointermove', (e) => {
    if (activePointer === null || e.pointerId !== activePointer) return;

    const now = performance.now();
    const dt = now - lastMoveTime;
    if (dt > 0) {
      const stepX = e.clientX - lastMoveX;
      dragVelocity = (stepX / dt) * (1000 / 60);
    }
    lastMoveX = e.clientX;
    lastMoveTime = now;

    const dx = e.clientX - startX;
    dragDistance = Math.max(dragDistance, Math.abs(dx));
    offset = offsetStart + dx;
    wrapOffset();
    applyOffset();

    if (dragDistance > 4) e.preventDefault();
  });

  carousel.addEventListener('pointerup', endDrag);
  carousel.addEventListener('pointercancel', endDrag);
  carousel.addEventListener('lostpointercapture', endDrag);

  track.querySelectorAll('.disc-card').forEach((btn) => {
    btn.addEventListener(
      'click',
      (e) => {
        if (dragDistance > 8) {
          e.preventDefault();
          e.stopPropagation();
        }
        dragDistance = 0;
      },
      true
    );
  });

  const start = () => {
    measureSegment();
    offset = 0;
    wrapOffset();
    applyOffset();
    lastFrame = performance.now();
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(start);
  window.addEventListener('resize', () => {
    measureSegment();
    wrapOffset();
    applyOffset();
  });
}

function buildTokenPackagesHTML() {
  return TOKEN_PACKAGES.map(
    (pack) => `
    <button type="button" class="token-package${pack.popular ? ' token-package--popular' : ''}" data-pack-id="${pack.id}">
      <div class="token-package__info">
        <div class="token-package__amount">
          ${pack.tokens} żetonów
          ${pack.popular ? '<span class="token-package__badge">Popularne</span>' : ''}
        </div>
        ${pack.bonus ? `<p class="token-package__bonus">${pack.bonus}</p>` : ''}
      </div>
      <span class="token-package__price">${pack.price}</span>
      <!-- AFFILIATE / PAYMENT LINK — pack ${pack.id} -->
      <span class="token-package__buy">Kup</span>
    </button>
  `
  ).join('');
}

function bindTokenPackageButtons(container, onBuy) {
  if (!container) return;
  container.querySelectorAll('.token-package').forEach((btn) => {
    btn.addEventListener('click', () => onBuy(btn.dataset.packId));
  });
}

function renderTokenPackages() {
  const container = document.getElementById('token-packages');
  if (!container) return;
  container.innerHTML = buildTokenPackagesHTML();
  bindTokenPackageButtons(container, (packId) => {
    purchaseTokenPack(packId);
    closeTokenShop();
    closeWalletDropdown();
  });
}

function updateInboxPricingBalance() {
  const el = document.getElementById('inbox-pricing-balance');
  if (el) el.textContent = getTokenBalance().toLocaleString('pl-PL');
}

function renderInboxPricingShop() {
  const shop = document.getElementById('inbox-pricing-shop');
  if (!shop) return;

  const balance = getTokenBalance();
  shop.innerHTML = PRICING_SHOP_ITEMS.map(
    (item) => `
    <button type="button" class="pricing-shop-item" data-shop-id="${item.id}" ${balance < item.cost ? 'disabled' : ''}>
      <span>
        <span class="pricing-shop-item__name">${item.name}</span>
        <span class="pricing-shop-item__desc">${item.desc}</span>
      </span>
      <span class="pricing-shop-item__cost"><span>${item.cost}</span> żetonów</span>
    </button>
  `
  ).join('');

  shop.querySelectorAll('.pricing-shop-item').forEach((btn) => {
    btn.addEventListener('click', () => purchaseShopItem(btn.dataset.shopId));
  });
}

function purchaseShopItem(shopId) {
  const item = PRICING_SHOP_ITEMS.find((i) => i.id === shopId);
  if (!item) return;

  if (shopId === 'shop-rose') {
    closeInboxPricing();
    if (window.AiChat?.openRoseGiftModal) {
      window.AiChat.openRoseGiftModal();
    } else {
      showToast('Otwórz rozmowę z koleżanką, aby wysłać różę.');
    }
    return;
  }

  const balance = getTokenBalance();
  if (balance < item.cost) {
    showToast('Za mało żetonów — doładuj portfel w sekcji poniżej.');
    return;
  }

  setTokenBalance(balance - item.cost);
  updateInboxPricingBalance();
  renderInboxPricingShop();
  showToast(`Kupiono: ${item.name} (−${item.cost} żetonów)`);
}

function openInboxPricing() {
  const thread = document.getElementById('inbox-thread');
  const pricing = document.getElementById('inbox-pricing');
  const openBtn = document.getElementById('inbox-pricing-open');
  const affiliate = document.getElementById('inbox-thread-affiliate');

  if (!thread || !pricing) return;

  affiliate.hidden = true;
  const composer = document.querySelector('.inbox-thread__composer');
  if (composer) composer.style.visibility = '';

  thread.classList.add('is-pricing-open');
  pricing.hidden = false;
  openBtn?.classList.add('is-active');

  updateInboxPricingBalance();
  const packagesEl = document.getElementById('inbox-pricing-packages');
  if (packagesEl) {
    packagesEl.innerHTML = buildTokenPackagesHTML();
    bindTokenPackageButtons(packagesEl, (packId) => {
      purchaseTokenPack(packId);
      updateInboxPricingBalance();
      renderInboxPricingShop();
    });
  }
  renderInboxPricingShop();
}

function closeInboxPricing() {
  const thread = document.getElementById('inbox-thread');
  const pricing = document.getElementById('inbox-pricing');
  const openBtn = document.getElementById('inbox-pricing-open');

  thread?.classList.remove('is-pricing-open');
  if (pricing) pricing.hidden = true;
  openBtn?.classList.remove('is-active');
}

function openTokenShop() {
  const modal = document.getElementById('token-modal');
  if (!modal) return;
  updateTokenUI(getTokenBalance());
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  closeWalletDropdown();
  closeProfileMenu();
  closeAuthModal();
}

function closeTokenShop() {
  const modal = document.getElementById('token-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function closeWalletDropdown() {
  const dropdown = document.getElementById('wallet-dropdown');
  const trigger = document.getElementById('wallet-trigger');
  if (!dropdown || !trigger) return;
  dropdown.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
}

function closeProfileMenu() {
  const dropdown = document.getElementById('profile-menu-dropdown');
  const trigger = document.getElementById('profile-menu-trigger');
  if (!dropdown || !trigger) return;
  dropdown.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
}

function toggleProfileMenu() {
  const dropdown = document.getElementById('profile-menu-dropdown');
  const trigger = document.getElementById('profile-menu-trigger');
  if (!dropdown || !trigger) return;
  const open = dropdown.hidden;
  dropdown.hidden = !open;
  trigger.setAttribute('aria-expanded', String(open));
  if (open) closeWalletDropdown();
}

function initProfileMenu() {
  const trigger = document.getElementById('profile-menu-trigger');
  const menu = document.getElementById('profile-menu');

  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleProfileMenu();
  });

  document.getElementById('profile-menu-account')?.addEventListener('click', () => {
    closeProfileMenu();
  });


  document.getElementById('profile-menu-logout')?.addEventListener('click', async () => {
    closeProfileMenu();
    if (window.DyskiAuth) await window.DyskiAuth.signOut();
    setAuthPanelMode('register');
    updateRegisterUI();
    showToast('Wylogowano.');
    closeRegisterPanel();
  });

  document.addEventListener('click', (e) => {
    if (!menu?.contains(e.target)) closeProfileMenu();
  });
}

function toggleWalletDropdown() {
  const dropdown = document.getElementById('wallet-dropdown');
  const trigger = document.getElementById('wallet-trigger');
  if (!dropdown || !trigger) return;
  const open = dropdown.hidden;
  dropdown.hidden = !open;
  trigger.setAttribute('aria-expanded', String(open));
  if (open) updateTokenUI(getTokenBalance());
}

function initWallet() {
  updateTokenUI(getTokenBalance());
  renderTokenPackages();

  const trigger = document.getElementById('wallet-trigger');
  const openShopBtns = document.querySelectorAll('.js-open-token-shop');
  const modalClose = document.getElementById('token-modal-close');
  const modalBackdrop = document.getElementById('token-modal-backdrop');
  const wallet = document.getElementById('wallet');

  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleWalletDropdown();
  });

  openShopBtns.forEach((btn) => btn.addEventListener('click', () => openTokenShop()));

  modalClose?.addEventListener('click', closeTokenShop);
  modalBackdrop?.addEventListener('click', closeTokenShop);

  document.addEventListener('click', (e) => {
    if (!wallet?.contains(e.target)) closeWalletDropdown();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDiscPurchase();
      closeEditModal();
      closeAuthModal();
      closeTokenShop();
      closeProfileMenu();
      closeWalletDropdown();
      closeInbox();
    }
  });
}

function getStoredUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  const toggle = document.getElementById('register-toggle');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.getElementById('token-modal')?.classList.contains('is-open')) {
    document.body.style.overflow = '';
  }
  toggle?.setAttribute('aria-expanded', 'false');
}

function openAuthModal(mode = 'register') {
  if (getCurrentUser()) return;
  const modal = document.getElementById('auth-modal');
  const toggle = document.getElementById('register-toggle');
  if (!modal) return;

  closeWalletDropdown();
  closeProfileMenu();
  closeTokenShop();
  closeDiscPurchase();
  setAuthPanelMode(mode);

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  toggle?.setAttribute('aria-expanded', 'true');
}

function closeRegisterPanel() {
  closeAuthModal();
}

function toggleRegisterPanel() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  if (modal.classList.contains('is-open')) closeAuthModal();
  else openAuthModal('register');
}

function setAuthPanelMode(mode) {
  if (getCurrentUser()) return;

  const isLogin = mode === 'login';
  const regPanel = document.getElementById('auth-panel-register');
  const loginPanel = document.getElementById('auth-panel-login');
  const tabRegister = document.getElementById('auth-tab-register');
  const tabLogin = document.getElementById('auth-tab-login');
  const subtitle = document.getElementById('auth-modal-subtitle');
  const modal = document.getElementById('auth-modal');

  if (modal) modal.dataset.authMode = mode;

  if (subtitle) {
    subtitle.textContent = isLogin
      ? 'Wpisz login lub e-mail oraz hasło.'
      : 'Nazwa użytkownika (krótka), e-mail i hasło — załóż konto na DyskiHub.pl.';
  }

  if (regPanel) regPanel.hidden = isLogin;
  if (loginPanel) loginPanel.hidden = !isLogin;

  if (tabRegister) {
    tabRegister.classList.toggle('is-active', !isLogin);
    tabRegister.setAttribute('aria-selected', String(!isLogin));
  }
  if (tabLogin) {
    tabLogin.classList.toggle('is-active', isLogin);
    tabLogin.setAttribute('aria-selected', String(isLogin));
  }

  showRegisterError('');
  showLoginError('');

  if (!isLogin) {
    const regUsername = document.getElementById('reg-username');
    if (regUsername) delete regUsername.dataset.userEdited;
  }
}

function updateRegisterUI() {
  const user = getCurrentUser();
  const toggle = document.getElementById('register-toggle');

  if (!toggle) return;

  const sidebarName = document.getElementById('sidebar-username');
  if (sidebarName) {
    sidebarName.textContent = user ? user.username.toUpperCase() : 'GOŚĆ';
  }

  const profileAvatar = document.getElementById('profile-menu-avatar');
  if (profileAvatar) {
    profileAvatar.textContent = user
      ? user.username.charAt(0).toUpperCase()
      : 'G';
  }

  const inviteBtn = document.getElementById('invite-friend');
  const inviteHint = document.getElementById('invite-hint');

  const adminLink = document.getElementById('profile-menu-admin');

  if (user) {
    toggle.hidden = true;
    closeAuthModal();
    if (inviteHint) inviteHint.hidden = false;
    if (inviteBtn) inviteBtn.hidden = false;
    if (adminLink) {
      const isAdmin = Boolean(window.DyskiAuth?.isAdminSession());
      adminLink.hidden = !isAdmin;
      adminLink.style.display = isAdmin ? '' : 'none';
    }
    const inviteInput = document.getElementById('invite-link-input');
    if (inviteInput) inviteInput.value = getInviteReferralLink();
  } else {
    if (adminLink) {
      adminLink.hidden = true;
      adminLink.style.display = 'none';
    }
    toggle.hidden = false;
    toggle.textContent = 'Dołącz za darmo →';
    if (inviteHint) inviteHint.hidden = true;
    if (inviteBtn) inviteBtn.hidden = true;
    hideInviteLinkPanel();
    setAuthPanelMode(document.getElementById('auth-modal')?.dataset.authMode || 'register');
  }

  refreshAccountPageData();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showRegisterError(message) {
  const el = document.getElementById('register-error');
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.hidden = false;
  } else {
    el.hidden = true;
    el.textContent = '';
  }
}

function showLoginError(message) {
  const el = document.getElementById('login-error');
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.hidden = false;
  } else {
    el.hidden = true;
    el.textContent = '';
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  showLoginError('');

  const identifier = document.getElementById('login-identifier')?.value.trim();
  const password = document.getElementById('login-password')?.value;

  if (!identifier || !password) {
    showLoginError('Wpisz login (lub e-mail) i hasło.');
    return;
  }

  if (!window.DyskiAuth) {
    showLoginError('Logowanie niedostępne — brak połączenia z serwerem.');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    await window.DyskiAuth.signIn({ identifier, password });
    const user = getCurrentUser();
    e.target.reset();
    setAuthPanelMode('register');
    updateRegisterUI();
    showToast(`Witaj ponownie, ${user?.username || ''}!`);
    closeRegisterPanel();
    closeSidebarMenu();
  } catch (err) {
    showLoginError(err.message || 'Nieprawidłowy login lub hasło.');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  showRegisterError('');

  const username = document.getElementById('reg-username')?.value.trim();
  const email = document.getElementById('reg-email')?.value.trim().toLowerCase();
  const password = document.getElementById('reg-password')?.value;
  const passwordConfirm = document.getElementById('reg-password-confirm')?.value;

  if (!username || !USERNAME_REGEX.test(username)) {
    showRegisterError('Nazwa użytkownika: 3–32 znaki (litery, cyfry, kropka, myślnik, podkreślnik). To nie jest pole e-mail.');
    return;
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showRegisterError('Podaj prawidłowy adres e-mail.');
    return;
  }

  if (!password) {
    showRegisterError('Wpisz hasło.');
    return;
  }

  if (password !== passwordConfirm) {
    showRegisterError('Hasła nie są identyczne.');
    return;
  }

  if (!window.DyskiAuth) {
    showRegisterError('Rejestracja niedostępna — brak połączenia z serwerem.');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const pendingRef = sessionStorage.getItem(PENDING_REF_KEY) || null;
    const result = await window.DyskiAuth.signUp({
      username,
      email,
      password,
      referredBy: pendingRef,
    });

    if (pendingRef) {
      attributeReferralOnRegister({ username, email, referredBy: pendingRef });
    }

    if (!result.session) {
      showRegisterError('Konto utworzone. Sprawdź e-mail i potwierdź rejestrację, potem się zaloguj.');
      setAuthPanelMode('login');
      return;
    }

    e.target.reset();
    updateRegisterUI();
    showToast(`Witaj, ${username}! Konto zostało utworzone.`);
    closeRegisterPanel();
    closeSidebarMenu();
  } catch (err) {
    showRegisterError(err.message || 'Nie udało się utworzyć konta.');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function closeSidebarMenu() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const navToggle = document.getElementById('nav-toggle');
  sidebar?.classList.remove('is-open');
  backdrop?.setAttribute('hidden', '');
  navToggle?.classList.remove('active');
  navToggle?.setAttribute('aria-expanded', 'false');
}

function initRegister() {
  const toggle = document.getElementById('register-toggle');
  const form = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');
  const modal = document.getElementById('auth-modal');

  updateRegisterUI();

  toggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (getCurrentUser()) return;
    if (modal?.classList.contains('is-open')) closeAuthModal();
    else openAuthModal('register');
  });

  document.getElementById('auth-modal-close')?.addEventListener('click', closeAuthModal);
  document.getElementById('auth-modal-backdrop')?.addEventListener('click', closeAuthModal);

  document.querySelectorAll('.auth-modal__tab').forEach((tab) => {
    tab.addEventListener('click', () => setAuthPanelMode(tab.dataset.authTab || 'register'));
  });

  loginForm?.addEventListener('submit', handleLoginSubmit);

  document.getElementById('invite-friend')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!getCurrentUser()) {
      showToast('Zaloguj się, aby uzyskać link polecający.');
      return;
    }
    showInviteLinkPanel();
  });

  document.getElementById('invite-link-copy')?.addEventListener('click', (e) => {
    e.stopPropagation();
    copyInviteLink();
  });

  form?.addEventListener('submit', handleRegisterSubmit);

  const regEmail = document.getElementById('reg-email');
  const regUsername = document.getElementById('reg-username');
  if (regEmail && regUsername) {
    regUsername.addEventListener('input', () => {
      regUsername.dataset.userEdited = '1';
    });
    regEmail.addEventListener('input', () => {
      if (regUsername.dataset.userEdited) return;
      const local = regEmail.value.split('@')[0] || '';
      const suggested = local
        .replace(/[^a-zA-Z0-9_.\-\u00C0-\u024F]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, USERNAME_MAX_LEN);
      if (suggested.length >= 3) regUsername.value = suggested;
    });
  }
}

function setSidebarActiveLink(activeId) {
  document.querySelectorAll('.sidebar__link').forEach((link) => {
    if (activeId === 'open-inbox') {
      link.classList.toggle('is-active', link.id === 'open-inbox');
    } else {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${activeId}`);
    }
  });
}

function initSidebarCollapse() {
  const shell = document.getElementById('app-shell');
  const btn = document.getElementById('sidebar-collapse');
  if (!shell || !btn) return;

  const setCollapsed = (collapsed) => {
    shell.classList.toggle('sidebar-collapsed', collapsed);
    btn.setAttribute('aria-expanded', String(!collapsed));
    const label = collapsed ? 'Rozwiń menu' : 'Zwiń menu';
    btn.setAttribute('aria-label', label);
    btn.title = label;
  };

  setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');

  btn.addEventListener('click', () => {
    const collapsed = !shell.classList.contains('sidebar-collapsed');
    setCollapsed(collapsed);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    closeRegisterPanel();
    closeWalletDropdown();
  });
}

function initNavbar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('nav');

  toggle?.addEventListener('click', () => {
    const open = !sidebar?.classList.contains('is-open');
    sidebar?.classList.toggle('is-open', open);
    if (open) backdrop?.removeAttribute('hidden');
    else backdrop?.setAttribute('hidden', '');
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-expanded', String(open));
    closeWalletDropdown();
    if (!open) closeRegisterPanel();
  });

  backdrop?.addEventListener('click', closeSidebarMenu);

  nav?.querySelectorAll('.sidebar__link').forEach((link) => {
    link.addEventListener('click', () => {
      closeSidebarMenu();
      closeRegisterPanel();
      if (link.id !== 'open-inbox') {
        closeInbox();
        const hash = link.getAttribute('href')?.replace('#', '') || '';
        if (hash) setSidebarActiveLink(hash);
      }
    });
  });

  const sectionIds = ['hero', 'profiles', 'discs', 'gry', 'komiksy', 'about', 'contact'];
  const onScroll = () => {
    if (document.getElementById('inbox')?.classList.contains('is-open')) return;
    let current = 'hero';
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      if (top <= 120) current = id;
    }
    setSidebarActiveLink(current);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

}

function renderTopProfiles() {
  const list = document.getElementById('top-profiles-list');
  if (!list) return;

  list.innerHTML = profiles
    .map(
      (p) => `
    <li class="rail-list__item">
      <div class="rail-item">
        <div class="rail-item__avatar-wrap">
          <img src="${escapeHtml(p.image)}" alt="" class="rail-item__thumb" width="48" height="48" loading="lazy" onerror="this.style.display='none';this.nextElementSibling?.classList.add('is-visible')">
          <span class="rail-item__thumb-placeholder" aria-hidden="true">${PERSON_ICON}</span>
          <span class="rail-item__flare rail-item__flare--${p.available ? 'online' : 'offline'}" title="${p.available ? 'Dostępna' : 'Niedostępna'}"></span>
        </div>
        <div class="rail-item__body">
          <span class="rail-item__name">${escapeHtml(p.name)}, ${p.age}</span>
          <span class="rail-item__meta">${p.aktywnosci} aktywności · ${escapeHtml(p.city)}</span>
        </div>
        <button type="button" class="rail-item__msg" data-profile-id="${p.id}" aria-label="Wiadomości do ${escapeHtml(p.name)}">
          Wiadomości
        </button>
      </div>
    </li>
  `
    )
    .join('');

  list.querySelectorAll('.rail-item__msg').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openInbox(Number(btn.dataset.profileId));
    });
  });
}

function renderDashboardPlans() {
  const el = document.getElementById('dashboard-plans');
  if (!el) return;

  const items = [
    {
      href: '#profiles',
      tag: 'Społeczność',
      title: 'Profile',
      desc: 'Przeglądaj karty singli i zacznij rozmowę',
      btn: 'Zobacz profile →',
      best: false,
    },
    {
      href: '#discs',
      tag: 'Żetony',
      title: 'Dyski',
      desc: 'Wybierz dysk i doładuj konto żetonami',
      btn: 'Zobacz dyski →',
      best: true,
      ribbon: 'Polecane',
    },
  ];

  el.innerHTML = items
    .map(
      ({ href, tag, title, desc, btn, best, ribbon }) => `
      <a href="${href}" class="plan-card plan-card--link${best ? ' plan-card--best' : ''}">
        ${ribbon ? `<span class="plan-card__ribbon">${ribbon}</span>` : ''}
        <span class="plan-card__days">${tag}</span>
        <p class="plan-card__credits"><strong>${title}</strong></p>
        <p class="plan-card__bonus">${desc}</p>
        <span class="btn ${best ? 'btn--primary' : 'btn--ghost'} plan-card__btn">${btn}</span>
      </a>
    `
    )
    .join('');
}

/** Baner hero — podmień ścieżkę, gdy będziesz mieć docelowe grafiki */
const HERO_PLACEHOLDER_IMAGE = 'images/hero-placeholder.png';

function initHeroSlider() {
  const track = document.getElementById('hero-slider-track');
  if (!track || track.querySelector('.hero-slider__slide--placeholder')) return;

  track.innerHTML = `
    <div class="hero-slider__slide is-active hero-slider__slide--placeholder">
      <img src="${HERO_PLACEHOLDER_IMAGE}" alt="Baner — wkrótce" loading="eager">
    </div>
  `;
}

function openInbox(profileId = null) {
  const inbox = document.getElementById('inbox');
  if (!inbox) return;

  inbox.classList.add('is-open');
  inbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('inbox-open');
  if (window.location.hash !== '#messages') {
    history.replaceState(null, '', '#messages');
  }
  closeWalletDropdown();
  closeRegisterPanel();
  closeTokenShop();

  closeSidebarMenu();
  setSidebarActiveLink('open-inbox');

  document.getElementById('inbox-sidebar')?.classList.remove('is-hidden-mobile');
  const emptyEl = document.getElementById('inbox-empty');
  if (emptyEl) emptyEl.style.display = '';

  renderInboxContacts();

  if (profileId) {
    selectInboxContact(profileId);
  } else if (window.innerWidth > 768 && profiles.length) {
    const withChat = profiles.find((p) => loadProfileChatHistory(p.id).length > 0);
    selectInboxContact(withChat ? withChat.id : profiles[0].id);
  } else {
    showInboxEmptyState();
  }
}

function closeInbox() {
  const inbox = document.getElementById('inbox');
  if (!inbox) return;

  inbox.classList.remove('is-open');
  inbox.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('inbox-open');
  activeInboxId = null;
  document.getElementById('inbox-sidebar')?.classList.remove('is-hidden-mobile');
  document.getElementById('inbox-chat')?.classList.remove('has-thread');

  if (window.location.hash === '#messages') {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }

  let current = 'hero';
  ['hero', 'profiles', 'discs', 'gry', 'komiksy', 'about', 'contact'].forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top <= 120) current = id;
  });
  setSidebarActiveLink(current);
}

function showInboxEmptyState() {
  const empty = document.getElementById('inbox-empty');
  const thread = document.getElementById('inbox-thread');
  const chat = document.getElementById('inbox-chat');
  const sidebar = document.getElementById('inbox-sidebar');

  thread.hidden = true;
  chat?.classList.remove('has-thread');
  sidebar?.classList.remove('is-hidden-mobile');

  if (window.innerWidth <= 768) {
    if (empty) empty.style.display = 'none';
  } else if (empty) {
    empty.style.display = '';
  }
}

function renderInboxContacts(filter = '') {
  const list = document.getElementById('inbox-contacts');
  if (!list) return;

  const q = filter.trim().toLowerCase();
  const filtered = profiles
    .filter((p) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        String(p.age).includes(q)
      );
    })
    .map((p) => ({ profile: p, meta: getInboxContactMeta(p) }))
    .sort((a, b) => b.meta.sortKey - a.meta.sortKey || a.profile.name.localeCompare(b.profile.name));

  list.innerHTML = filtered
    .map(({ profile: p, meta }) => {
      const isActive = activeInboxId === p.id;
      return `
      <li role="listitem">
        <button type="button" class="inbox-contact${isActive ? ' is-active' : ''}" data-inbox-id="${p.id}">
          <span class="inbox-contact__avatar-wrap">
            <img src="${p.image}" alt="" class="inbox-contact__avatar" width="52" height="52" loading="lazy">
            <span class="inbox-contact__online"></span>
          </span>
          <span class="inbox-contact__body">
            <span class="inbox-contact__row">
              <span class="inbox-contact__name">${p.name}, ${p.age}</span>
              <span class="inbox-contact__time">${meta.time}</span>
            </span>
            <span class="inbox-contact__preview">${meta.preview}</span>
          </span>
          ${meta.unread ? `<span class="inbox-contact__badge">${meta.unread}</span>` : ''}
        </button>
      </li>
    `;
    })
    .join('');

  list.querySelectorAll('.inbox-contact').forEach((btn) => {
    btn.addEventListener('click', () => selectInboxContact(Number(btn.dataset.inboxId)));
  });
}

async function selectInboxContact(profileId) {
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return;

  const thread = document.getElementById('inbox-thread');
  const wasAlreadyOpen = activeInboxId === profileId && thread && !thread.hidden;

  activeInboxId = profileId;
  closeInboxPricing();
  renderInboxContacts(document.getElementById('inbox-search')?.value || '');

  const empty = document.getElementById('inbox-empty');
  const chat = document.getElementById('inbox-chat');
  const sidebar = document.getElementById('inbox-sidebar');
  const affiliate = document.getElementById('inbox-thread-affiliate');
  const affiliateLink = document.getElementById('inbox-affiliate-link');
  const input = document.getElementById('inbox-thread-input');
  const composer = document.querySelector('.inbox-thread__composer');

  empty.style.display = 'none';
  thread.hidden = false;
  chat?.classList.add('has-thread');
  affiliate.hidden = true;
  if (composer) composer.style.visibility = 'visible';
  if (input) input.value = '';

  if (window.innerWidth <= 768) {
    sidebar?.classList.add('is-hidden-mobile');
  }

  document.getElementById('inbox-thread-avatar').src = profile.image;
  document.getElementById('inbox-thread-avatar').alt = profile.name;
  document.getElementById('inbox-thread-name').textContent = `${profile.name}, ${profile.age}`;

  if (affiliateLink) {
    affiliateLink.href = getAffiliateHref(profileId);
    affiliateLink.id = `affiliate-link-inbox-${profileId}`;
  }

  if (window.AiChat && !wasAlreadyOpen) {
    await window.AiChat.activateInbox(profileId);
  }
}

function showInboxAffiliateOverlay() {
  const affiliate = document.getElementById('inbox-thread-affiliate');
  const composer = document.querySelector('.inbox-thread__composer');
  if (affiliate) affiliate.hidden = false;
  if (composer) composer.style.visibility = 'hidden';
}

let inboxSendLocked = false;

async function sendInboxMessage() {
  const input = document.getElementById('inbox-thread-input');
  if (!input || !activeInboxId || !window.AiChat) return;
  if (window.AiChat.isPaused() || inboxSendLocked) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  inboxSendLocked = true;
  try {
    await window.AiChat.sendMessage(text);
  } finally {
    inboxSendLocked = false;
  }
}

function initInbox() {
  const openBtn = document.getElementById('open-inbox');
  const closeBtns = document.querySelectorAll('#inbox-close, #inbox-close-thread');
  const backBtn = document.getElementById('inbox-thread-back');
  const search = document.getElementById('inbox-search');
  const sendBtn = document.getElementById('inbox-thread-send');
  const input = document.getElementById('inbox-thread-input');

  openBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openInbox();
  });

  closeBtns.forEach((btn) => btn.addEventListener('click', closeInbox));
  backBtn?.addEventListener('click', () => {
    activeInboxId = null;
    showInboxEmptyState();
    renderInboxContacts(search?.value || '');
  });

  search?.addEventListener('input', () => renderInboxContacts(search.value));

  sendBtn?.addEventListener('click', sendInboxMessage);
  bindAttachButton(document.getElementById('inbox-thread-attach'));
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendInboxMessage();
    }
  });

  document.getElementById('inbox-pricing-open')?.addEventListener('click', () => {
    const pricing = document.getElementById('inbox-pricing');
    if (pricing?.hidden) openInboxPricing();
    else closeInboxPricing();
  });

  document.getElementById('inbox-pricing-back')?.addEventListener('click', closeInboxPricing);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('inbox')?.classList.contains('is-open')) {
      const pricing = document.getElementById('inbox-pricing');
      if (pricing && !pricing.hidden) closeInboxPricing();
      else closeInbox();
    }
  });

  if (window.location.hash === '#messages') {
    openInbox();
  }

  window.addEventListener('pageshow', () => {
    const inboxEl = document.getElementById('inbox');
    if (!inboxEl?.classList.contains('is-open')) return;
    const searchVal = document.getElementById('inbox-search')?.value || '';
    renderInboxContacts(searchVal);
  });

  window.addEventListener('hashchange', () => {
    const inboxEl = document.getElementById('inbox');
    if (window.location.hash === '#messages') {
      if (!inboxEl?.classList.contains('is-open')) openInbox();
    } else if (inboxEl?.classList.contains('is-open')) {
      inboxEl.classList.remove('is-open');
      inboxEl.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('inbox-open');
      activeInboxId = null;
      let current = 'hero';
      ['hero', 'profiles', 'discs', 'gry', 'komiksy', 'about', 'contact'].forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) current = id;
      });
      setSidebarActiveLink(current);
    }
  });
}

function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.fade-in, .profile-card').forEach((el) => {
    observer.observe(el);
  });
}

function safeInit(fn) {
  try {
    fn();
  } catch (err) {
    console.error(`Init failed: ${fn.name}`, err);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  safeInit(migrateChatStorageV2);
  safeInit(captureReferralFromUrl);

  if (window.DyskiAuth) {
    try {
      await window.DyskiAuth.initAuth();
    } catch (err) {
      console.error('Auth init failed', err);
    }
  }

  await loadProfiles();
  safeInit(shuffleProfiles);
  safeInit(renderProfiles);
  safeInit(renderDiscCarousel);
  safeInit(renderDiscGrid);
  safeInit(initDiscCatalog);
  safeInit(initProfileCatalog);
  safeInit(renderTopProfiles);
  safeInit(renderDashboardPlans);
  safeInit(initHeroSlider);
  safeInit(initRegister);
  safeInit(initInbox);
  safeInit(initSidebarCollapse);
  safeInit(initNavbar);
  safeInit(initWallet);
  safeInit(initProfileMenu);
  safeInit(initDiscPurchase);
  safeInit(initAccountPage);
  safeInit(initAccountSettingsPage);
  safeInit(initReferralPage);
  safeInit(initScrollAnimations);
  updateRegisterUI();
});

let editModalField = null;
let settingsEmailRevealed = false;

function maskEmail(email) {
  if (!email || !email.includes('@')) return '—';
  const [local, domain] = email.split('@');
  const show = Math.min(3, local.length);
  const stars = '*'.repeat(Math.max(5, local.length - show));
  return `${local.slice(0, show)}${stars}@${domain}`;
}

function getUserRecord() {
  const current = getCurrentUser();
  if (!current) return null;
  if (current.id) {
    return {
      username: current.username,
      email: current.email,
      id: current.id,
    };
  }
  const users = getStoredUsers();
  let found = users.find((u) => u.username.toLowerCase() === current.username.toLowerCase());
  if (found) return found;
  if (current.email) {
    found = users.find((u) => u.email?.toLowerCase() === current.email.toLowerCase());
    if (found) return found;
  }
  return null;
}

function getEditFormDefaults() {
  const record = getUserRecord();
  const current = getCurrentUser();
  return {
    username: record?.username || current?.username || '',
    email: record?.email || current?.email || '',
  };
}

function refreshAccountSettingsView() {
  const user = getUserRecord();
  const current = getCurrentUser();
  const usernameEl = document.getElementById('settings-username');
  const emailDisplay = document.getElementById('settings-email-display');
  const emailToggle = document.getElementById('settings-email-toggle');

  if (!usernameEl || !emailDisplay) return;

  const displayName = user?.username || current?.username;
  const displayEmail = user?.email || current?.email;

  if (!displayName && !displayEmail) {
    usernameEl.textContent = '—';
    emailDisplay.textContent = '—';
    if (emailToggle) emailToggle.hidden = true;
    return;
  }

  usernameEl.textContent = displayName || '—';
  if (displayEmail) {
    if (settingsEmailRevealed) {
      emailDisplay.textContent = displayEmail;
      if (emailToggle) {
        emailToggle.textContent = 'Ukryj';
        emailToggle.hidden = false;
      }
    } else {
      emailDisplay.textContent = maskEmail(displayEmail);
      if (emailToggle) {
        emailToggle.textContent = 'Pokaż';
        emailToggle.hidden = false;
      }
    }
  } else {
    emailDisplay.textContent = '—';
    if (emailToggle) emailToggle.hidden = true;
  }

  updateRegisterUI();
}

function showEditFormError(message) {
  const el = document.getElementById('edit-form-error');
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.hidden = false;
  } else {
    el.hidden = true;
    el.textContent = '';
  }
}

function buildEditFormFields(field) {
  const wrap = document.getElementById('edit-form-fields');
  if (!wrap) return;

  const { username, email } = getEditFormDefaults();

  if (field === 'username') {
    wrap.innerHTML = `
      <label class="register-form__label" for="edit-username">Nowa nazwa użytkownika</label>
      <input class="register-form__input" type="text" id="edit-username" value="${escapeHtml(username)}" maxlength="32" required autocomplete="username">
    `;
    return;
  }

  if (field === 'email') {
    wrap.innerHTML = `
      <label class="register-form__label" for="edit-email">Nowy adres e-mail</label>
      <input class="register-form__input" type="email" id="edit-email" value="${escapeHtml(email)}" required autocomplete="email">
    `;
    return;
  }

  if (field === 'password') {
    wrap.innerHTML = `
      <label class="register-form__label" for="edit-password-current">Aktualne hasło</label>
      <input class="register-form__input" type="password" id="edit-password-current" autocomplete="current-password" required>
      <label class="register-form__label" for="edit-password-new">Nowe hasło</label>
      <input class="register-form__input" type="password" id="edit-password-new" autocomplete="new-password" required>
      <label class="register-form__label" for="edit-password-confirm">Powtórz nowe hasło</label>
      <input class="register-form__input" type="password" id="edit-password-confirm" autocomplete="new-password" required>
    `;
  }
}

function openEditModal(field) {
  if (!getCurrentUser()) {
    openAuthModal('login');
    return;
  }

  const modal = document.getElementById('edit-modal');
  const title = document.getElementById('edit-modal-title');
  const subtitle = document.getElementById('edit-modal-subtitle');
  if (!modal) return;

  editModalField = field;
  showEditFormError('');

  const titles = {
    username: 'Zmień nazwę użytkownika',
    email: 'Zmień adres e-mail',
    password: 'Zmień hasło',
  };
  const subs = {
    username: 'Wpisz nową nazwę użytkownika (3–32 znaki).',
    email: 'Wpisz nowy adres e-mail powiązany z kontem.',
    password: 'Podaj aktualne hasło i ustaw nowe (min. 6 znaków).',
  };

  if (title) title.textContent = titles[field] || 'Edytuj';
  if (subtitle) subtitle.textContent = subs[field] || '';
  buildEditFormFields(field);

  closeWalletDropdown();
  closeProfileMenu();
  closeTokenShop();
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    document.querySelector('#edit-form-fields .register-form__input')?.focus();
  });
}

function closeEditModal() {
  const modal = document.getElementById('edit-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  editModalField = null;
  if (
    !document.getElementById('token-modal')?.classList.contains('is-open') &&
    !document.getElementById('auth-modal')?.classList.contains('is-open')
  ) {
    document.body.style.overflow = '';
  }
}

async function handleEditSubmit(e) {
  e.preventDefault();
  showEditFormError('');

  const user = getUserRecord();
  if (!user || !editModalField) {
    showEditFormError('Nie znaleziono konta. Zaloguj się ponownie.');
    return;
  }

  const useSupabase = Boolean(user.id && window.DyskiAuth);

  try {
    if (editModalField === 'username') {
      const username = document.getElementById('edit-username')?.value.trim();
      if (!username || !USERNAME_REGEX.test(username)) {
        showEditFormError('Nazwa: 3–32 znaki (litery, cyfry, kropka, myślnik, podkreślnik).');
        return;
      }
      if (useSupabase) {
        await window.DyskiAuth.updateUsername(username);
      } else {
        showEditFormError('Zaloguj się ponownie, aby zmienić nazwę.');
        return;
      }
      refreshAccountSettingsView();
      updateRegisterUI();
      showToast('Nazwa użytkownika została zmieniona.');
    }

    if (editModalField === 'email') {
      const email = document.getElementById('edit-email')?.value.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showEditFormError('Podaj prawidłowy adres e-mail.');
        return;
      }
      if (useSupabase) {
        await window.DyskiAuth.updateEmail(email);
      } else {
        showEditFormError('Zaloguj się ponownie, aby zmienić e-mail.');
        return;
      }
      settingsEmailRevealed = false;
      refreshAccountSettingsView();
      showToast('Adres e-mail został zmieniony.');
    }

    if (editModalField === 'password') {
      const next = document.getElementById('edit-password-new')?.value;
      const confirm = document.getElementById('edit-password-confirm')?.value;
      if (!next) {
        showEditFormError('Wpisz nowe hasło.');
        return;
      }
      if (next !== confirm) {
        showEditFormError('Nowe hasła nie są identyczne.');
        return;
      }
      if (useSupabase) {
        await window.DyskiAuth.updatePassword(next);
      } else {
        showEditFormError('Zaloguj się ponownie, aby zmienić hasło.');
        return;
      }
      showToast('Hasło zostało zmienione.');
    }

    closeEditModal();
  } catch (err) {
    showEditFormError(err.message || 'Nie udało się zapisać zmian.');
  }
}

function initAccountSettingsPage() {
  const page = document.getElementById('account-settings-page');
  if (!page || page.dataset.settingsReady) return;
  page.dataset.settingsReady = '1';

  page.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit]');
    if (!btn || !page.contains(btn)) return;
    e.preventDefault();
    openEditModal(btn.dataset.edit);
  });

  document.getElementById('edit-modal-close')?.addEventListener('click', closeEditModal);
  document.getElementById('edit-modal-backdrop')?.addEventListener('click', closeEditModal);
  document.getElementById('edit-form')?.addEventListener('submit', handleEditSubmit);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = document.getElementById('edit-modal');
    if (modal?.classList.contains('is-open')) closeEditModal();
  });

  updateRegisterUI();
  updateTokenUI(getTokenBalance());
  refreshAccountSettingsView();

  document.getElementById('settings-email-toggle')?.addEventListener('click', () => {
    settingsEmailRevealed = !settingsEmailRevealed;
    refreshAccountSettingsView();
  });

  document.getElementById('settings-disable-account')?.addEventListener('click', () => {
    showToast('Wyłączenie konta — funkcja demo (konto pozostaje aktywne).');
  });

  document.getElementById('settings-delete-account')?.addEventListener('click', async () => {
    if (!confirm('Na pewno chcesz trwale usunąć konto? Tej operacji nie można cofnąć.')) return;
    if (!getCurrentUser()) return;
    showToast('Usuwanie konta — skontaktuj się z administratorem (funkcja w przygotowaniu).');
  });
}

function setAccountTab(tabId) {
  const page = document.getElementById('account-page');
  if (!page) return;

  page.dataset.accountTab = tabId;

  document.querySelectorAll('.account-dashboard__tab').forEach((btn) => {
    const active = btn.dataset.accountTab === tabId;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  document.querySelectorAll('.account-dashboard__panel').forEach((panel) => {
    const show = panel.id === `account-tab-${tabId}`;
    panel.hidden = !show;
  });
}

function refreshAccountPageData() {
  const user = getCurrentUser();
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set('account-username', user ? user.username : 'Gość');
  set('account-email', user ? user.email : '—');
  set('account-tokens', getTokenBalance().toLocaleString('pl-PL'));
  syncTokenDisplay();
}

function refreshReferralPageData() {
  const user = getCurrentUser();
  const countEl = document.getElementById('referral-signup-count');
  const referralInput = document.getElementById('account-referral-input');
  const signupCount = user ? getReferralSignupCount(user.username) : 0;

  if (countEl) {
    countEl.textContent = signupCount.toLocaleString('pl-PL');
  }

  if (referralInput) {
    referralInput.value = user ? getInviteReferralLink() : '—';
  }

  document.querySelectorAll('.referral-tier').forEach((tierEl) => {
    const tier = Number(tierEl.dataset.tier);
    tierEl.classList.toggle('referral-tier--reached', signupCount >= tier);
  });
}

async function copyAccountReferralLink() {
  const input = document.getElementById('account-referral-input');
  const link = input?.value || getInviteReferralLink();
  if (!getCurrentUser()) {
    showToast('Zaloguj się, aby skopiować link polecający.');
    return;
  }
  try {
    await navigator.clipboard.writeText(link);
    showToast('Link skopiowany do schowka.');
  } catch {
    input?.select();
    showToast('Zaznaczono link — skopiuj ręcznie (Ctrl+C).');
  }
}

function initReferralPage() {
  const page = document.getElementById('referral-page');
  if (!page) return;

  if (!getCurrentUser()) {
    window.location.href = 'index.html';
    return;
  }

  updateRegisterUI();
  updateTokenUI(getTokenBalance());
  refreshReferralPageData();

  document.getElementById('account-referral-copy')?.addEventListener('click', copyAccountReferralLink);
}

function initAccountPage() {
  const page = document.getElementById('account-page');
  if (!page) return;

  updateRegisterUI();

  const accountLink = document.getElementById('profile-menu-account');
  if (accountLink) accountLink.classList.add('is-active');

  setAccountTab(page.dataset.accountTab || 'konto');

  document.querySelectorAll('.account-dashboard__tab[data-account-tab]').forEach((btn) => {
    btn.addEventListener('click', () => setAccountTab(btn.dataset.accountTab || 'konto'));
  });

  const hash = window.location.hash.replace('#', '');
  if (hash === 'settings') {
    window.location.href = 'ustawienia.html';
    return;
  }
  if (hash === 'referral') {
    window.location.href = 'linki-referencyjne.html';
    return;
  }
  if (hash === 'konto') {
    setAccountTab('konto');
  }
}
