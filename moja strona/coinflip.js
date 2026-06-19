/**
 * DyskiHub.pl — Coinflip
 */

const COINFLIP_API = '/.netlify/functions/coinflip';
const MIN_BET = 5;
const MAX_BET = 1000;
const BET_PRESETS = [5, 10, 25, 50, 100];
const FLIP_DURATION_MS = 2200;
const HISTORY_KEY = 'dyskihub-coinflip-history';
const STATS_KEY = 'dyskihub-coinflip-stats';

const state = {
  bet: MIN_BET,
  choice: null,
  flipping: false,
  wins: 0,
  losses: 0,
  history: [],
  canFlip: true,
  nextFlipAt: null,
  secondsRemaining: 0,
};

let countdownTimer = null;

function isLoggedIn() {
  return Boolean(window.DyskiAuth?.getAccessToken?.());
}

function getStatsStorageKey() {
  const user = window.DyskiAuth?.getCurrentUser?.();
  return user ? `${STATS_KEY}-${user.id}` : STATS_KEY;
}

function getHistoryStorageKey() {
  const user = window.DyskiAuth?.getCurrentUser?.();
  return user ? `${HISTORY_KEY}-${user.id}` : HISTORY_KEY;
}

function loadPersistedData() {
  try {
    const stats = JSON.parse(localStorage.getItem(getStatsStorageKey()) || '{}');
    state.wins = stats.wins || 0;
    state.losses = stats.losses || 0;
    state.history = JSON.parse(localStorage.getItem(getHistoryStorageKey()) || '[]');
  } catch {
    state.wins = 0;
    state.losses = 0;
    state.history = [];
  }
}

function saveStats() {
  localStorage.setItem(getStatsStorageKey(), JSON.stringify({ wins: state.wins, losses: state.losses }));
}

function saveHistory() {
  localStorage.setItem(getHistoryStorageKey(), JSON.stringify(state.history.slice(0, 20)));
}

function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function applyFlipStatus(data) {
  state.canFlip = Boolean(data.canFlip);
  state.nextFlipAt = data.nextFlipAt || null;
  state.secondsRemaining = data.secondsRemaining || 0;
  updateCooldownUI();
}

function updateCooldownUI() {
  const countdownEl = document.getElementById('coinflip-countdown');
  if (!isLoggedIn()) {
    if (countdownEl) countdownEl.hidden = true;
    return;
  }

  if (state.canFlip && !state.flipping) {
    if (countdownEl) countdownEl.hidden = true;
    return;
  }

  if (state.secondsRemaining > 0 && countdownEl) {
    countdownEl.hidden = false;
    countdownEl.textContent = `Następny rzut za: ${formatCountdown(state.secondsRemaining)}`;
  } else if (countdownEl) {
    countdownEl.hidden = true;
  }
}

function startCountdownTicker() {
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    if (state.canFlip || !state.nextFlipAt) {
      updateCooldownUI();
      updateFlipButton();
      return;
    }
    const remaining = Math.ceil((new Date(state.nextFlipAt).getTime() - Date.now()) / 1000);
    state.secondsRemaining = Math.max(0, remaining);
    if (state.secondsRemaining <= 0) {
      state.canFlip = true;
      state.nextFlipAt = null;
    }
    updateCooldownUI();
    updateFlipButton();
  }, 1000);
}

function getBalance() {
  return typeof getTokenBalance === 'function' ? getTokenBalance() : 0;
}

function getMaxBet() {
  return Math.min(MAX_BET, Math.max(MIN_BET, getBalance()));
}

function clampBet(value) {
  const max = getMaxBet();
  if (max < MIN_BET) return MIN_BET;
  return Math.min(max, Math.max(MIN_BET, Math.floor(value)));
}

function choiceLabel(choice) {
  return choice === 'heads' ? 'Orzeł' : 'Reszka';
}

function formatRelativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'przed chwilą';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min temu`;
  return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function updateBalanceUI() {
  const balanceEl = document.getElementById('coinflip-balance');
  if (balanceEl) balanceEl.textContent = getBalance().toLocaleString('pl-PL');
}

function updateStatsUI() {
  const winsEl = document.getElementById('coinflip-wins');
  const lossesEl = document.getElementById('coinflip-losses');
  if (winsEl) winsEl.textContent = String(state.wins);
  if (lossesEl) lossesEl.textContent = String(state.losses);
}

function renderHistory() {
  const list = document.getElementById('coinflip-history-list');
  const empty = document.getElementById('coinflip-history-empty');
  if (!list || !empty) return;

  if (!state.history.length) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  list.innerHTML = state.history
    .slice(0, 12)
    .map(
      (round) => `
      <li class="coinflip-history__item coinflip-history__item--${round.won ? 'win' : 'loss'}">
        <span class="coinflip-history__side">${round.won ? '✓' : '✗'} ${choiceLabel(round.outcome)}</span>
        <span class="coinflip-history__bet">${round.bet} ◆</span>
        <span class="coinflip-history__profit">${round.won ? '+' : '−'}${round.bet}</span>
        <span class="coinflip-history__time">${formatRelativeTime(round.at)}</span>
      </li>
    `
    )
    .join('');
}

function updateBetUI() {
  const betEl = document.getElementById('coinflip-bet');
  const hintEl = document.getElementById('coinflip-bet-hint');
  const slider = document.getElementById('coinflip-slider');
  const balance = getBalance();
  const max = getMaxBet();
  const insufficient = balance < MIN_BET || state.bet > balance;

  if (betEl) betEl.textContent = state.bet.toLocaleString('pl-PL');

  if (slider) {
    slider.min = String(MIN_BET);
    slider.max = String(Math.max(MIN_BET, max));
    slider.value = String(clampBet(state.bet));
    slider.disabled = balance < MIN_BET;
  }

  document.querySelectorAll('.coinflip-bet__preset').forEach((btn) => {
    const preset = Number(btn.dataset.preset);
    btn.classList.toggle('is-active', preset === state.bet);
    btn.disabled = balance < preset;
  });

  if (hintEl) {
    if (!isLoggedIn()) {
      hintEl.hidden = true;
    } else if (balance < MIN_BET) {
      hintEl.hidden = false;
      hintEl.textContent = 'Za mało żetonów — doładuj konto';
      hintEl.className = 'coinflip-bet__hint coinflip-bet__hint--warn';
    } else if (insufficient) {
      hintEl.hidden = false;
      hintEl.textContent = 'Stawka przekracza saldo';
      hintEl.className = 'coinflip-bet__hint coinflip-bet__hint--warn';
    } else {
      hintEl.hidden = false;
      hintEl.textContent = `Możliwa wygrana: ${(state.bet * 2).toLocaleString('pl-PL')} żetonów`;
      hintEl.className = 'coinflip-bet__hint';
    }
  }

  updateFlipButton();
}

function updateSideUI() {
  document.querySelectorAll('.coinflip-side').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.choice === state.choice);
    btn.disabled = state.flipping;
  });
}

function updateFlipButton() {
  const btn = document.getElementById('coinflip-flip-btn');
  const hint = document.getElementById('coinflip-flip-hint');
  const guest = document.getElementById('coinflip-guest-hint');
  const loggedIn = isLoggedIn();
  const onCooldown = loggedIn && !state.canFlip && state.secondsRemaining > 0;
  const canFlip =
    loggedIn &&
    !state.flipping &&
    state.canFlip &&
    state.choice &&
    getBalance() >= state.bet &&
    state.bet >= MIN_BET;

  if (guest) guest.hidden = loggedIn;
  if (btn) {
    btn.hidden = !loggedIn;
    btn.disabled = !canFlip;
    if (state.flipping) {
      btn.textContent = 'Rzucam…';
    } else if (onCooldown) {
      btn.textContent = 'Poczekaj na cooldown';
    } else {
      btn.textContent = 'Rzuć monetą';
    }
  }

  if (hint && loggedIn) {
    if (state.flipping) {
      hint.textContent = 'Moneta w powietrzu…';
    } else if (onCooldown) {
      hint.textContent = 'Jeden rzut na dobę — wróć po odliczeniu';
    } else if (!state.choice) {
      hint.textContent = 'Wybierz stronę monety';
    } else if (getBalance() < state.bet) {
      hint.textContent = 'Doładuj żetony, aby grać';
    } else {
      hint.textContent = `Postawiono na: ${choiceLabel(state.choice)}`;
    }
  }

  updateCooldownUI();
}

function updateGuestUI() {
  updateBalanceUI();
  updateBetUI();
  updateSideUI();
  updateFlipButton();
}

function setBet(value) {
  state.bet = clampBet(value);
  updateBetUI();
}

function setChoice(choice) {
  if (state.flipping) return;
  state.choice = choice;
  updateSideUI();
  updateFlipButton();
}

function animateCoin(outcome) {
  const coin = document.getElementById('coinflip-coin');
  if (!coin) return Promise.resolve();

  coin.classList.remove('is-heads', 'is-tails', 'is-flipping');
  void coin.offsetWidth;
  coin.classList.add('is-flipping');
  if (outcome === 'heads') coin.classList.add('is-heads');
  else coin.classList.add('is-tails');

  return new Promise((resolve) => {
    setTimeout(() => {
      coin.classList.remove('is-flipping');
      resolve();
    }, FLIP_DURATION_MS);
  });
}

async function getAuthToken() {
  if (window.DyskiAuth?.ensureAccessToken) {
    return window.DyskiAuth.ensureAccessToken();
  }
  return window.DyskiAuth?.getAccessToken?.() || null;
}

async function coinflipFetch(method, body) {
  let token = await getAuthToken();
  if (!token) throw new Error('Zaloguj się, aby grać');

  async function request(accessToken) {
    return fetch(COINFLIP_API, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    });
  }

  let res;
  try {
    res = await request(token);
    if (res.status === 401 && window.DyskiAuth?.refreshSession) {
      token = await window.DyskiAuth.refreshSession(true);
      if (token) res = await request(token);
    }
  } catch {
    throw new Error('Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.');
  }

  const contentType = res.headers.get('content-type') || '';
  let data = {};
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    throw new Error(
      res.status === 404
        ? 'Funkcja coinflip nie jest dostępna na tym serwerze.'
        : 'Nieprawidłowa odpowiedź serwera.'
    );
  }

  if (!res.ok) {
    const err = new Error(data.error || 'Błąd coinflip');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function refreshFlipStatus() {
  if (!isLoggedIn()) {
    state.canFlip = false;
    state.nextFlipAt = null;
    state.secondsRemaining = 0;
    updateCooldownUI();
    updateFlipButton();
    return;
  }

  try {
    const data = await coinflipFetch('GET');
    applyFlipStatus(data);
    updateFlipButton();
  } catch (err) {
    console.error(err);
  }
}

async function playRound() {
  if (state.flipping || !state.choice) return;
  if (!isLoggedIn()) {
    if (typeof openAuthModal === 'function') openAuthModal('login');
    return;
  }

  const bet = state.bet;
  const choice = state.choice;
  const balanceBefore = getBalance();

  if (balanceBefore < bet) {
    if (typeof showToast === 'function') showToast('Za mało żetonów — doładuj konto.');
    return;
  }

  if (!state.canFlip) {
    if (typeof showToast === 'function') {
      showToast('Możesz rzucić monetą raz na 24 godziny.');
    }
    return;
  }

  state.flipping = true;
  updateFlipButton();
  updateSideUI();
  document.querySelectorAll('.coinflip-bet__preset, .coinflip-bet__adj').forEach((el) => {
    el.disabled = true;
  });

  const resultEl = document.getElementById('coinflip-result');
  if (resultEl) resultEl.hidden = true;

  try {
    const data = await coinflipFetch('POST', { bet, choice });
    window.DyskiAuth?.applyTokensFromServer?.(data.newTokens);
    await animateCoin(data.outcome);

    applyFlipStatus({
      canFlip: false,
      nextFlipAt: data.nextFlipAt,
      secondsRemaining: data.secondsRemaining || Math.ceil(24 * 60 * 60),
    });

    if (typeof animateTokenBalance === 'function' && data.newTokens !== balanceBefore) {
      animateTokenBalance(balanceBefore, data.newTokens);
    } else if (typeof updateTokenUI === 'function') {
      updateTokenUI(data.newTokens);
    }

    if (data.won) state.wins += 1;
    else state.losses += 1;

    state.history.unshift({
      won: data.won,
      outcome: data.outcome,
      choice: data.choice,
      bet: data.bet,
      at: new Date().toISOString(),
    });

    saveStats();
    saveHistory();
    updateStatsUI();
    renderHistory();
    updateBalanceUI();
    state.bet = clampBet(state.bet);
    updateBetUI();

    if (resultEl) {
      resultEl.hidden = false;
      resultEl.className = `coinflip-result coinflip-result--${data.won ? 'win' : 'loss'}`;
      resultEl.textContent = data.won
        ? `Wygrana! ${choiceLabel(data.outcome)} — +${data.bet} żetonów`
        : `Przegrana. Wypadło: ${choiceLabel(data.outcome)} — −${data.bet} żetonów`;
    }

    if (typeof showToast === 'function') {
      showToast(
        data.won
          ? `Wygrana! +${data.bet} żetonów (stan: ${data.newTokens.toLocaleString('pl-PL')})`
          : `Przegrana. Stan: ${data.newTokens.toLocaleString('pl-PL')}`
      );
    }
  } catch (err) {
    if (err.status === 429 && err.data) {
      applyFlipStatus(err.data);
      if (typeof showToast === 'function') showToast(err.message);
    } else if (typeof showToast === 'function') {
      showToast(err.message || 'Nie udało się rozegrać rundy');
    }
    const coin = document.getElementById('coinflip-coin');
    coin?.classList.remove('is-flipping');
  } finally {
    state.flipping = false;
    document.querySelectorAll('.coinflip-bet__preset, .coinflip-bet__adj').forEach((el) => {
      el.disabled = false;
    });
    updateSideUI();
    updateFlipButton();
  }
}

function bindControls() {
  document.querySelectorAll('.coinflip-side').forEach((btn) => {
    btn.addEventListener('click', () => setChoice(btn.dataset.choice));
  });

  document.querySelectorAll('.coinflip-bet__preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (preset === 'half') setBet(getBalance() / 2);
      else if (preset === 'max') setBet(getMaxBet());
      else setBet(Number(preset));
    });
  });

  document.querySelectorAll('.coinflip-bet__adj').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = state.bet < 25 ? 5 : state.bet < 100 ? 10 : 25;
      setBet(state.bet + Number(btn.dataset.adj) * step);
    });
  });

  document.getElementById('coinflip-slider')?.addEventListener('input', (e) => {
    setBet(Number(e.target.value));
  });

  document.getElementById('coinflip-flip-btn')?.addEventListener('click', playRound);

  document.getElementById('coinflip-login-btn')?.addEventListener('click', () => {
    if (typeof openAuthModal === 'function') openAuthModal('login');
  });
}

async function initCoinflip() {
  bindControls();
  loadPersistedData();
  updateStatsUI();
  renderHistory();

  if (window.DyskiAuth?.initAuth) {
    await window.DyskiAuth.initAuth();
    if (isLoggedIn()) {
      if (window.DyskiAuth.ensureAccessToken) await window.DyskiAuth.ensureAccessToken();
      if (window.DyskiAuth.loadProfile) await window.DyskiAuth.loadProfile();
    }
  }

  if (typeof syncTokenDisplay === 'function') syncTokenDisplay();
  loadPersistedData();
  updateGuestUI();

  await refreshFlipStatus();
  startCountdownTicker();

  window.addEventListener('dyskihub-auth', () => {
    loadPersistedData();
    updateStatsUI();
    renderHistory();
    if (typeof syncTokenDisplay === 'function') syncTokenDisplay();
    updateGuestUI();
    refreshFlipStatus();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.classList.contains('page-coinflip')) {
    initCoinflip();
  }
});
