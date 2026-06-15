/**
 * DyskiHub.pl — Daily Spin (Koło fortuny)
 */

const SPIN_API = '/.netlify/functions/daily-spin';
const SEGMENT_COUNT = 5;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;
const SPIN_DURATION_MS = 4500;

/** Kolejność segmentów — musi być identyczna jak PRIZE_SEGMENTS w daily-spin.js */
const WHEEL_LABELS = ['Nic', '5 żetonów', '35 żetonów', '100 żetonów', '200 żetonów'];

let spinState = {
  canSpin: false,
  nextSpinAt: null,
  secondsRemaining: 0,
  spinning: false,
  currentRotation: 0,
};

let countdownTimer = null;

function isLoggedIn() {
  return Boolean(window.DyskiAuth?.getAccessToken?.());
}

async function spinFetch(method) {
  const token = window.DyskiAuth?.getAccessToken?.();
  if (!token) throw new Error('Zaloguj się, aby kręcić kołem');

  const res = await fetch(SPIN_API, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method === 'POST' ? '{}' : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Błąd koła fortuny');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function updateCountdownUI() {
  const el = document.getElementById('spin-countdown');
  const btn = document.getElementById('spin-button');
  const guest = document.getElementById('spin-guest-hint');
  const loggedIn = isLoggedIn();

  if (guest) guest.hidden = loggedIn;

  if (!loggedIn) {
    if (el) el.textContent = 'Zaloguj się, aby zakręcić kołem fortuny';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Zaloguj się';
    }
    return;
  }

  if (spinState.canSpin && !spinState.spinning) {
    if (el) el.textContent = 'Masz dostępny dzisiejszy spin!';
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Zakręć kołem';
    }
    return;
  }

  if (spinState.secondsRemaining > 0) {
    if (el) {
      el.textContent = `Następny spin za: ${formatCountdown(spinState.secondsRemaining)}`;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Poczekaj na cooldown';
    }
    return;
  }

  if (el) el.textContent = 'Sprawdzanie dostępności spinu…';
  if (btn) btn.disabled = true;
}

function startCountdownTicker() {
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    if (spinState.canSpin || !spinState.nextSpinAt) {
      updateCountdownUI();
      return;
    }
    const remaining = Math.ceil((new Date(spinState.nextSpinAt).getTime() - Date.now()) / 1000);
    spinState.secondsRemaining = Math.max(0, remaining);
    if (spinState.secondsRemaining <= 0) {
      spinState.canSpin = true;
      spinState.nextSpinAt = null;
    }
    updateCountdownUI();
  }, 1000);
}

function applyStatus(data) {
  spinState.canSpin = Boolean(data.canSpin);
  spinState.nextSpinAt = data.nextSpinAt || null;
  spinState.secondsRemaining = data.secondsRemaining || 0;
  updateCountdownUI();
}

async function refreshSpinStatus() {
  if (!isLoggedIn()) {
    spinState.canSpin = false;
    updateCountdownUI();
    return;
  }

  try {
    const data = await spinFetch('GET');
    applyStatus(data);
  } catch (err) {
    console.error(err);
    const el = document.getElementById('spin-countdown');
    if (el) el.textContent = err.message || 'Nie udało się sprawdzić statusu spinu';
  }
}

function angleForSegment(segmentIndex) {
  const fullSpins = 6;
  return fullSpins * 360 + (360 - segmentIndex * SEGMENT_ANGLE - SEGMENT_ANGLE / 2);
}

function animateWheelToSegment(segmentIndex) {
  const wheel = document.getElementById('spin-wheel');
  if (!wheel) return Promise.resolve();

  const target = angleForSegment(segmentIndex);
  spinState.currentRotation = target;
  wheel.style.transition = `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
  wheel.style.transform = `rotate(${target}deg)`;

  return new Promise((resolve) => {
    setTimeout(resolve, SPIN_DURATION_MS + 100);
  });
}

function showSpinResult(prizeTokens, label) {
  const result = document.getElementById('spin-result');
  if (!result) return;

  if (prizeTokens > 0) {
    result.textContent = `Wygrałeś ${prizeTokens} żetonów! (${label})`;
    result.className = 'spin-result spin-result--win';
  } else {
    result.textContent = 'Tym razem nic — spróbuj jutro!';
    result.className = 'spin-result spin-result--lose';
  }
  result.hidden = false;
}

async function performSpin() {
  if (spinState.spinning) return;

  if (!isLoggedIn()) {
    if (typeof openAuthModal === 'function') openAuthModal('login');
    return;
  }

  spinState.spinning = true;
  updateCountdownUI();

  const resultEl = document.getElementById('spin-result');
  if (resultEl) resultEl.hidden = true;

  try {
    const data = await spinFetch('POST');

    await animateWheelToSegment(data.segmentIndex);

    showSpinResult(data.prizeTokens, data.label || WHEEL_LABELS[data.segmentIndex]);

    if (typeof data.newTokens === 'number' && window.DyskiAuth?.loadProfile) {
      await window.DyskiAuth.loadProfile();
    } else if (typeof data.newTokens === 'number' && typeof updateTokenUI === 'function') {
      updateTokenUI(data.newTokens);
    }

    if (typeof showToast === 'function') {
      showToast(
        data.prizeTokens > 0
          ? `Gratulacje! +${data.prizeTokens} żetonów`
          : 'Tym razem bez wygranej — wróć jutro!'
      );
    }

    applyStatus({
      canSpin: false,
      nextSpinAt: data.nextSpinAt,
      secondsRemaining: data.secondsRemaining || Math.ceil(24 * 60 * 60),
    });
  } catch (err) {
    if (err.status === 429 && err.data) {
      applyStatus(err.data);
      if (typeof showToast === 'function') showToast(err.message);
    } else {
      if (typeof showToast === 'function') showToast(err.message || 'Spin nie powiódł się');
    }
  } finally {
    spinState.spinning = false;
    updateCountdownUI();
  }
}

function buildWheelLabels() {
  const container = document.getElementById('spin-wheel-labels');
  if (!container) return;

  container.innerHTML = WHEEL_LABELS.map((label, i) => {
    const rot = i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    return `<span class="spin-wheel__label" style="--label-rot:${rot}deg">${label}</span>`;
  }).join('');
}

function bindSpinUI() {
  document.getElementById('spin-button')?.addEventListener('click', () => {
    if (!isLoggedIn()) {
      if (typeof openAuthModal === 'function') openAuthModal('login');
      return;
    }
    performSpin();
  });

  document.getElementById('spin-login-btn')?.addEventListener('click', () => {
    if (typeof openAuthModal === 'function') openAuthModal('login');
  });
}

async function initDailySpin() {
  buildWheelLabels();
  bindSpinUI();
  updateCountdownUI();

  if (window.DyskiAuth) {
    try {
      await window.DyskiAuth.initAuth();
    } catch (err) {
      console.error(err);
    }
  }

  if (typeof syncTokenDisplay === 'function') syncTokenDisplay();
  if (typeof updateRegisterUI === 'function') updateRegisterUI();

  await refreshSpinStatus();
  startCountdownTicker();

  window.addEventListener('dyskihub-auth', () => {
    if (typeof syncTokenDisplay === 'function') syncTokenDisplay();
    if (typeof updateRegisterUI === 'function') updateRegisterUI();
    refreshSpinStatus();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.classList.contains('page-casino')) {
    initDailySpin();
  }
});
