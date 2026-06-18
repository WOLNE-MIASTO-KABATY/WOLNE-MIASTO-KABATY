/**
 * DyskiHub.pl — Daily Spin (Koło fortuny)
 */

const SPIN_API = '/.netlify/functions/daily-spin';
const SEGMENT_COUNT = 5;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;
const SPIN_DURATION_MS = 4500;

/** Kolejność segmentów — musi być identyczna jak PRIZE_SEGMENTS w daily-spin.js */
const WHEEL_SEGMENTS = [
  { label: 'Nic', colors: ['#1e293b', '#334155'], text: '#e2e8f0' },
  { label: '5 żetonów', colors: ['#a16207', '#facc15'], text: '#1c1917' },
  { label: '35 żetonów', colors: ['#6b21a8', '#c084fc'], text: '#fff' },
  { label: '100 żetonów', colors: ['#c2410c', '#fb923c'], text: '#fff' },
  { label: '200 żetonów', colors: ['#15803d', '#4ade80'], text: '#052e16' },
];

const WHEEL_LABELS = WHEEL_SEGMENTS.map((s) => s.label);

let spinState = {
  canSpin: false,
  nextSpinAt: null,
  secondsRemaining: 0,
  spinning: false,
  currentRotation: 0,
  statusLoaded: false,
  statusError: null,
};

let countdownTimer = null;

function isLoggedIn() {
  return Boolean(window.DyskiAuth?.getAccessToken?.());
}

async function getAuthToken() {
  if (window.DyskiAuth?.ensureAccessToken) {
    return window.DyskiAuth.ensureAccessToken();
  }
  return window.DyskiAuth?.getAccessToken?.() || null;
}

async function spinFetch(method) {
  let token = await getAuthToken();
  if (!token) throw new Error('Zaloguj się, aby kręcić kołem');

  async function request(accessToken) {
    return fetch(SPIN_API, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: method === 'POST' ? '{}' : undefined,
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
    throw new Error('Brak połączenia z serwerem spinu. Sprawdź internet i spróbuj ponownie.');
  }

  const contentType = res.headers.get('content-type') || '';
  let data = {};
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    throw new Error(
      res.status === 404
        ? 'Funkcja koła fortuny nie jest dostępna na tym serwerze.'
        : 'Nieprawidłowa odpowiedź serwera spinu.'
    );
  }

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
  if (btn) btn.hidden = !loggedIn;

  if (!loggedIn) {
    if (el) el.textContent = 'Zaloguj się, aby zakręcić kołem fortuny';
    return;
  }

  if (spinState.statusError && !spinState.spinning) {
    if (el) el.textContent = spinState.statusError;
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Spróbuj ponownie';
    }
    return;
  }

  if (!spinState.statusLoaded && !spinState.spinning) {
    if (el) el.textContent = 'Sprawdzanie dostępności spinu…';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Zakręć kołem';
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

  if (el) el.textContent = 'Nie udało się ustalić dostępności spinu.';
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Spróbuj ponownie';
  }
}

function startCountdownTicker() {
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    if (!spinState.nextSpinAt) return;

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
  spinState.statusLoaded = true;
  spinState.statusError = null;
  updateCountdownUI();
}

async function refreshSpinStatus() {
  if (!isLoggedIn()) {
    spinState.canSpin = false;
    spinState.statusLoaded = false;
    spinState.statusError = null;
    updateCountdownUI();
    return;
  }

  spinState.statusLoaded = false;
  spinState.statusError = null;
  updateCountdownUI();

  try {
    const data = await spinFetch('GET');
    applyStatus(data);
  } catch (err) {
    console.error(err);
    spinState.statusLoaded = true;
    spinState.statusError = err.message || 'Nie udało się sprawdzić statusu spinu';
    spinState.canSpin = false;
    updateCountdownUI();
  }
}

function angleForSegment(segmentIndex) {
  const fullSpins = 6;
  return fullSpins * 360 + (360 - segmentIndex * SEGMENT_ANGLE - SEGMENT_ANGLE / 2);
}

function animateWheelToSegment(segmentIndex) {
  const wheel = document.getElementById('spin-wheel');
  const frame = document.querySelector('.spin-wheel-frame');
  if (!wheel) return Promise.resolve();

  const target = angleForSegment(segmentIndex);
  spinState.currentRotation = target;
  frame?.classList.add('is-spinning');
  wheel.style.transition = `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.15, 0.85, 0.2, 1)`;
  wheel.style.transform = `rotate(${target}deg)`;

  return new Promise((resolve) => {
    setTimeout(() => {
      frame?.classList.remove('is-spinning');
      resolve();
    }, SPIN_DURATION_MS + 100);
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

function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeSlice(cx, cy, r, startDeg, endDeg) {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

function buildWheelSvg() {
  const wheel = document.getElementById('spin-wheel');
  if (!wheel) return;

  const cx = 200;
  const cy = 200;
  const r = 188;
  const textR = 122;

  const gradients = WHEEL_SEGMENTS.map((seg, i) => {
    const [c0, c1] = seg.colors;
    return `
      <linearGradient id="grad-${i}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c0}"/>
        <stop offset="100%" stop-color="${c1}"/>
      </linearGradient>
    `;
  }).join('');

  const slices = WHEEL_SEGMENTS.map((seg, i) => {
    const start = i * SEGMENT_ANGLE - SEGMENT_ANGLE / 2;
    const end = start + SEGMENT_ANGLE;
    const mid = start + SEGMENT_ANGLE / 2;
    const path = describeSlice(cx, cy, r, start, end);
    const tp = polar(cx, cy, textR, mid);
    const flip = mid > 90 && mid < 270;
    const textRot = flip ? mid + 180 : mid;
    const fontSize = seg.label.length > 9 ? 17 : seg.label.length > 6 ? 19 : 22;

    return `
      <g class="spin-wheel__slice">
        <path d="${path}" fill="url(#grad-${i})" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"/>
        <text
          x="${tp.x}"
          y="${tp.y}"
          fill="${seg.text}"
          font-size="${fontSize}"
          font-weight="700"
          font-family="Outfit, system-ui, sans-serif"
          stroke="rgba(0,0,0,0.25)"
          stroke-width="0.8"
          paint-order="stroke fill"
          text-anchor="middle"
          dominant-baseline="middle"
          transform="rotate(${textRot}, ${tp.x}, ${tp.y})"
        >${seg.label}</text>
      </g>
    `;
  }).join('');

  wheel.innerHTML = `
    <svg class="spin-wheel__svg" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="wheel-inner-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.45"/>
        </filter>
        ${gradients}
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#0f172a" filter="url(#wheel-inner-shadow)"/>
      ${slices}
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
    </svg>
  `;
}

function buildWheelLeds() {
  const ring = document.getElementById('spin-wheel-leds');
  if (!ring) return;
  const count = 32;
  ring.innerHTML = Array.from({ length: count }, (_, i) => {
    const rot = (360 / count) * i;
    return `<span class="spin-wheel-led" style="--led-rot:${rot}deg;--led-delay:${(i % 4) * 0.15}s"></span>`;
  }).join('');
}

function bindSpinUI() {
  document.getElementById('spin-button')?.addEventListener('click', () => {
    if (!isLoggedIn()) {
      if (typeof openAuthModal === 'function') openAuthModal('login');
      return;
    }
    if (spinState.statusError) {
      refreshSpinStatus();
      return;
    }
    performSpin();
  });

  document.getElementById('spin-login-btn')?.addEventListener('click', () => {
    if (typeof openAuthModal === 'function') openAuthModal('login');
  });
}

async function initDailySpin() {
  buildWheelSvg();
  buildWheelLeds();
  bindSpinUI();
  updateCountdownUI();

  if (window.DyskiAuth) {
    try {
      await window.DyskiAuth.initAuth();
      if (isLoggedIn()) {
        await window.DyskiAuth.loadProfile();
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (typeof syncTokenDisplay === 'function') syncTokenDisplay();
  if (typeof updateRegisterUI === 'function') updateRegisterUI();

  if (isLoggedIn() && window.DyskiAuth?.ensureAccessToken) {
    await window.DyskiAuth.ensureAccessToken();
  }

  await refreshSpinStatus();
  startCountdownTicker();

  window.addEventListener('dyskihub-auth', async () => {
    if (typeof syncTokenDisplay === 'function') syncTokenDisplay();
    if (typeof updateRegisterUI === 'function') updateRegisterUI();
    if (window.DyskiAuth) {
      try {
        await window.DyskiAuth.loadProfile();
      } catch (err) {
        console.error(err);
      }
    }
    refreshSpinStatus();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.classList.contains('page-casino')) {
    initDailySpin();
  }
});
