/**
 * DyskiHub.pl — AI czat (OpenRouter via Netlify Function)
 */

const CHAT_API_URL = '/.netlify/functions/chat';
const MODEL = 'deepseek/deepseek-chat';
const CHAT_DURATION_MS = 90000;
const EXTENSION_MS = 600000;
const EXTENSION_COST = 30;
const PHOTO_UNLOCK_COST = 20;
const PHOTO_TAG = '[SEND_PHOTO]';
const PRICING_TAG = '[SHOW_PRICING]';
const TOPUP_TAG = '[SHOW_TOPUP]';

let kolezanka = null;
let kolezankaId = null;
let chatHistory = [];
let timerHandle = null;
let chatPaused = false;
let typingBubbleEl = null;
let replyQueue = Promise.resolve();
let welcomeInFlight = null;
let activateInFlight = null;
let userSendLocked = false;

const CHAT_PAGE_UI = {
  messagesId: 'chat-messages',
  inputId: 'chat-input',
  sendId: 'chat-send',
  mode: 'page',
};
const INBOX_UI = {
  messagesId: 'inbox-thread-messages',
  inputId: 'inbox-thread-input',
  sendId: 'inbox-thread-send',
  mode: 'inbox',
};
let chatUi = { ...CHAT_PAGE_UI };

function getMessagesBox() {
  return document.getElementById(chatUi.messagesId);
}

function getChatInput() {
  return document.getElementById(chatUi.inputId);
}

function getChatSend() {
  return document.getElementById(chatUi.sendId);
}

function openPricingUi() {
  if (chatUi.mode === 'inbox' && typeof openInboxPricing === 'function') {
    openInboxPricing();
    return;
  }
  openChatPricingModal();
}

const WELCOME_INSTRUCTION =
  'Napisz pierwszą wiadomość powitalną — bardzo krótko, 1–4 słowa. Np: "hejka", "siema", "hej;)", "hej co tam". Jedno krótkie powitanie, naturalnie.';

const WELCOME_FALLBACKS = [
  'hejka',
  'siema',
  'hej;)',
  'hej co tam',
  'yo',
  'hej',
];

/** Tempo pisania 155–185 znaków/min */
const TYPING_CPM_MIN = 155;
const TYPING_CPM_MAX = 185;
const TYPING_MIN_MS = 1200;
const TYPING_MAX_MS = 45000;
const TYPING_REACTION_MIN_MS = 1000;
const TYPING_REACTION_MAX_MS = 5000;

function typingMsPerChar() {
  const cpm = TYPING_CPM_MIN + Math.random() * (TYPING_CPM_MAX - TYPING_CPM_MIN);
  return 60000 / cpm;
}

function estimateTypingDuration(text) {
  const len = Math.max(1, (text || '').trim().length);
  const jitter = 1.05 + Math.random() * 0.35;
  const ms = len * typingMsPerChar() * jitter;
  return Math.round(Math.min(TYPING_MAX_MS, Math.max(TYPING_MIN_MS, ms)));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitRandomReactionDelay() {
  const ms =
    TYPING_REACTION_MIN_MS +
    Math.random() * (TYPING_REACTION_MAX_MS - TYPING_REACTION_MIN_MS);
  await sleep(Math.round(ms));
}

async function waitFullTypingDuration(text) {
  await sleep(estimateTypingDuration(text));
}

function isUserMessageAlreadyAnswered(userMessageIndex) {
  return chatHistory[userMessageIndex + 1]?.role === 'assistant';
}

function getFirstUnansweredUserIndex() {
  for (let i = 0; i < chatHistory.length; i += 1) {
    if (chatHistory[i].role === 'user' && !isUserMessageAlreadyAnswered(i)) {
      return i;
    }
  }
  return -1;
}

function trimWelcomeReply(text) {
  const clean = text.trim().replace(/^["']|["']$/g, '').split('\n')[0].trim();
  if (!clean) return WELCOME_FALLBACKS[kolezankaId % WELCOME_FALLBACKS.length];
  const words = clean.split(/\s+/);
  if (words.length <= 4 && clean.length <= 40) return clean;
  return words.slice(0, 4).join(' ');
}

function getQueryId() {
  return parseInt(new URLSearchParams(window.location.search).get('id'), 10);
}

function historyKey(id) {
  return `chat_history_${id}`;
}

function photoCountKey(id) {
  return `photo_count_${id}`;
}

function chatUpdatedKey(id) {
  return `chat_updated_${id}`;
}

function sessionEndKey(id) {
  return `chat_session_end_${id}`;
}

function unlockedPhotoKey(profileId, index) {
  return `unlocked_photo_${profileId}_${index}`;
}

function loadHistory(id) {
  try {
    const arr = JSON.parse(localStorage.getItem(historyKey(id)) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  if (!kolezankaId) return;
  localStorage.setItem(historyKey(kolezankaId), JSON.stringify(chatHistory));
  localStorage.setItem(chatUpdatedKey(kolezankaId), String(Date.now()));
}

function getPhotoCount(id) {
  const n = parseInt(localStorage.getItem(photoCountKey(id)), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function incrementPhotoCount(id) {
  localStorage.setItem(photoCountKey(id), String(getPhotoCount(id) + 1));
}

function isPhotoUnlocked(profileId, index) {
  if (index <= 1) return true;
  return localStorage.getItem(unlockedPhotoKey(profileId, index)) === '1';
}

function markPhotoUnlocked(profileId, index) {
  localStorage.setItem(unlockedPhotoKey(profileId, index), '1');
}

function getSessionEnd(id) {
  const n = parseInt(localStorage.getItem(sessionEndKey(id)), 10);
  return Number.isFinite(n) ? n : null;
}

function setSessionEnd(id, timestamp) {
  localStorage.setItem(sessionEndKey(id), String(timestamp));
}

function avatarPath(id) {
  return `images/kolezanki/${id}/avatar.jpg`;
}

function photoPath(id, index) {
  return `images/kolezanki/${id}/${index}.jpg`;
}

function redirectProfiles() {
  window.location.href = 'index.html#profiles';
}

function checkAccess(id) {
  return Number.isFinite(id) && id >= 1 && id <= 10;
}

function isSessionExpired() {
  const end = getSessionEnd(kolezankaId);
  return end !== null && Date.now() >= end;
}

function setTyping(visible) {
  const box = getMessagesBox();
  if (!box) return;

  if (visible) {
    if (typingBubbleEl) return;
    typingBubbleEl = document.createElement('div');
    typingBubbleEl.className = 'message-bubble message-bubble--her message-bubble--typing';
    typingBubbleEl.setAttribute('aria-label', 'Pisze...');
    typingBubbleEl.innerHTML =
      '<span class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
    box.appendChild(typingBubbleEl);
  } else {
    typingBubbleEl?.remove();
    typingBubbleEl = null;
  }
  scrollToBottom();
}

function scrollToBottom() {
  const box = getMessagesBox();
  if (box) box.scrollTop = box.scrollHeight;
}

function stripAllTags(text) {
  return (text || '')
    .replace(/\s*\[SEND_PHOTO\]\s*/gi, '')
    .replace(/\s*\[SHOW_PRICING\]\s*/gi, '')
    .replace(/\s*\[SHOW_TOPUP\]\s*/gi, '')
    .trim();
}

function parseAssistantTags(text) {
  const raw = text || '';
  return {
    text: stripAllTags(raw),
    sendPhoto: /\[SEND_PHOTO\]/i.test(raw),
    showPricing: /\[SHOW_PRICING\]/i.test(raw),
    showTopup: /\[SHOW_TOPUP\]/i.test(raw),
  };
}

function appendTextBubble(text, fromUser) {
  const box = getMessagesBox();
  if (!box || !text.trim()) return;

  const bubble = document.createElement('div');
  bubble.className = `message-bubble message-bubble--${fromUser ? 'user' : 'her'} message-bubble--fade`;
  bubble.textContent = text;
  box.appendChild(bubble);
  scrollToBottom();
}

function appendActionButtons(actions) {
  const box = getMessagesBox();
  if (!box) return;
  if (!actions.showPricing && !actions.showTopup) return;

  const wrap = document.createElement('div');
  wrap.className = 'message-bubble message-bubble--her message-bubble--actions message-bubble--fade';

  if (actions.showPricing) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-action-btn chat-action-btn--pricing';
    btn.textContent = 'Zobacz cennik';
    btn.addEventListener('click', openPricingUi);
    wrap.appendChild(btn);
  }

  if (actions.showTopup) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-action-btn chat-action-btn--topup';
    btn.textContent = 'Jak doładować żetony';
    btn.addEventListener('click', openTopupModal);
    wrap.appendChild(btn);
  }

  box.appendChild(wrap);
  scrollToBottom();
}

function unlockPhotoInDom(wrap, profileId, photoIndex) {
  const photoWrap = wrap.querySelector('.photo-blurred');
  if (!photoWrap) return;
  photoWrap.classList.remove('photo-blurred');
  photoWrap.classList.add('photo-wrap');
  photoWrap.querySelector('.photo-overlay')?.remove();
  markPhotoUnlocked(profileId, photoIndex);
}

function tryUnlockPhoto(wrap, profileId, photoIndex) {
  const balance = typeof getTokenBalance === 'function' ? getTokenBalance() : 0;
  if (balance < PHOTO_UNLOCK_COST) {
    if (typeof showToast === 'function') {
      showToast(`Potrzebujesz ${PHOTO_UNLOCK_COST} żetonów. Doładuj konto.`);
    }
    openTopupModal();
    return;
  }
  if (typeof setTokenBalance === 'function') {
    setTokenBalance(balance - PHOTO_UNLOCK_COST);
  }
  unlockPhotoInDom(wrap, profileId, photoIndex);
  if (typeof showToast === 'function') {
    showToast('Zdjęcie odblokowane!');
  }
}

function appendPhotoBubble(src, profileId, photoIndex) {
  const box = getMessagesBox();
  if (!box) return;

  const blurred = photoIndex > 1 && !isPhotoUnlocked(profileId, photoIndex);

  const wrap = document.createElement('div');
  wrap.className = 'message-bubble message-bubble--her message-bubble--photo message-bubble--fade';
  wrap.dataset.photoIndex = String(photoIndex);

  const photoWrap = document.createElement('div');
  photoWrap.className = blurred ? 'photo-blurred' : 'photo-wrap';

  const img = document.createElement('img');
  img.src = src;
  img.alt = 'Zdjęcie';
  img.className = 'chat-photo';
  img.loading = 'lazy';
  img.onerror = () => {
    img.classList.add('chat-photo--placeholder');
    img.alt = 'Brak zdjęcia';
  };
  photoWrap.appendChild(img);

  if (blurred) {
    const overlay = document.createElement('div');
    overlay.className = 'photo-overlay';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'unlock-btn';
    btn.textContent = `🔒 ODBLOKUJ [ZA ${PHOTO_UNLOCK_COST} ŻETONÓW]`;
    btn.addEventListener('click', () => tryUnlockPhoto(wrap, profileId, photoIndex));
    overlay.appendChild(btn);
    photoWrap.appendChild(overlay);
  }

  wrap.appendChild(photoWrap);
  box.appendChild(wrap);
  scrollToBottom();
}

function countPhotosBeforeHistoryIndex(endIndex) {
  let count = 0;
  for (let i = 0; i <= endIndex && i < chatHistory.length; i += 1) {
    if (chatHistory[i].role === 'assistant' && /\[SEND_PHOTO\]/i.test(chatHistory[i].content)) {
      count += 1;
    }
  }
  return count;
}

function renderHistoryMessages() {
  const box = getMessagesBox();
  if (box) box.innerHTML = '';

  chatHistory.forEach((msg, idx) => {
    if (msg.role === 'user') {
      appendTextBubble(msg.content, true);
    } else if (msg.role === 'assistant') {
      const parsed = parseAssistantTags(msg.content);
      if (parsed.text) appendTextBubble(parsed.text, false);
      if (parsed.showPricing || parsed.showTopup) appendActionButtons(parsed);
      if (parsed.sendPhoto) {
        const photoIndex = countPhotosBeforeHistoryIndex(idx);
        appendPhotoBubble(photoPath(kolezankaId, photoIndex), kolezankaId, photoIndex);
      }
    }
  });
}

async function callOpenRouter(messages) {
  const res = await fetch(CHAT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Pusta odpowiedź API');
  return content;
}

function buildApiMessages(welcomeOnly) {
  const systemPrompt = window.KOLEZANKI_PROMPTS?.[kolezankaId];
  if (!systemPrompt) throw new Error('Brak promptu');

  const messages = [{ role: 'system', content: systemPrompt }];

  if (welcomeOnly) {
    messages.push({ role: 'user', content: WELCOME_INSTRUCTION });
  } else {
    chatHistory.forEach((m) => messages.push({ role: m.role, content: m.content }));
  }

  return messages;
}

function buildApiMessagesUpTo(endIndex) {
  const systemPrompt = window.KOLEZANKI_PROMPTS?.[kolezankaId];
  if (!systemPrompt) throw new Error('Brak promptu');

  const messages = [{ role: 'system', content: systemPrompt }];
  const lastIndex = Math.min(endIndex, chatHistory.length - 1);

  for (let i = 0; i <= lastIndex; i += 1) {
    messages.push({ role: chatHistory[i].role, content: chatHistory[i].content });
  }

  return messages;
}

async function fetchWelcomeMessageOnce() {
  const stored = loadHistory(kolezankaId);
  if (stored.length > 0) {
    chatHistory = stored;
    return;
  }

  const apiPromise = callOpenRouter(buildApiMessages(true));

  try {
    await waitRandomReactionDelay();
    setTyping(true);

    const reply = await apiPromise;
    const message = trimWelcomeReply(reply);
    await waitFullTypingDuration(message);
    setTyping(false);

    if (loadHistory(kolezankaId).length > 0) return;

    appendTextBubble(message, false);
    chatHistory.push({ role: 'assistant', content: message });
    saveHistory();
  } catch (err) {
    const fallback = WELCOME_FALLBACKS[kolezankaId % WELCOME_FALLBACKS.length];
    if (!typingBubbleEl) setTyping(true);
    await waitFullTypingDuration(fallback);
    setTyping(false);

    if (loadHistory(kolezankaId).length > 0) return;

    appendTextBubble(fallback, false);
    chatHistory.push({ role: 'assistant', content: fallback });
    saveHistory();
    console.error(err);
  }
}

async function fetchWelcomeMessage() {
  const stored = loadHistory(kolezankaId);
  if (stored.length > 0) {
    chatHistory = stored;
    return;
  }

  if (welcomeInFlight?.id === kolezankaId) {
    await welcomeInFlight.promise;
    chatHistory = loadHistory(kolezankaId);
    return;
  }

  const promise = fetchWelcomeMessageOnce();
  welcomeInFlight = { id: kolezankaId, promise };
  try {
    await promise;
  } finally {
    if (welcomeInFlight?.id === kolezankaId) welcomeInFlight = null;
  }
}

function handlePhotoSend() {
  const count = getPhotoCount(kolezankaId);
  const photoIndex = Math.min(count + 1, 5);
  appendPhotoBubble(photoPath(kolezankaId, photoIndex), kolezankaId, photoIndex);
  incrementPhotoCount(kolezankaId);
}

function enqueueBotReply(task) {
  replyQueue = replyQueue
    .then(() => task())
    .catch((err) => console.error(err));
  return replyQueue;
}

async function runBotReplyCycle() {
  if (chatPaused) return;

  const userMessageIndex = getFirstUnansweredUserIndex();
  if (userMessageIndex === -1) return;

  const apiPromise = callOpenRouter(buildApiMessagesUpTo(userMessageIndex));

  try {
    await waitRandomReactionDelay();
    if (chatPaused) return;

    setTyping(true);

    const reply = await apiPromise;
    if (chatPaused) {
      setTyping(false);
      return;
    }

    const preview = stripAllTags(reply) || reply;
    await waitFullTypingDuration(preview);

    if (chatPaused) {
      setTyping(false);
      return;
    }

    setTyping(false);
    await processAssistantReply(reply);
  } catch (err) {
    const fallback = 'kurde cos nie poszlo, sprobuj jeszcze raz';
    if (!chatPaused) {
      if (!typingBubbleEl) setTyping(true);
      await waitFullTypingDuration(fallback);
      setTyping(false);
      appendTextBubble(fallback, false);
      if (!isUserMessageAlreadyAnswered(userMessageIndex)) {
        chatHistory.push({ role: 'assistant', content: fallback });
        saveHistory();
      }
    } else {
      setTyping(false);
    }
    console.error(err);
  }
}

async function processAssistantReply(rawReply) {
  const parsed = parseAssistantTags(rawReply);

  chatHistory.push({ role: 'assistant', content: rawReply });
  saveHistory();

  if (parsed.text) appendTextBubble(parsed.text, false);
  if (parsed.showPricing || parsed.showTopup) appendActionButtons(parsed);
  if (parsed.sendPhoto) handlePhotoSend();

  if (typeof renderInboxContacts === 'function' && chatUi.mode === 'inbox') {
    renderInboxContacts(document.getElementById('inbox-search')?.value || '');
  }
}

async function sendUserMessage(text) {
  if (chatPaused || !text.trim() || userSendLocked) return;

  userSendLocked = true;
  const input = getChatInput();
  const send = getChatSend();
  if (input) input.disabled = true;
  if (send) send.disabled = true;

  appendTextBubble(text, true);
  chatHistory.push({ role: 'user', content: text });
  saveHistory();

  if (typeof renderInboxContacts === 'function' && chatUi.mode === 'inbox') {
    renderInboxContacts(document.getElementById('inbox-search')?.value || '');
  }

  if (!getSessionEnd(kolezankaId)) {
    setSessionEnd(kolezankaId, Date.now() + CHAT_DURATION_MS);
    startChatTimer();
  }

  try {
    await enqueueBotReply(runBotReplyCycle);
  } finally {
    userSendLocked = false;
    if (!chatPaused) enableComposer();
  }
}

function disableComposer(message) {
  chatPaused = true;
  const input = getChatInput();
  const send = getChatSend();
  if (input) {
    input.disabled = true;
    input.placeholder = message || 'Rozmowa wstrzymana';
  }
  if (send) send.disabled = true;
}

function enableComposer() {
  chatPaused = false;
  const input = getChatInput();
  const send = getChatSend();
  if (input) {
    input.disabled = false;
    input.placeholder = 'Napisz wiadomość...';
  }
  if (send) send.disabled = false;
}

function showExtensionModal() {
  disableComposer('Czas minął — przedłuż rozmowę');

  const modal = document.getElementById('chat-extension-modal');
  const text = document.getElementById('chat-extension-text');
  const balanceEl = document.getElementById('chat-extension-balance');

  if (text && kolezanka) {
    text.textContent = `Czas rozmowy z ${kolezanka.imie || kolezanka.name} minął. Przedłuż o 10 minut za ${EXTENSION_COST} żetonów.`;
  }
  if (balanceEl && typeof getTokenBalance === 'function') {
    balanceEl.textContent = getTokenBalance().toLocaleString('pl-PL');
  }

  if (modal) {
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }
}

function hideExtensionModal() {
  const modal = document.getElementById('chat-extension-modal');
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }
}

function extendChatSession() {
  const balance = typeof getTokenBalance === 'function' ? getTokenBalance() : 0;
  if (balance < EXTENSION_COST) {
    if (typeof showToast === 'function') {
      showToast(`Potrzebujesz ${EXTENSION_COST} żetonów. Doładuj konto.`);
    }
    openTopupModal();
    return;
  }

  if (typeof setTokenBalance === 'function') {
    setTokenBalance(balance - EXTENSION_COST);
  }

  setSessionEnd(kolezankaId, Date.now() + EXTENSION_MS);
  hideExtensionModal();
  enableComposer();
  startChatTimer();

  if (typeof showToast === 'function') {
    showToast('Rozmowa przedłużona o 10 minut!');
  }
}

function onSessionExpired() {
  showExtensionModal();
}

function startChatTimer() {
  if (timerHandle) clearTimeout(timerHandle);

  const endTime = getSessionEnd(kolezankaId);
  if (!Number.isFinite(endTime)) return;

  const remaining = Math.max(0, endTime - Date.now());
  if (remaining <= 0) {
    onSessionExpired();
    return;
  }

  timerHandle = setTimeout(onSessionExpired, remaining);
}

function openChatPricingModal() {
  const modal = document.getElementById('chat-pricing-modal');
  const balanceEl = document.getElementById('chat-pricing-balance');
  const shop = document.getElementById('chat-pricing-shop');

  if (balanceEl && typeof getTokenBalance === 'function') {
    balanceEl.textContent = getTokenBalance().toLocaleString('pl-PL');
  }

  if (shop && typeof PRICING_SHOP_ITEMS !== 'undefined') {
    const balance = typeof getTokenBalance === 'function' ? getTokenBalance() : 0;
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
      btn.addEventListener('click', () => {
        const item = PRICING_SHOP_ITEMS.find((i) => i.id === btn.dataset.shopId);
        if (!item) return;
        const bal = typeof getTokenBalance === 'function' ? getTokenBalance() : 0;
        if (bal < item.cost) {
          if (typeof showToast === 'function') showToast('Za mało żetonów.');
          openTopupModal();
          return;
        }
        if (typeof setTokenBalance === 'function') setTokenBalance(bal - item.cost);
        if (typeof showToast === 'function') showToast(`Kupiono: ${item.name}`);
        closeChatPricingModal();
      });
    });
  }

  if (modal) {
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }
}

function closeChatPricingModal() {
  const modal = document.getElementById('chat-pricing-modal');
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }
}

function openTopupModal() {
  const modal = document.getElementById('chat-topup-modal');
  if (modal) {
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }
}

function closeTopupModal() {
  const modal = document.getElementById('chat-topup-modal');
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }
}

function bindModals() {
  document.getElementById('chat-extension-extend')?.addEventListener('click', extendChatSession);
  document.getElementById('chat-extension-topup')?.addEventListener('click', () => {
    hideExtensionModal();
    openTopupModal();
  });
  document.getElementById('chat-extension-close')?.addEventListener('click', hideExtensionModal);

  document.getElementById('chat-pricing-close')?.addEventListener('click', closeChatPricingModal);
  document.getElementById('chat-pricing-backdrop')?.addEventListener('click', closeChatPricingModal);

  document.getElementById('chat-topup-close')?.addEventListener('click', closeTopupModal);
  document.getElementById('chat-topup-backdrop')?.addEventListener('click', closeTopupModal);

  const cryptoBtn = document.getElementById('chat-topup-crypto');
  const discordBtn = document.getElementById('chat-topup-discord');
  if (cryptoBtn) {
    cryptoBtn.href = typeof TOPUP_CRYPTO_URL !== 'undefined' ? TOPUP_CRYPTO_URL : '#';
  }
  if (discordBtn) {
    discordBtn.href = typeof TOPUP_DISCORD_URL !== 'undefined' ? TOPUP_DISCORD_URL : '#';
  }
}

function bindComposer() {
  const input = document.getElementById('chat-input');
  const send = document.getElementById('chat-send');

  const doSend = () => {
    if (!input || chatPaused) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendUserMessage(text);
  };

  send?.addEventListener('click', doSend);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSend();
    }
  });
}

function setupHeader() {
  const avatar = document.getElementById('chat-avatar');
  const name = document.getElementById('chat-name');
  if (avatar) {
    avatar.src = avatarPath(kolezankaId);
    avatar.alt = kolezanka.imie;
  }
  if (name) name.textContent = `${kolezanka.imie}, ${kolezanka.wiek}`;
}

async function resolveKolezanka(id) {
  if (typeof getProfile === 'function') {
    const profile = getProfile(id);
    if (profile) {
      return { id, imie: profile.name, name: profile.name, wiek: profile.age };
    }
  }
  const res = await fetch('data/kolezanki.json');
  if (!res.ok) throw new Error('fetch');
  const list = await res.json();
  const found = list.find((k) => k.id === id);
  if (!found) throw new Error('not found');
  return { ...found, name: found.imie };
}

function resetChatSessionState() {
  if (timerHandle) {
    clearTimeout(timerHandle);
    timerHandle = null;
  }
  typingBubbleEl = null;
  replyQueue = Promise.resolve();
  chatPaused = false;
  welcomeInFlight = null;
  userSendLocked = false;
}

async function activateInboxChatInner(profileId) {
  if (!checkAccess(profileId)) return;

  chatUi = { ...INBOX_UI };

  if (kolezankaId !== profileId) {
    resetChatSessionState();
  }

  kolezankaId = profileId;

  try {
    kolezanka = await resolveKolezanka(profileId);
    if (!window.KOLEZANKI_PROMPTS?.[kolezankaId]) return;
  } catch {
    return;
  }

  chatHistory = loadHistory(kolezankaId);
  enableComposer();
  renderHistoryMessages();

  if (getSessionEnd(kolezankaId)) {
    if (isSessionExpired()) {
      showExtensionModal();
    } else {
      startChatTimer();
    }
  } else if (chatHistory.length === 0) {
    await fetchWelcomeMessage();
  }
}

async function activateInboxChat(profileId) {
  if (activateInFlight?.id === profileId) {
    await activateInFlight.promise;
    return;
  }

  const promise = activateInboxChatInner(profileId);
  activateInFlight = { id: profileId, promise };
  try {
    await promise;
  } finally {
    if (activateInFlight?.id === profileId) activateInFlight = null;
  }
}

window.AiChat = {
  activateInbox: activateInboxChat,
  sendMessage: sendUserMessage,
  isPaused: () => chatPaused,
};

async function initAiChat() {
  chatUi = { ...CHAT_PAGE_UI };
  kolezankaId = getQueryId();
  if (!checkAccess(kolezankaId)) {
    redirectProfiles();
    return;
  }

  try {
    const res = await fetch('data/kolezanki.json');
    if (!res.ok) throw new Error('fetch');
    const list = await res.json();
    kolezanka = list.find((k) => k.id === kolezankaId);
    if (!kolezanka || !window.KOLEZANKI_PROMPTS?.[kolezankaId]) {
      redirectProfiles();
      return;
    }
  } catch {
    redirectProfiles();
    return;
  }

  setupHeader();
  bindComposer();
  bindModals();

  if (typeof syncTokenDisplay === 'function') syncTokenDisplay();

  chatHistory = loadHistory(kolezankaId);

  if (chatHistory.length > 0) {
    renderHistoryMessages();
    if (getSessionEnd(kolezankaId)) {
      if (isSessionExpired()) {
        showExtensionModal();
      } else {
        startChatTimer();
      }
    }
  } else {
    await fetchWelcomeMessage();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindModals();
  if (document.body.classList.contains('page-chat')) {
    initAiChat();
  }
});
