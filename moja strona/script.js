/**
 * FlirtMatch — profile data & chat system
 * Edit profiles array to add/change cards. Replace #LINK_N with affiliate URLs.
 */

const MAX_OPEN_CHATS = 3;
const TOKEN_STORAGE_KEY = 'flirtmatch_tokens';
const SIDEBAR_COLLAPSED_KEY = 'flirtmatch_sidebar_collapsed';
const USERS_STORAGE_KEY = 'flirtmatch_users';
const CURRENT_USER_KEY = 'flirtmatch_current_user';
const DEFAULT_TOKENS = 25;

const USERNAME_REGEX = /^[a-zA-Z0-9_\u00C0-\u024F]{3,24}$/;

const TOKEN_PACKAGES = [
  { id: 'pack-50', tokens: 50, bonusTokens: 0, price: '19,99 zł', popular: false },
  { id: 'pack-120', tokens: 120, bonusTokens: 20, price: '39,99 zł', popular: true, bonus: '+20 żetonów gratis' },
  { id: 'pack-300', tokens: 300, bonusTokens: 50, price: '79,99 zł', popular: false, bonus: '+50 żetonów gratis' },
];

const DISC_GRID_PHOTOS = [
  'images/discs/disc-1.png',
  'images/discs/disc-2.png',
  'images/discs/disc-3.png',
  'images/discs/disc-4.png',
  'images/discs/disc-5.png',
];

/** Dyski w karuzeli hero — packId łączy z TOKEN_PACKAGES, image z DISC_GRID_PHOTOS */
const DISC_CAROUSEL_ITEMS = [
  { packId: 'pack-50', discName: 'Dysk Starter', tag: 'Start' },
  { packId: 'pack-120', discName: 'Dysk Gold', tag: 'Gold', popular: true },
  { packId: 'pack-300', discName: 'Dysk VIP', tag: 'VIP' },
  { packId: 'pack-50', discName: 'Dysk Classic', tag: 'Classic' },
  { packId: 'pack-120', discName: 'Dysk Premium', tag: 'Pro', popular: true },
  { packId: 'pack-300', discName: 'Dysk Max', tag: 'Max' },
].map((item, i) => ({
  ...item,
  image: DISC_GRID_PHOTOS[i % DISC_GRID_PHOTOS.length],
  discId: `disc-carousel-${i}`,
}));

const DISC_GRID_NAMES = [
  'Starter', 'Classic', 'Gold', 'VIP', 'Premium', 'Max', 'Pro', 'Elite', 'Plus', 'Nova',
  'Ultra', 'Mega', 'Prime', 'Boost', 'Flash', 'Pulse', 'Wave', 'Spark', 'Rush', 'Flow',
  'Edge', 'Core', 'Peak', 'Zone', 'Link', 'Sync', 'Bolt', 'Glow', 'Mint', 'Ruby',
];

const DISC_UNLOCK_COST = 20;

let pendingDiscPurchase = null;

function getDiscGridItems() {
  const packIds = TOKEN_PACKAGES.map((p) => p.id);
  return DISC_GRID_NAMES.map((name, i) => ({
    discId: `disc-grid-${i}`,
    packId: packIds[i % packIds.length],
    discName: `Dysk ${name}`,
    popular: i % 6 === 0,
    tag: String(i + 1),
    image: DISC_GRID_PHOTOS[i] || null,
  }));
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

const profiles = [
  { id: 1, name: 'Karolina', age: 24, city: 'Warszawa', bio: 'Szukam kogoś na wieczorne rozmowy... 💬', image: 'images/profiles/karolina.png' },
  { id: 2, name: 'Natalia', age: 26, city: 'Kraków', bio: 'Kawa, spacer i dobra rozmowa — to mój plan ☕', image: 'images/profiles/natalia.png' },
  { id: 3, name: 'Monika', age: 23, city: 'Wrocław', bio: 'Lubię spontaniczne wieczory i śmiech 😄', image: 'images/profiles/monika.png' },
  { id: 4, name: 'Aleksandra', age: 28, city: 'Gdańsk', bio: 'Miłośniczka podróży — opowiedz mi o swoich planach ✈️', image: 'images/profiles/aleksandra.png' },
  { id: 5, name: 'Weronika', age: 25, city: 'Poznań', bio: 'Szukam kogoś z poczuciem humoru 😊', image: 'images/profiles/weronika.png' },
  { id: 6, name: 'Maja', age: 27, city: 'Łódź', bio: 'Wieczory przy winie i dobrej muzyce 🍷', image: 'images/profiles/magdalena.png' },
  { id: 7, name: 'Zuzia', age: 22, city: 'Szczecin', bio: 'Uwielbiam długie spacery nad wodą 🌊', image: 'images/profiles/patrycja.png' },
  { id: 8, name: 'Oliwka', age: 29, city: 'Lublin', bio: 'Książki, serial i ktoś do rozmowy 📚', image: 'images/profiles/joanna.png' },
  { id: 9, name: 'Wika', age: 24, city: 'Katowice', bio: 'Energiczna — zawsze coś w planie ⚡', image: 'images/profiles/paulina.png' },
  { id: 10, name: 'Domcia', age: 26, city: 'Białystok', bio: 'Szukam szczerej rozmowy bez pośpiechu 💫', image: 'images/profiles/zuzanna.png', available: true },
];

/** Uzupełnia status dostępności (zielona / czerwona flara) */
const PROFILE_AVAILABLE_IDS = new Set([1, 2, 4, 5, 6, 8, 9, 10]);

profiles.forEach((p) => {
  if (p.available === undefined) {
    p.available = PROFILE_AVAILABLE_IDS.has(p.id);
  }
});

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
  { id: 'shop-priority', name: 'Priorytetowa wiadomość', desc: 'Wyróżnij się w skrzynce', cost: 30 },
  { id: 'shop-photo', name: 'Zdjęcie HD', desc: 'Odblokuj pełną jakość zdjęcia', cost: 50 },
  { id: 'shop-gift', name: 'Pakiet prezentów', desc: '3 losowe reakcje emoji', cost: 80 },
];

const INBOX_META = {
  1: { preview: 'Hej! Cieszę się, że się odezwałeś 😊', time: '2 min', unread: 2 },
  2: { preview: 'Kawa, spacer i dobra rozmowa...', time: '15 min', unread: 0 },
  3: { preview: 'Lubię spontaniczne wieczory 😄', time: '1 godz.', unread: 1 },
  4: { preview: 'Opowiedz mi o swoich planach ✈️', time: '3 godz.', unread: 0 },
  5: { preview: 'Szukam kogoś z humorem 😊', time: 'Wczoraj', unread: 1 },
  6: { preview: 'Masz plany na wieczór? 🍷', time: '5 min', unread: 1 },
  7: { preview: 'Spacer nad Odrą brzmi dobrze...', time: '22 min', unread: 0 },
  8: { preview: 'Polecisz jakiś dobry serial?', time: '2 godz.', unread: 0 },
  9: { preview: 'Może spotkamy się w weekend?', time: '4 godz.', unread: 2 },
  10: { preview: 'Bez pośpiechu — napisz kiedy chcesz 💫', time: 'Wczoraj', unread: 0 },
};

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

  grid.innerHTML = profiles
    .map(
      (p) => `
    <article class="profile-card" data-profile-id="${p.id}" tabindex="0" role="button" aria-label="Otwórz czat z ${p.name}">
      <div class="profile-card__img-wrap">
        <!-- AFFILIATE LINK ${p.id} — card click opens chat -->
        <img src="${p.image}" alt="${p.name}" class="profile-img" data-profile-id="${p.id}" loading="lazy">
        ${p.image ? '' : `<div class="profile-img__placeholder" aria-hidden="true">${PERSON_ICON}<span>Zdjęcie wkrótce</span></div>`}
      </div>
      <div class="profile-card__body">
        <div class="profile-card__header">
          <span class="profile-card__name">${p.name}, ${p.age}</span>
          <span class="profile-card__online" title="Online"></span>
        </div>
        <p class="profile-card__city">${p.city}</p>
        <p class="profile-card__bio">${p.bio}</p>
        <div class="profile-card__actions">
          <button type="button" class="profile-card__attach" data-attach-profile="${p.id}" aria-label="Załącz plik">${ATTACH_ICON}</button>
          <button type="button" class="profile-card__btn" data-open-chat="${p.id}">Napisz wiadomość</button>
        </div>
      </div>
    </article>
  `
    )
    .join('');

  grid.querySelectorAll('.profile-card').forEach((card) => {
    const id = Number(card.dataset.profileId);
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-open-chat], [data-attach-profile]')) return;
      openInbox(id);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openInbox(id);
      }
    });
  });

  grid.querySelectorAll('[data-open-chat]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openInbox(Number(btn.dataset.openChat));
    });
  });

  grid.querySelectorAll('[data-attach-profile]').forEach((btn) => bindAttachButton(btn));
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
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (stored === null) return DEFAULT_TOKENS;
  const n = parseInt(stored, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TOKENS;
}

function setTokenBalance(amount) {
  const value = Math.max(0, Math.floor(amount));
  localStorage.setItem(TOKEN_STORAGE_KEY, String(value));
  updateTokenUI(value);
  return value;
}

function updateTokenUI(balance) {
  const formatted = balance.toLocaleString('pl-PL');
  document.querySelectorAll('#token-balance, #token-balance-dropdown, #token-balance-modal').forEach((el) => {
    if (el) el.textContent = formatted;
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

function purchaseTokenPack(packId) {
  const pack = TOKEN_PACKAGES.find((p) => p.id === packId);
  if (!pack) return;

  const tokens = pack.tokens + (pack.bonusTokens || 0);
  const newBalance = setTokenBalance(getTokenBalance() + tokens);
  const label = pack.bonus ? `${pack.tokens} + ${pack.bonusTokens} bonus` : String(tokens);
  updateInboxPricingBalance();
  renderInboxPricingShop();
  showToast(`Dodano ${label} żetonów. Stan konta: ${newBalance}`);
}

function buildDiscCardHtml(item, extraClass = '') {
  const pack = TOKEN_PACKAGES.find((p) => p.id === item.packId);
  if (!pack) return '';

  const total = pack.tokens + (pack.bonusTokens || 0);
  const popularClass = item.popular || pack.popular ? ' disc-card--popular' : '';
  const visual = item.image
    ? `<span class="disc-card__photo-wrap"><img src="${item.image}" alt="" class="disc-card__photo" loading="lazy"></span>`
    : '<span class="disc-card__disc" aria-hidden="true"></span>';

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
  const variantClass = variant === 'carousel' ? ' disc-card--carousel' : ' disc-card--grid';
  const popularClass = item.popular ? ' disc-card--popular' : '';
  const visual = item.image
    ? `<span class="disc-card__photo-wrap"><img src="${item.image}" alt="" class="disc-card__photo" loading="lazy"></span>`
    : '<span class="disc-card__disc" aria-hidden="true"></span>';

  return `
    <article class="disc-card${variantClass}${popularClass}${item.image ? ' disc-card--photo' : ''}" data-disc-id="${item.discId}">
      ${item.popular ? '<span class="disc-card__badge">Hit</span>' : ''}
      ${visual}
      <span class="disc-card__name">${item.discName}</span>
      <button type="button" class="disc-card__claim">Odbierz</button>
    </article>
  `;
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

function openDiscPurchase(item) {
  const modal = document.getElementById('disc-purchase-modal');
  if (!modal) return;

  pendingDiscPurchase = item;
  const title = document.getElementById('disc-purchase-title');
  const preview = document.getElementById('disc-purchase-preview');
  const balanceEl = document.getElementById('disc-purchase-balance');

  if (title) title.textContent = item.discName;
  if (balanceEl) balanceEl.textContent = String(getTokenBalance());

  if (preview) {
    preview.innerHTML = item.image
      ? `<img src="${item.image}" alt="" class="disc-purchase__photo" loading="lazy">`
      : '<span class="disc-purchase__disc" aria-hidden="true"></span>';
  }

  updateTokenUI(getTokenBalance());
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
  const name = pendingDiscPurchase.discName;
  closeDiscPurchase();
  showToast(`Odebrano ${name}! Odblokowano za ${DISC_UNLOCK_COST} żetonów. Stan: ${newBalance}`);
}

function initDiscPurchase() {
  const modalClose = document.getElementById('disc-purchase-close');
  const modalBackdrop = document.getElementById('disc-purchase-backdrop');
  const confirmBtn = document.getElementById('disc-purchase-confirm');
  const tokensBtn = document.getElementById('disc-purchase-tokens');

  modalClose?.addEventListener('click', closeDiscPurchase);
  modalBackdrop?.addEventListener('click', closeDiscPurchase);
  confirmBtn?.addEventListener('click', confirmDiscPurchase);
  tokensBtn?.addEventListener('click', () => {
    closeDiscPurchase();
    openTokenShop();
  });
}

function renderDiscGrid() {
  const grid = document.getElementById('discs-grid');
  if (!grid) return;

  grid.innerHTML = getDiscGridItems()
    .map((item) => buildDiscClaimCardHtml(item, 'grid'))
    .join('');

  bindDiscClaimButtons(grid);
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

  document.getElementById('profile-menu-settings')?.addEventListener('click', () => {
    closeProfileMenu();
    showToast('Ustawienia konta — funkcja w przygotowaniu.');
  });

  document.getElementById('profile-menu-edit')?.addEventListener('click', () => {
    closeProfileMenu();
    if (getCurrentUser()) {
      document.getElementById('invite-friend')?.click();
    } else {
      openAuthModal('register');
    }
  });

  document.getElementById('profile-menu-logout')?.addEventListener('click', () => {
    closeProfileMenu();
    setCurrentUser(null);
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

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
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
      : 'Login, e-mail i hasło — konto demo w przeglądarce.';
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

  if (user) {
    toggle.hidden = true;
    closeAuthModal();
    if (inviteHint) inviteHint.hidden = false;
    if (inviteBtn) inviteBtn.hidden = false;
    const inviteInput = document.getElementById('invite-link-input');
    if (inviteInput) inviteInput.value = getInviteReferralLink();
  } else {
    toggle.hidden = false;
    toggle.textContent = 'Dołącz za darmo →';
    if (inviteHint) inviteHint.hidden = true;
    if (inviteBtn) inviteBtn.hidden = true;
    hideInviteLinkPanel();
    setAuthPanelMode(document.getElementById('auth-modal')?.dataset.authMode || 'register');
  }

  if (document.getElementById('account-page')) {
    initAccountPage();
  }
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

function handleLoginSubmit(e) {
  e.preventDefault();
  showLoginError('');

  const identifier = document.getElementById('login-identifier')?.value.trim();
  const password = document.getElementById('login-password')?.value;

  if (!identifier || !password) {
    showLoginError('Wpisz login (lub e-mail) i hasło.');
    return;
  }

  const idLower = identifier.toLowerCase();
  const users = getStoredUsers();
  const user = users.find(
    (u) => u.username.toLowerCase() === idLower || u.email === idLower
  );

  if (!user || user.password !== password) {
    showLoginError('Nieprawidłowy login lub hasło.');
    return;
  }

  setCurrentUser({ username: user.username, email: user.email });
  e.target.reset();
  setAuthPanelMode('register');
  updateRegisterUI();
  showToast(`Witaj ponownie, ${user.username}!`);
  closeRegisterPanel();
  closeSidebarMenu();
}

function handleRegisterSubmit(e) {
  e.preventDefault();
  showRegisterError('');

  const username = document.getElementById('reg-username')?.value.trim();
  const email = document.getElementById('reg-email')?.value.trim().toLowerCase();
  const password = document.getElementById('reg-password')?.value;
  const passwordConfirm = document.getElementById('reg-password-confirm')?.value;

  if (!username || !USERNAME_REGEX.test(username)) {
    showRegisterError('Login: 3–24 znaki (litery, cyfry, podkreślnik).');
    return;
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showRegisterError('Podaj prawidłowy adres e-mail.');
    return;
  }

  if (!password || password.length < 6) {
    showRegisterError('Hasło musi mieć co najmniej 6 znaków.');
    return;
  }

  if (password !== passwordConfirm) {
    showRegisterError('Hasła nie są identyczne.');
    return;
  }

  const users = getStoredUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    showRegisterError('Ten login jest już zajęty — wybierz inną nazwę.');
    return;
  }

  if (users.some((u) => u.email === email)) {
    showRegisterError('Ten e-mail jest już zarejestrowany.');
    return;
  }

  const newUser = {
    username,
    email,
    password,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  setCurrentUser({ username, email });

  e.target.reset();
  updateRegisterUI();
  showToast(`Witaj, ${username}! Konto zostało utworzone.`);
  closeRegisterPanel();

  closeSidebarMenu();
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

  const sectionIds = ['hero', 'profiles', 'discs', 'about', 'contact'];
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
      (p, i) => `
    <li class="rail-list__item">
      <div class="rail-item">
        <div class="rail-item__avatar-wrap">
          <img src="${p.image}" alt="" class="rail-item__thumb" width="48" height="48" loading="lazy">
          <span class="rail-item__flare rail-item__flare--${p.available ? 'online' : 'offline'}" title="${p.available ? 'Dostępna' : 'Niedostępna'}"></span>
        </div>
        <div class="rail-item__body">
          <span class="rail-item__name">${p.name}, ${p.age}</span>
          <span class="rail-item__meta">${40 + i * 23} aktywności · ${p.city}</span>
        </div>
        <button type="button" class="rail-item__msg" data-profile-id="${p.id}" aria-label="Wiadomości do ${p.name}">
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
  closeWalletDropdown();
  closeRegisterPanel();
  closeTokenShop();

  closeSidebarMenu();
  setSidebarActiveLink('open-inbox');

  renderInboxContacts();

  if (profileId) {
    selectInboxContact(profileId);
  } else if (window.innerWidth > 768 && profiles.length) {
    selectInboxContact(profiles[0].id);
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

  let current = 'hero';
  ['hero', 'profiles', 'discs', 'about', 'contact'].forEach((id) => {
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
  if (window.innerWidth <= 768) {
    empty.style.display = 'flex';
    sidebar?.classList.remove('is-hidden-mobile');
  } else {
    empty.style.display = '';
  }
}

function renderInboxContacts(filter = '') {
  const list = document.getElementById('inbox-contacts');
  if (!list) return;

  const q = filter.trim().toLowerCase();
  const filtered = profiles.filter((p) => {
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      String(p.age).includes(q)
    );
  });

  list.innerHTML = filtered
    .map((p) => {
      const meta = INBOX_META[p.id] || { preview: CHAT_MESSAGES[0], time: 'Teraz', unread: 0 };
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

function selectInboxContact(profileId) {
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return;

  activeInboxId = profileId;
  closeInboxPricing();
  renderInboxContacts(document.getElementById('inbox-search')?.value || '');

  const empty = document.getElementById('inbox-empty');
  const thread = document.getElementById('inbox-thread');
  const chat = document.getElementById('inbox-chat');
  const sidebar = document.getElementById('inbox-sidebar');
  const affiliate = document.getElementById('inbox-thread-affiliate');
  const affiliateLink = document.getElementById('inbox-affiliate-link');
  const messagesEl = document.getElementById('inbox-thread-messages');
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

  if (messagesEl) {
    messagesEl.innerHTML = '';
    CHAT_MESSAGES.forEach((text, i) => {
      setTimeout(() => {
        const bubble = document.createElement('div');
        bubble.className = 'inbox-bubble inbox-bubble--her';
        bubble.textContent = text;
        messagesEl.appendChild(bubble);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }, 280 + i * 380);
    });
  }
}

function showInboxAffiliateOverlay() {
  const affiliate = document.getElementById('inbox-thread-affiliate');
  const composer = document.querySelector('.inbox-thread__composer');
  if (affiliate) affiliate.hidden = false;
  if (composer) composer.style.visibility = 'hidden';
}

function sendInboxMessage() {
  const input = document.getElementById('inbox-thread-input');
  const messagesEl = document.getElementById('inbox-thread-messages');
  if (!input || !messagesEl || !activeInboxId) return;

  const text = input.value.trim();
  if (!text) return;

  const bubble = document.createElement('div');
  bubble.className = 'inbox-bubble inbox-bubble--me';
  bubble.textContent = text;
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  input.value = '';

  showInboxAffiliateOverlay();
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
    if (e.key === 'Enter') sendInboxMessage();
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

document.addEventListener('DOMContentLoaded', () => {
  shuffleProfiles();
  renderProfiles();
  renderDiscCarousel();
  renderDiscGrid();
  renderTopProfiles();
  renderDashboardPlans();
  initHeroSlider();
  initRegister();
  initInbox();
  initSidebarCollapse();
  initNavbar();
  initWallet();
  initProfileMenu();
  initDiscPurchase();
  initAccountPage();
  initScrollAnimations();
});

function initAccountPage() {
  const page = document.getElementById('account-page');
  if (!page) return;

  updateTokenUI(getTokenBalance());

  const user = getCurrentUser();
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set('account-username', user ? user.username : 'Gość');
  set('account-email', user ? user.email : '—');
  set('account-tokens', getTokenBalance().toLocaleString('pl-PL'));

  const accountLink = document.getElementById('profile-menu-account');
  if (accountLink) accountLink.classList.add('is-active');
}
