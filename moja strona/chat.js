/**
 * DyskiHub.pl — AI czat (OpenRouter via Netlify Function)
 */

const CHAT_API_URL = '/.netlify/functions/chat';
const MODEL = 'deepseek/deepseek-chat';
const CHAT_DURATION_MS = 90000;
const EXTENSION_MS = 600000;
const EXTENSION_COST = 30;
const PHOTO_UNLOCK_COST = 20;
const ROSE_GIFT_COST = 15;
const ROSE_GIFT_SRC = 'images/gifts/rose.gif';
const PHOTO_TAG = '[SEND_PHOTO]';
const PRICING_TAG = '[SHOW_PRICING]';
const TOPUP_TAG = '[SHOW_TOPUP]';

const ROSE_THANKS_FALLBACKS = [
  'o dziekuje za rozyczke to takie slodkie od ciebie',
  'aww dziekuje serducho',
  'jeej rozyczka bardzo milo',
  'dziekuje pieknie uwielbiam takie gesty',
  'o nie musiales ale dziekuje',
  'hej dzieki za roze to milo',
  'o super dziekuje jestes slodki',
  'dzieki za prezent nie musiales',
  'o rozyczka dziekuje ci serio',
  'aww dziekuje to miliutkie',
  'dzieki za roze zrobiło mi dzien lepszy',
  'o dziekuje jestes zloty',
  'rozyczka dziekuje to takie milo',
  'dzieki serio nie musiales a',
  'o dziekuje pieknie od ciebie',
  'hej dzieki za roze xd milo',
  'dziekuje ci to takie slodkie',
  'o dzieki za roze jestes kochany',
  'aw dziekuje za roze',
  'dzieki za roze to milutkie',
];

const MAX_API_HISTORY_MESSAGES = 14;

const QUICK_REPLY_RULES = [
  {
    test: (t) => /^(nie ma za co|nma za co|dzieki|dzięki|thx)\s*[;:)❤️🌹]*$/i.test(t),
    replies: ['hehe luz', 'spoko miło mi', 'aa luzik', 'no spoko'],
  },
  {
    test: (t) => /^(jesteś|jestes|tu jesteś|tu jestes|haloo?|halo|yy|ej)\s*\??$/i.test(t),
    replies: ['tak jestem a co', 'no jestem co tam', 'jestem no a co', 'tak tu jestem'],
  },
  {
    test: (t) => /^co tam(\s+u ciebie)?\s*\??$/i.test(t),
    replies: ['u mnie spoko a u ciebie', 'dobrze leżę a u ciebie co', 'spoko w domu a ty jak', 'wszystko git a u ciebie'],
  },
  {
    test: (t) => /^(a\s+)?co robisz(\s+teraz)?\s*\??$/i.test(t),
    replies: ['leżę i scrolluje właśnie a ty', 'nic specjalnego w domu a co u ciebie', 'właśnie się obijam a ty co robisz', 'siedzę w łóżku a ty'],
  },
  {
    test: (t) => /^(siema|hej|hejka|elo)\s*$/i.test(t),
    replies: ['siema co tam', 'hejka a co u ciebie', 'hej co tam'],
  },
];

const ROSE_THANKS_TONES = [
  'zaskoczona i uradowana, naturalnie',
  'słodko i trochę nieśmiało',
  'z lekkim humorem, luźno',
  'pewnie siebie, lekko flirtująco',
  'ciepło i szczerze, bez przesady',
  'jak w wiadomości do znajomego, krótko',
  'z lekką ironią w swoim stylu',
  'entuzjastycznie ale bez przesady',
  'spokojnie i miło',
  'zaskoczona pozytywnie, autentycznie',
];

let kolezanka = null;
let kolezankaId = null;
let chatHistory = [];
let timerHandle = null;
let chatPaused = false;
let typingBubbleEl = null;
let replyQueue = Promise.resolve();
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

/** Tempo pisania 155–185 znaków/min */
const TYPING_CPM_MIN = 155;
const TYPING_CPM_MAX = 185;
const TYPING_MIN_MS = 1200;
const TYPING_MAX_MS = 45000;
const REPLY_DELAY_MIN_MS = 5000;
const REPLY_DELAY_MAX_MS = 15000;
const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👍', '👏', '😍'];

let activeEmojiPicker = null;

function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function ensureMessageMeta(msg) {
  if (!msg.id) msg.id = generateMessageId();
  if (!msg.reactions || typeof msg.reactions !== 'object') msg.reactions = {};
  return msg;
}

function ensureHistoryMessageMeta(arr) {
  let changed = false;
  arr.forEach((msg) => {
    if (!msg.id) changed = true;
    if (!msg.reactions || typeof msg.reactions !== 'object') changed = true;
    ensureMessageMeta(msg);
  });
  return changed;
}

function closeAllEmojiPickers() {
  document.querySelectorAll('.message-emoji-picker').forEach((el) => el.remove());
  activeEmojiPicker = null;
}

function getMessageById(messageId) {
  return chatHistory.find((m) => m.id === messageId);
}

function renderReactionsInto(container, reactions, messageId) {
  if (!container) return;
  container.innerHTML = '';
  const entries = Object.entries(reactions || {}).filter(([, count]) => count > 0);
  if (!entries.length) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  entries.forEach(([emoji, count]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'message-reaction';
    btn.textContent = count > 1 ? `${emoji} ${count}` : emoji;
    btn.title = 'Kliknij, aby usunąć reakcję';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleReaction(messageId, emoji);
    });
    container.appendChild(btn);
  });
}

function updateReactionsInDom(messageId, reactions) {
  const wrap = getMessagesBox()?.querySelector(`[data-message-id="${messageId}"]`);
  if (!wrap) return;
  const reactionsEl = wrap.querySelector('.message-reactions');
  if (reactionsEl) renderReactionsInto(reactionsEl, reactions, messageId);
}

function toggleReaction(messageId, emoji) {
  const msg = getMessageById(messageId);
  if (!msg) return;
  ensureMessageMeta(msg);
  if (msg.reactions[emoji]) {
    delete msg.reactions[emoji];
  } else {
    msg.reactions[emoji] = 1;
  }
  saveHistory();
  updateReactionsInDom(messageId, msg.reactions);
}

function createEmojiPicker(messageId, anchorEl) {
  closeAllEmojiPickers();
  const picker = document.createElement('div');
  picker.className = 'message-emoji-picker';
  picker.setAttribute('role', 'menu');

  REACTION_EMOJIS.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'message-emoji-picker__btn';
    btn.textContent = emoji;
    btn.setAttribute('role', 'menuitem');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const msg = getMessageById(messageId);
      if (msg) {
        ensureMessageMeta(msg);
        msg.reactions[emoji] = (msg.reactions[emoji] || 0) + 1;
        saveHistory();
        updateReactionsInDom(messageId, msg.reactions);
      }
      closeAllEmojiPickers();
    });
    picker.appendChild(btn);
  });

  anchorEl.appendChild(picker);
  activeEmojiPicker = picker;
}

function createTextMessageWrap(text, fromUser, messageMeta = null) {
  const meta = messageMeta
    ? ensureMessageMeta({ ...messageMeta })
    : ensureMessageMeta({ role: fromUser ? 'user' : 'assistant', content: text });

  const wrap = document.createElement('div');
  wrap.className = `message-wrap message-wrap--${fromUser ? 'user' : 'her'}`;
  wrap.dataset.messageId = meta.id;

  const bubble = document.createElement('div');
  bubble.className = `message-bubble message-bubble--${fromUser ? 'user' : 'her'} message-bubble--fade`;
  bubble.textContent = text;

  const footer = document.createElement('div');
  footer.className = 'message-wrap__footer';

  const reactions = document.createElement('div');
  reactions.className = 'message-reactions';
  reactions.hidden = true;
  renderReactionsInto(reactions, meta.reactions, meta.id);

  const reactBtn = document.createElement('button');
  reactBtn.type = 'button';
  reactBtn.className = 'message-react-btn';
  reactBtn.setAttribute('aria-label', 'Dodaj reakcję');
  reactBtn.textContent = '😊';
  reactBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeEmojiPicker?.parentElement === footer) {
      closeAllEmojiPickers();
    } else {
      createEmojiPicker(meta.id, footer);
    }
  });

  footer.appendChild(reactions);
  footer.appendChild(reactBtn);
  wrap.appendChild(bubble);
  wrap.appendChild(footer);
  return { wrap, meta };
}

function placeMessageWrapInBox(wrap, afterMessageId = null) {
  const box = getMessagesBox();
  if (!box || !wrap) return;

  if (afterMessageId) {
    const anchor = box.querySelector(`[data-message-id="${afterMessageId}"]`);
    if (anchor?.parentNode === box) {
      anchor.insertAdjacentElement('afterend', wrap);
    } else {
      box.appendChild(wrap);
    }
  } else {
    box.appendChild(wrap);
  }
  scrollToBottom();
}

function mountTextMessage(text, fromUser, messageMeta = null) {
  const box = getMessagesBox();
  if (!box || !text.trim()) return null;

  const { wrap, meta } = createTextMessageWrap(text, fromUser, messageMeta);
  placeMessageWrapInBox(wrap);
  return meta;
}

function insertTextMessageAfter(afterMessageId, text, fromUser, messageMeta = null) {
  if (!text.trim()) return null;
  const { wrap, meta } = createTextMessageWrap(text, fromUser, messageMeta);
  placeMessageWrapInBox(wrap, afterMessageId);
  return meta;
}

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

async function waitBeforeReplyDelay() {
  const ms =
    REPLY_DELAY_MIN_MS + Math.random() * (REPLY_DELAY_MAX_MS - REPLY_DELAY_MIN_MS);
  await sleep(Math.round(ms));
}

async function waitFullTypingDuration(text) {
  await sleep(estimateTypingDuration(text));
}

function isGiftUserMessage(msg) {
  return msg?.role === 'user' && msg?.type === 'gift';
}

function isUserMessageAlreadyAnswered(userMessageIndex) {
  const current = chatHistory[userMessageIndex];
  if (isGiftUserMessage(current)) {
    return chatHistory[userMessageIndex + 1]?.role === 'assistant';
  }

  for (let i = userMessageIndex + 1; i < chatHistory.length; i += 1) {
    const msg = chatHistory[i];
    if (msg.role === 'assistant') return true;
    if (msg.role === 'user' && !isGiftUserMessage(msg)) return false;
  }
  return false;
}

function getFirstUnansweredUserIndex() {
  for (let i = 0; i < chatHistory.length; i += 1) {
    const msg = chatHistory[i];
    if (msg.role === 'user' && !isGiftUserMessage(msg) && !isUserMessageAlreadyAnswered(i)) {
      return i;
    }
  }
  return -1;
}

function findLastUnansweredRoseGiftIndex() {
  for (let i = chatHistory.length - 1; i >= 0; i -= 1) {
    const msg = chatHistory[i];
    if (msg.role === 'user' && msg.type === 'gift' && msg.giftId === 'rose' && !isUserMessageAlreadyAnswered(i)) {
      return i;
    }
  }
  return -1;
}

function historyMessageToApiContent(msg) {
  if (isGiftUserMessage(msg)) {
    if (msg.giftId === 'rose') return '[User wysłał Ci wirtualną różę 🌹 — już podziękowałaś]';
    return '[User wysłał Ci prezent — już podziękowałaś]';
  }
  return msg.content;
}

function normalizeUserText(text) {
  return (text || '').trim().replace(/\s+/g, ' ');
}

function tryQuickReply(userText) {
  const t = normalizeUserText(userText).toLowerCase();
  if (!t) return null;

  for (const rule of QUICK_REPLY_RULES) {
    if (rule.test(t)) {
      const replies = rule.replies;
      const pick = replies[Math.floor(Math.random() * replies.length)];
      return pick;
    }
  }
  return null;
}

function getReplyIntentHint(userText) {
  const t = normalizeUserText(userText).toLowerCase();

  if (/^(jesteś|jestes|tu jesteś|tu jestes|haloo?|halo)\s*\??$/.test(t)) {
    return 'User pyta czy jesteś online — potwierdź krótko (np. "tak jestem a co"). NIE chwal go za słodycz ani nie mów o róży.';
  }
  if (/co tam/.test(t)) {
    return 'User pyta jak się masz — powiedz co u ciebie i zapytaj o niego. NIE dziękuj za różę ani prezent.';
  }
  if (/co robisz|czym się zajmujesz/.test(t)) {
    return 'User pyta co teraz robisz — opisz krótko czynność (np. leżysz, scrollujesz). NIE mów o "miłej rozmowie" ani ogólnikach.';
  }
  if (/nie ma za co|nma za co/.test(t)) {
    return 'User mówi "nie ma za co" — przyjmij krótko ("luz", "miło mi"). NIE pisz że jest słodki.';
  }
  if (/\?/.test(t)) {
    return 'User zadał pytanie — odpowiedz na to pytanie wprost. Bez ogólników typu "miło że mamy rozmowę" lub "miło z twojej strony".';
  }
  return 'Odpowiedz konkretnie na ostatnią wiadomość usera. Bez pustych komplementów i ogólników.';
}

function isOffTopicReply(reply, userText) {
  const r = (reply || '').toLowerCase();
  const u = normalizeUserText(userText).toLowerCase();
  const genericBad =
    /miło że (mamy|jesteś)|miło z twojej strony|taką miłą rozmowę|jesteś (taki )?słodki|miło że mamy taką/;
  if (!genericBad.test(r)) return false;
  return /\?/.test(u) || /co tam|co robisz|jesteś|jestes|czym się/.test(u);
}

function pickRoseThankYouFallback() {
  const base = Math.floor(Math.random() * ROSE_THANKS_FALLBACKS.length);
  const offset = (kolezankaId || 0) + Date.now();
  return ROSE_THANKS_FALLBACKS[(base + offset) % ROSE_THANKS_FALLBACKS.length];
}

function buildRoseThankYouMessages() {
  const systemPrompt = window.KOLEZANKI_PROMPTS?.[kolezankaId];
  if (!systemPrompt) throw new Error('Brak promptu');

  const tone = ROSE_THANKS_TONES[Math.floor(Math.random() * ROSE_THANKS_TONES.length)];
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const taskPrompt = `${systemPrompt}

ZADANIE JEDNORAZOWE (tylko podziękowanie za różę — nie kontynuuj dalszej rozmowy):
User właśnie wysłał Ci WIRTUALNĄ RÓŻĘ 🌹 jako płatny prezent w czacie.
Napisz jedno krótkie podziękowanie (max 1 zdanie, styl Messenger/SMS).
Ton tej odpowiedzi: ${tone}.
Wariant losowy: ${nonce} — użyj innych słów niż w poprzednich podziękowaniach.
Nie pytaj o nic. Nie proponuj cennika ani fotek. Bez tagów [SEND_PHOTO], [SHOW_PRICING], [SHOW_TOPUP].
Emoji 🌹 opcjonalnie (max 1), nie w każdej odpowiedzi.`;

  return [
    { role: 'system', content: taskPrompt },
    { role: 'user', content: '[User wysłał Ci wirtualną różę 🌹]' },
  ];
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

function sanitizeChatHistory(arr) {
  if (!Array.isArray(arr) || !arr.length) return [];
  const firstUser = arr.findIndex((m) => m.role === 'user');
  if (firstUser === -1) return [];
  return arr.slice(firstUser);
}

function loadHistory(id) {
  try {
    const raw = JSON.parse(localStorage.getItem(historyKey(id)) || '[]');
    if (!Array.isArray(raw)) return [];

    const arr = sanitizeChatHistory(raw);
    const metaChanged = ensureHistoryMessageMeta(arr);

    if (arr.length !== raw.length || metaChanged) {
      if (arr.length === 0) {
        localStorage.removeItem(historyKey(id));
        localStorage.removeItem(chatUpdatedKey(id));
      } else {
        localStorage.setItem(historyKey(id), JSON.stringify(arr));
      }
    }

    return arr;
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
  if (typeof window.getProfileAvatarPath === 'function') {
    return window.getProfileAvatarPath(id);
  }
  return `images/profiles/natalia.png`;
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

function appendTextBubble(text, fromUser, messageMeta = null) {
  return mountTextMessage(text, fromUser, messageMeta);
}

function getKolezankaDisplayName() {
  return kolezanka?.imie || kolezanka?.name || 'koleżance';
}

function appendRoseGiftBubble(messageMeta = null) {
  const box = getMessagesBox();
  if (!box) return null;

  const meta = messageMeta
    ? ensureMessageMeta({ ...messageMeta })
    : ensureMessageMeta({
        role: 'user',
        type: 'gift',
        giftId: 'rose',
        content: 'Wysłałem wirtualną różę 🌹',
      });

  const wrap = document.createElement('div');
  wrap.className = 'message-wrap message-wrap--user';
  wrap.dataset.messageId = meta.id;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble message-bubble--user message-bubble--gift message-bubble--fade';

  const img = document.createElement('img');
  img.src = ROSE_GIFT_SRC;
  img.alt = 'Wirtualna róża';
  img.className = 'chat-gift-image';
  img.loading = 'eager';
  img.onerror = () => {
    img.remove();
    const fallback = document.createElement('span');
    fallback.className = 'composer-gift-icon--fallback';
    fallback.textContent = '🌹';
    fallback.style.fontSize = '3rem';
    bubble.prepend(fallback);
  };
  bubble.appendChild(img);

  const caption = document.createElement('span');
  caption.className = 'chat-gift-caption';
  caption.textContent = 'Wirtualna róża 🌹';
  bubble.appendChild(caption);

  wrap.appendChild(bubble);
  box.appendChild(wrap);
  scrollToBottom();
  return meta;
}

function closeRoseGiftModal() {
  const modal = document.getElementById('rose-gift-modal');
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }
}

function openRoseGiftModal() {
  if (!kolezankaId) {
    if (typeof showToast === 'function') showToast('Wybierz rozmowę, aby wysłać prezent.');
    return;
  }
  if (chatPaused) {
    if (typeof showToast === 'function') showToast('Czat jest wstrzymany — doładuj żetony lub przedłuż rozmowę.');
    return;
  }

  const modal = document.getElementById('rose-gift-modal');
  const textEl = document.getElementById('rose-gift-text');
  const name = getKolezankaDisplayName();

  if (textEl) {
    textEl.textContent = '';
    textEl.append('Czy na pewno chcesz podarować wirtualną różę użytkowniczce ');
    const strong = document.createElement('strong');
    strong.textContent = name;
    textEl.append(strong, `? Koszt: ${ROSE_GIFT_COST} żetonów.`);
  }

  if (modal) {
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }
}

async function runRoseThankYouReply() {
  if (chatPaused) return;

  const giftIndex = findLastUnansweredRoseGiftIndex();
  if (giftIndex === -1) return;

  try {
    await waitBeforeReplyDelay();
    if (chatPaused) return;

    setTyping(true);

    let reply;
    try {
      reply = await callOpenRouter(buildRoseThankYouMessages(), { temperature: 0.95 });
    } catch (err) {
      console.error(err);
      reply = pickRoseThankYouFallback();
    }

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
    await processAssistantReply(reply, giftIndex);
  } catch (err) {
    setTyping(false);
    console.error(err);
  }
}

async function sendRoseGift() {
  closeRoseGiftModal();

  if (!kolezankaId || chatPaused || userSendLocked) {
    if (typeof showToast === 'function') showToast('Nie można teraz wysłać prezentu.');
    return;
  }

  const balance = typeof getTokenBalance === 'function' ? getTokenBalance() : 0;
  if (balance < ROSE_GIFT_COST) {
    if (typeof showToast === 'function') showToast(`Za mało żetonów — potrzebujesz ${ROSE_GIFT_COST}.`);
    openTopupModal();
    return;
  }

  if (typeof setTokenBalance === 'function') {
    setTokenBalance(balance - ROSE_GIFT_COST);
  }
  if (typeof syncTokenDisplay === 'function') syncTokenDisplay();
  if (typeof updateInboxPricingBalance === 'function') updateInboxPricingBalance();

  const userMeta = ensureMessageMeta({
    role: 'user',
    type: 'gift',
    giftId: 'rose',
    content: 'Wysłałem wirtualną różę 🌹',
  });
  appendRoseGiftBubble(userMeta);
  chatHistory.push(userMeta);
  saveHistory();

  if (typeof renderInboxContacts === 'function' && chatUi.mode === 'inbox') {
    renderInboxContacts(document.getElementById('inbox-search')?.value || '');
  }

  if (!getSessionEnd(kolezankaId)) {
    setSessionEnd(kolezankaId, Date.now() + CHAT_DURATION_MS);
    startChatTimer();
  }

  if (typeof showToast === 'function') showToast('Wysłano wirtualną różę!');
  await enqueueBotReply(runRoseThankYouReply);
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
    ensureMessageMeta(msg);
    if (msg.role === 'user') {
      if (msg.type === 'gift' && msg.giftId === 'rose') {
        appendRoseGiftBubble(msg);
        return;
      }
      const text = stripAllTags(msg.content);
      if (text) appendTextBubble(text, true, msg);
    } else if (msg.role === 'assistant') {
      const parsed = parseAssistantTags(msg.content);
      if (parsed.text) appendTextBubble(parsed.text, false, msg);
      if (parsed.showPricing || parsed.showTopup) appendActionButtons(parsed);
      if (parsed.sendPhoto) {
        const photoIndex = countPhotosBeforeHistoryIndex(idx);
        appendPhotoBubble(photoPath(kolezankaId, photoIndex), kolezankaId, photoIndex);
      }
    }
  });
}

async function callOpenRouter(messages, options = {}) {
  const res = await fetch(CHAT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, ...options }),
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Pusta odpowiedź API');
  return content;
}

function buildApiMessagesUpTo(endIndex) {
  const systemPrompt = window.KOLEZANKI_PROMPTS?.[kolezankaId];
  if (!systemPrompt) throw new Error('Brak promptu');

  const lastIndex = Math.min(endIndex, chatHistory.length - 1);
  const targetMsg = chatHistory[lastIndex];
  const targetText =
    targetMsg?.role === 'user' && !isGiftUserMessage(targetMsg)
      ? stripAllTags(targetMsg.content) || targetMsg.content
      : '';

  let systemContent = systemPrompt;
  if (targetText) {
    systemContent += `\n\n=== TERAZ ODPOWIADASZ NA: „${targetText}” ===\n${getReplyIntentHint(targetText)}`;
  }

  const messages = [{ role: 'system', content: systemContent }];

  let startIndex = Math.max(0, lastIndex - MAX_API_HISTORY_MESSAGES + 1);
  while (startIndex > 0 && chatHistory[startIndex]?.role === 'assistant') {
    startIndex -= 1;
  }

  for (let i = startIndex; i <= lastIndex; i += 1) {
    messages.push({
      role: chatHistory[i].role,
      content: historyMessageToApiContent(chatHistory[i]),
    });
  }

  if (targetText) {
    messages.push({
      role: 'user',
      content: `(Odpowiedz teraz tylko na: „${targetText}”)`,
    });
  }

  return messages;
}

async function replyToUserMessageAt(userMessageIndex) {
  const userText = stripAllTags(chatHistory[userMessageIndex]?.content) || '';

  const quick = tryQuickReply(userText);
  if (quick) {
    await waitBeforeReplyDelay();
    if (chatPaused) return;
    setTyping(true);
    await waitFullTypingDuration(quick);
    if (chatPaused) {
      setTyping(false);
      return;
    }
    setTyping(false);
    await processAssistantReply(quick, userMessageIndex);
    return;
  }

  await waitBeforeReplyDelay();
  if (chatPaused) return;

  setTyping(true);

  let reply = await callOpenRouter(buildApiMessagesUpTo(userMessageIndex), { temperature: 0.72 });

  if (isOffTopicReply(reply, userText)) {
    const retryMessages = buildApiMessagesUpTo(userMessageIndex);
    retryMessages[0].content += `\n\nPOPRZEDNIA ODPOWIEDŹ BYŁA ZŁA (nie na temat). Napisz INACZEJ — konkretnie na: „${userText}”.`;
    reply = await callOpenRouter(retryMessages, { temperature: 0.55 });
  }

  if (isOffTopicReply(reply, userText)) {
    reply = tryQuickReply(userText) || reply;
  }

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
  await processAssistantReply(reply, userMessageIndex);
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

  try {
    while (!chatPaused) {
      const userMessageIndex = getFirstUnansweredUserIndex();
      if (userMessageIndex === -1) break;

      try {
        await replyToUserMessageAt(userMessageIndex);
      } catch (err) {
        const userText = stripAllTags(chatHistory[userMessageIndex]?.content) || '';
        const fallback = tryQuickReply(userText) || 'kurde cos nie poszlo, sprobuj jeszcze raz';
        if (!chatPaused && !isUserMessageAlreadyAnswered(userMessageIndex)) {
          if (!typingBubbleEl) setTyping(true);
          await waitFullTypingDuration(fallback);
          setTyping(false);
          await processAssistantReply(fallback, userMessageIndex);
        } else {
          setTyping(false);
        }
        console.error(err);
      }
    }
  } catch (err) {
    setTyping(false);
    console.error(err);
  }
}

async function processAssistantReply(rawReply, insertAfterIndex = null) {
  const parsed = parseAssistantTags(rawReply);

  const assistantMeta = ensureMessageMeta({ role: 'assistant', content: rawReply });

  if (insertAfterIndex !== null && insertAfterIndex >= 0 && insertAfterIndex < chatHistory.length) {
    chatHistory.splice(insertAfterIndex + 1, 0, assistantMeta);
    const anchorId = chatHistory[insertAfterIndex]?.id;
    if (parsed.text) insertTextMessageAfter(anchorId, parsed.text, false, assistantMeta);
  } else {
    chatHistory.push(assistantMeta);
    if (parsed.text) appendTextBubble(parsed.text, false, assistantMeta);
  }

  saveHistory();

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

  const userMeta = ensureMessageMeta({ role: 'user', content: text });
  appendTextBubble(text, true, userMeta);
  chatHistory.push(userMeta);
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

function getGiftButtons() {
  return [document.getElementById('chat-gift'), document.getElementById('inbox-thread-gift')].filter(Boolean);
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
  getGiftButtons().forEach((btn) => {
    btn.disabled = true;
  });
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
  getGiftButtons().forEach((btn) => {
    btn.disabled = false;
  });
}

function showExtensionModal() {
  disableComposer('Czas minął — doładuj żetony');

  const modal = document.getElementById('chat-extension-modal');
  const text = document.getElementById('chat-extension-text');
  const balanceEl = document.getElementById('chat-extension-balance');
  const name = kolezanka?.imie || kolezanka?.name || 'koleżanką';

  if (text) {
    const balance = typeof getTokenBalance === 'function' ? getTokenBalance() : 0;
    if (balance >= EXTENSION_COST) {
      text.textContent = `Czas rozmowy z ${name} minął. Masz wystarczająco żetonów — przedłuż czat o 10 minut za ${EXTENSION_COST} żetonów albo doładuj portfel na przyszłość.`;
    } else {
      text.textContent = `Czas rozmowy z ${name} minął. Aby kontynuować rozmowę, doładuj żetony — potrzebujesz ${EXTENSION_COST} żetonów na przedłużenie o 10 minut.`;
    }
  }
  if (balanceEl && typeof getTokenBalance === 'function') {
    balanceEl.textContent = getTokenBalance().toLocaleString('pl-PL');
  }

  if (modal) {
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }

  if (typeof showToast === 'function') {
    showToast('Czas rozmowy minął — doładuj żetony, aby kontynuować czat.');
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
        if (item.id === 'shop-rose') {
          closeChatPricingModal();
          openRoseGiftModal();
          return;
        }
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
  if (typeof openTokenShop === 'function') {
    openTokenShop();
    return;
  }

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
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.message-wrap__footer') && !e.target.closest('.message-emoji-picker')) {
      closeAllEmojiPickers();
    }
  });

  document.getElementById('chat-extension-extend')?.addEventListener('click', extendChatSession);
  document.getElementById('chat-extension-topup')?.addEventListener('click', () => {
    hideExtensionModal();
    openTopupModal();
  });
  document.getElementById('chat-extension-close')?.addEventListener('click', hideExtensionModal);
  document.querySelector('#chat-extension-modal .end-modal-overlay')?.addEventListener('click', hideExtensionModal);

  document.getElementById('chat-pricing-close')?.addEventListener('click', closeChatPricingModal);
  document.getElementById('chat-pricing-backdrop')?.addEventListener('click', closeChatPricingModal);

  document.getElementById('chat-topup-close')?.addEventListener('click', closeTopupModal);
  document.getElementById('chat-topup-backdrop')?.addEventListener('click', closeTopupModal);

  document.getElementById('rose-gift-confirm')?.addEventListener('click', () => {
    sendRoseGift();
  });
  document.getElementById('rose-gift-cancel')?.addEventListener('click', closeRoseGiftModal);
  document.getElementById('rose-gift-overlay')?.addEventListener('click', closeRoseGiftModal);

  const cryptoBtn = document.getElementById('chat-topup-crypto');
  const discordBtn = document.getElementById('chat-topup-discord');
  if (cryptoBtn) {
    cryptoBtn.href = typeof TOPUP_CRYPTO_URL !== 'undefined' ? TOPUP_CRYPTO_URL : '#';
  }
  if (discordBtn) {
    discordBtn.href = typeof TOPUP_DISCORD_URL !== 'undefined' ? TOPUP_DISCORD_URL : '#';
  }
}

function setupGiftButtonIcon(btn) {
  if (!btn || btn.dataset.giftIconReady) return;
  btn.dataset.giftIconReady = '1';
  const img = btn.querySelector('.composer-gift-icon');
  if (!img) return;
  img.addEventListener('error', () => {
    img.remove();
    const fallback = document.createElement('span');
    fallback.className = 'composer-gift-icon--fallback';
    fallback.textContent = '🌹';
    fallback.setAttribute('aria-hidden', 'true');
    btn.appendChild(fallback);
  }, { once: true });
}

function bindRoseGiftButtons() {
  ['chat-gift', 'inbox-thread-gift'].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn || btn.dataset.roseBound) return;
    btn.dataset.roseBound = '1';
    setupGiftButtonIcon(btn);
    btn.addEventListener('click', openRoseGiftModal);
  });
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
  openRoseGiftModal,
  sendRoseGift,
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
  bindRoseGiftButtons();
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
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindModals();
  bindRoseGiftButtons();
  if (document.body.classList.contains('page-chat')) {
    initAiChat();
  }
});
