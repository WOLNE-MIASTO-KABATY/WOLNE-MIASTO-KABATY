/**
 * OFland.pl — AI czat (OpenRouter)
 */

// ⚠️ WKLEJ TUTAJ SWÓJ KLUCZ OPENROUTER:
const OPENROUTER_API_KEY = 'potem';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'deepseek/deepseek-chat';
const CHAT_DURATION_MS = 90000;
const COOLDOWN_MS = 600000;
const PHOTO_TAG = '[SEND_PHOTO]';
const TALKED_TO_KEY = 'talked_to';
const COOLDOWN_KEY = 'cooldown_until';

let kolezanka = null;
let kolezankaId = null;
let chatHistory = [];
let timerHandle = null;
let chatEnded = false;
let typingBubbleEl = null;
let replyQueue = Promise.resolve();

const WELCOME_INSTRUCTION =
  'Napisz pierwszą wiadomość powitalną — krótko, ale nie jednym słowem. Jedno zdanie, ok. 6–15 słów. Np: "hej, w końcu ktoś normalny pisze" / "siemka, co tam u ciebie?" / "hejka ;) dopiero weszlam na czat". Naturalnie, lekko flirciarsko, bez eseju.';

const WELCOME_FALLBACKS = [
  'hej, co tam u ciebie?',
  'siemka, w końcu ktoś pisze',
  'hejka ;) co slychac',
  'siema, co tam',
  'hej, milego wieczoru',
  'yo, co tam',
];

/** Symulacja tempa pisania — 220 znaków/min (~273 ms/znak) */
const TYPING_MS_PER_CHAR = 273;
const TYPING_BASE_MS = 0;
const TYPING_MIN_MS = 2400;
const TYPING_MAX_MS = 45000;
const TYPING_REACTION_MIN_MS = 1000;
const TYPING_REACTION_MAX_MS = 5000;

function estimateTypingDuration(text) {
  const len = Math.max(1, (text || '').trim().length);
  const jitter = 1.05 + Math.random() * 0.45;
  const ms = TYPING_BASE_MS + len * TYPING_MS_PER_CHAR * jitter;
  return Math.round(Math.min(TYPING_MAX_MS, Math.max(TYPING_MIN_MS, ms)));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Losowa cisza 1–5 s zanim pojawi się dymek „pisze…”. */
async function waitRandomReactionDelay() {
  const ms =
    TYPING_REACTION_MIN_MS +
    Math.random() * (TYPING_REACTION_MAX_MS - TYPING_REACTION_MIN_MS);
  await sleep(Math.round(ms));
}

/** Pełny czas „pisania” z widocznym dymkiem — zależny od liczby znaków. */
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
  if (clean.length <= 110 && clean.split(/\s+/).length <= 18) return clean;
  const firstSentence = clean.split(/[.!?]/)[0].trim();
  if (firstSentence.length >= 8 && firstSentence.length <= 110) return firstSentence;
  return clean.slice(0, 100).trim();
}

function getQueryId() {
  return parseInt(new URLSearchParams(window.location.search).get('id'), 10);
}

function getTalkedTo() {
  try {
    const arr = JSON.parse(localStorage.getItem(TALKED_TO_KEY) || '[]');
    return Array.isArray(arr) ? arr.map(Number) : [];
  } catch {
    return [];
  }
}

function addTalkedTo(id) {
  const arr = getTalkedTo();
  if (!arr.includes(id)) {
    arr.push(id);
    localStorage.setItem(TALKED_TO_KEY, JSON.stringify(arr));
  }
}

function isCooldownActive() {
  const until = parseInt(localStorage.getItem(COOLDOWN_KEY), 10);
  return Number.isFinite(until) && Date.now() < until;
}

function historyKey(id) {
  return `chat_history_${id}`;
}

function photoCountKey(id) {
  return `photo_count_${id}`;
}

function chatStartKey(id) {
  return `chat_start_${id}`;
}

function loadHistory(id) {
  try {
    const arr = JSON.parse(localStorage.getItem(historyKey(id)) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function chatUpdatedKey(id) {
  return `chat_updated_${id}`;
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
  const next = getPhotoCount(id) + 1;
  localStorage.setItem(photoCountKey(id), String(next));
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
  if (!Number.isFinite(id) || id < 1 || id > 10) return false;
  if (getTalkedTo().includes(id)) return false;
  if (isCooldownActive()) return false;
  return true;
}

function setTyping(visible) {
  const box = document.getElementById('chat-messages');
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
  const box = document.getElementById('chat-messages');
  if (box) box.scrollTop = box.scrollHeight;
}

function appendTextBubble(text, fromUser) {
  const box = document.getElementById('chat-messages');
  if (!box || !text.trim()) return;

  const bubble = document.createElement('div');
  bubble.className = `message-bubble message-bubble--${fromUser ? 'user' : 'her'} message-bubble--fade`;
  bubble.textContent = text;
  box.appendChild(bubble);
  scrollToBottom();
}

function appendPhotoBubble(src, blurred) {
  const box = document.getElementById('chat-messages');
  if (!box) return;

  const wrap = document.createElement('div');
  wrap.className = 'message-bubble message-bubble--her message-bubble--photo message-bubble--fade';

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
    btn.textContent = '🔒 ODBLOKUJ ZDJĘCIE';
    btn.addEventListener('click', () => {
      window.location.href = '#';
    });
    overlay.appendChild(btn);
    photoWrap.appendChild(overlay);
  }

  wrap.appendChild(photoWrap);
  box.appendChild(wrap);
  scrollToBottom();
}

function stripPhotoTag(text) {
  return text.replace(/\s*\[SEND_PHOTO\]\s*/gi, '').trim();
}

function hasPhotoTag(text) {
  return /\[SEND_PHOTO\]/i.test(text);
}

function renderHistoryMessages() {
  const box = document.getElementById('chat-messages');
  if (box) box.innerHTML = '';

  chatHistory.forEach((msg) => {
    if (msg.role === 'user') {
      appendTextBubble(msg.content, true);
    } else if (msg.role === 'assistant') {
      const clean = stripPhotoTag(msg.content);
      if (clean) appendTextBubble(clean, false);
    }
  });
}

async function callOpenRouter(messages) {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'WKLEJE_TUTAJ') {
    throw new Error('Brak klucza API OpenRouter w chat.js');
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://braszkamc-dev.github.io',
      'X-Title': 'WolneMastoKabaty',
    },
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

async function fetchWelcomeMessage() {
  const apiPromise = callOpenRouter(buildApiMessages(true));

  try {
    await waitRandomReactionDelay();
    setTyping(true);

    const reply = await apiPromise;
    const message = trimWelcomeReply(reply);
    await waitFullTypingDuration(message);
    setTyping(false);
    appendTextBubble(message, false);
    chatHistory.push({ role: 'assistant', content: message });
    saveHistory();
  } catch (err) {
    const fallback = WELCOME_FALLBACKS[kolezankaId % WELCOME_FALLBACKS.length];
    if (!typingBubbleEl) setTyping(true);
    await waitFullTypingDuration(fallback);
    setTyping(false);
    appendTextBubble(fallback, false);
    chatHistory.push({ role: 'assistant', content: fallback });
    saveHistory();
    console.error(err);
  }
}

function handlePhotoSend() {
  const count = getPhotoCount(kolezankaId);
  const photoIndex = Math.min(count + 1, 5);
  appendPhotoBubble(photoPath(kolezankaId, photoIndex), count >= 1);
  incrementPhotoCount(kolezankaId);
}

/** Kolejka — każda odpowiedź bota osobno: kropki + czas zależny od długości tekstu */
function enqueueBotReply(task) {
  replyQueue = replyQueue
    .then(() => task())
    .catch((err) => console.error(err));
}

async function runBotReplyCycle() {
  if (chatEnded) return;

  const userMessageIndex = getFirstUnansweredUserIndex();
  if (userMessageIndex === -1) return;

  const apiPromise = callOpenRouter(buildApiMessagesUpTo(userMessageIndex));

  try {
    await waitRandomReactionDelay();
    if (chatEnded) return;

    setTyping(true);

    const reply = await apiPromise;
    if (chatEnded) {
      setTyping(false);
      return;
    }

    const preview = stripPhotoTag(reply) || reply;
    await waitFullTypingDuration(preview);

    if (chatEnded) {
      setTyping(false);
      return;
    }

    setTyping(false);
    await processAssistantReply(reply);
  } catch (err) {
    const fallback = 'kurde cos nie poszlo, sprobuj jeszcze raz';
    if (!chatEnded) {
      if (!typingBubbleEl) setTyping(true);
      await waitFullTypingDuration(fallback);
      setTyping(false);
      appendTextBubble(fallback, false);
    } else {
      setTyping(false);
    }
    console.error(err);
  }
}

async function processAssistantReply(rawReply) {
  const sendPhoto = hasPhotoTag(rawReply);
  const cleanText = stripPhotoTag(rawReply);

  chatHistory.push({ role: 'assistant', content: rawReply });
  saveHistory();

  if (cleanText) appendTextBubble(cleanText, false);
  if (sendPhoto) handlePhotoSend();
}

async function sendUserMessage(text) {
  if (chatEnded || !text.trim()) return;

  appendTextBubble(text, true);
  chatHistory.push({ role: 'user', content: text });
  saveHistory();

  const startKey = chatStartKey(kolezankaId);
  if (!localStorage.getItem(startKey)) {
    localStorage.setItem(startKey, String(Date.now()));
    startChatTimer();
  }

  enqueueBotReply(runBotReplyCycle);
}

function disableComposer() {
  chatEnded = true;
  const input = document.getElementById('chat-input');
  const send = document.getElementById('chat-send');
  if (input) {
    input.disabled = true;
    input.placeholder = 'Rozmowa zakończona';
  }
  if (send) send.disabled = true;
}

function showEndModal() {
  disableComposer();

  const modal = document.getElementById('chat-end-modal');
  const text = document.getElementById('chat-end-text');
  const affiliate = document.getElementById('chat-end-affiliate');

  if (text && kolezanka) {
    text.textContent = `Aby kontynuować rozmowę z ${kolezanka.imie}, przejdź do jej strony`;
  }
  if (affiliate && kolezanka) {
    affiliate.textContent = `PRZEJDŹ DO ${kolezanka.imie.toUpperCase()}`;
    affiliate.href = '#';
  }

  if (modal) {
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }

  addTalkedTo(kolezankaId);
  localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS));
  localStorage.removeItem(historyKey(kolezankaId));
  localStorage.removeItem(photoCountKey(kolezankaId));
  localStorage.removeItem(chatStartKey(kolezankaId));
}

function startChatTimer() {
  if (timerHandle) clearTimeout(timerHandle);

  const startTime = parseInt(localStorage.getItem(chatStartKey(kolezankaId)), 10);
  if (!Number.isFinite(startTime)) return;

  const remaining = Math.max(0, CHAT_DURATION_MS - (Date.now() - startTime));
  timerHandle = setTimeout(showEndModal, remaining);
}

function bindComposer() {
  const input = document.getElementById('chat-input');
  const send = document.getElementById('chat-send');

  const doSend = () => {
    if (!input || chatEnded) return;
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

async function initAiChat() {
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

  chatHistory = loadHistory(kolezankaId);

  if (chatHistory.length > 0) {
    renderHistoryMessages();
    if (localStorage.getItem(chatStartKey(kolezankaId))) startChatTimer();
  } else {
    await fetchWelcomeMessage();
  }
}

document.addEventListener('DOMContentLoaded', initAiChat);
