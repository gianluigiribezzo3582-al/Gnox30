/* ══════════════════════════════════════════════════════════════
   GNOX // OPERAZIONE 30  —  script.js
   Caccia al tesoro digitale per il 30° compleanno di Gnox

   ▸ Modifica CODICE_FINALE qui sotto per cambiare il codice del livello 8
   ▸ Tutti i testi modificabili sono segnati con // ✏️
══════════════════════════════════════════════════════════════ */

// ╔═══════════════════════════════════════════════════╗
// ║   CONFIGURAZIONE — modifica facilmente qui        ║
// ╚═══════════════════════════════════════════════════╝

const CODICE_FINALE = "160596"; // ✏️ Cambia il codice del livello 8 (data giorno+mese+anno)

// Testo intro terminale (Livello 1) — ✏️ modificabile
const TERMINAL_TEXT = [
  "Benvenuto, Gnox.",
  "",
  "Questa non è una semplice caccia al tesoro.",
  "È un viaggio attraverso i mondi che conosci a memoria.",
  "Alla fine, capirai cosa ti aspetta.",
  "",
  "Sei pronto?",
  "Il tuo destino è già scritto nel codice.",
  "Scritto e diretto da Gibz con la collaborazione de \"Gli amici di Tutti\""
].join("\n");

// Sequenza Simon Says (Livello 6) — ✏️ modificabile (valori: 'green','blue','red','yellow')
const SIMON_SEQUENCE = ['green', 'blue', 'red', 'yellow'];

// ════════════════════════════════════════════════════
// STATO DEL GIOCO
// ════════════════════════════════════════════════════

let currentLevel  = 0;    // 0=intro, 1-8=livelli, 9=finale
let wrongAttempts = {};   // { levelNum: count }

// Audio
let audioCtx    = null;

// Livello 6 — Simon Says
let simonInput  = [];
let simonLocked = true;   // true = non accetta input utente

// Livello 7 — Blur reveal
let blurStep  = 0;
let blurTimer = null;
const BLUR_STEPS   = [20, 15, 10, 5, 0]; // px
const BLUR_DELAY   = 3000; // ms tra uno step e l'altro

// Livello 8 — Keypad
let keypadVal      = '';
let keypadAttempts = 0;

// Confetti
let confettiParticles = [];
let confettiRAF       = null;

// ════════════════════════════════════════════════════
// AUDIO — Web Audio API
// ════════════════════════════════════════════════════

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resumo il contesto se era sospeso (policy autoplay)
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

/**
 * Suona una singola nota via Web Audio API.
 * @param {number} freq        - Frequenza Hz
 * @param {string} [type]      - 'square' | 'sawtooth' | 'triangle' | 'sine'
 * @param {number} [dur]       - Durata secondi
 * @param {number} [vol]       - Volume 0..1
 * @param {number} [delayS]    - Ritardo in secondi dall'ora corrente
 */
function playNote(freq, type = 'square', dur = 0.1, vol = 0.07, delayS = 0) {
  if (!audioCtx) return;
  try {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    const t = audioCtx.currentTime + delayS;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  } catch (_) {}
}

/** Effetti sonori tematici */
function playSFX(type) {
  if (!audioCtx) return;
  switch (type) {
    case 'correct': // jingle positivo ascendente
      playNote(523.25, 'square', 0.10, 0.08, 0.00);
      playNote(659.25, 'square', 0.10, 0.08, 0.10);
      playNote(783.99, 'square', 0.20, 0.09, 0.20);
      break;
    case 'wrong': // buzz discendente
      playNote(250, 'sawtooth', 0.18, 0.08, 0.00);
      playNote(180, 'sawtooth', 0.25, 0.07, 0.18);
      break;
    case 'levelup': // fanfara 4 note
      [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
        playNote(f, 'square', 0.14, 0.10, i * 0.13);
      });
      break;
    case 'click': // tick breve
      playNote(440, 'square', 0.04, 0.04, 0);
      break;
    case 'type': // tasto terminale
      playNote(440 + Math.random() * 120, 'square', 0.025, 0.025, 0);
      break;
    case 'simon-green':  playNote(392.00, 'square', 0.30, 0.10); break;
    case 'simon-red':    playNote(261.63, 'square', 0.30, 0.10); break;
    case 'simon-blue':   playNote(329.63, 'square', 0.30, 0.10); break;
    case 'simon-yellow': playNote(440.00, 'square', 0.30, 0.10); break;
  }
}

// ════════════════════════════════════════════════════
// PERSISTENZA — localStorage
// ════════════════════════════════════════════════════

const LS_KEY = 'gnox30_progress';

function saveProgress() {
  try { localStorage.setItem(LS_KEY, String(currentLevel)); } catch (_) {}
}

function loadProgress() {
  try {
    const v = parseInt(localStorage.getItem(LS_KEY) || '0', 10);
    return isNaN(v) ? 0 : v;
  } catch (_) { return 0; }
}

function resetProgress() {
  try { localStorage.removeItem(LS_KEY); } catch (_) {}
}

// ════════════════════════════════════════════════════
// GESTIONE SCHERMATE
// ════════════════════════════════════════════════════

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const el = document.getElementById(id);
  el.style.display = 'flex';
  // Forza reflow per far partire la transizione opacity
  void el.offsetHeight;
  el.classList.add('active');
}

function showLevelScreen(n) {
  // Aggiorna HUD
  document.getElementById('level-label').textContent = `LIVELLO ${n} / 8`;
  document.getElementById('progress-bar').style.width  = `${((n - 1) / 8) * 100}%`;

  const screenEl = document.getElementById('screen-level');
  screenEl.classList.add('glitch-transition');
  setTimeout(() => screenEl.classList.remove('glitch-transition'), 500);

  showScreen('screen-level');

  // Reset stato per-livello
  simonInput  = [];
  simonLocked = true;
  if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
  blurStep       = 0;
  keypadVal      = '';
  keypadAttempts = 0;

  // Render del livello corretto
  const renderers = [null, renderL1, renderL2, renderL3, renderL4,
                           renderL5, renderL6, renderL7, renderL8];
  if (renderers[n]) renderers[n]();
}

/** Avanza al prossimo livello con transizione */
function nextLevel() {
  // Feedback audio/visual
  playSFX('levelup');

  const screenEl = document.getElementById('screen-level');
  screenEl.classList.add('glitch-transition');

  currentLevel++;
  saveProgress();

  setTimeout(() => {
    screenEl.classList.remove('glitch-transition');
    if (currentLevel > 8) {
      showFinale();
    } else {
      showLevelScreen(currentLevel);
    }
  }, 550);
}

// ════════════════════════════════════════════════════
// ██ LIVELLO 1 — BOOT SEQUENCE ██
// ════════════════════════════════════════════════════

function renderL1() {
  const box = document.getElementById('level-content');
  box.innerHTML = `
    <div class="level-title">LIVELLO 1 — BOOT SEQUENCE</div>
    <div class="terminal-box">
      <span class="neon-text-green" style="font-size:0.42rem;">GNOX_OS v3.0 &gt; BOOT</span><br><br>
      <div id="term-out" class="terminal-prompt"></div>
      <span id="term-cursor" class="terminal-cursor"></span>
    </div>
    <button id="btn-l1-continue" class="btn btn-primary" style="display:none">
      CONTINUA &nbsp;▶
    </button>
  `;

  const out    = document.getElementById('term-out');
  const cursor = document.getElementById('term-cursor');
  const chars  = TERMINAL_TEXT.split('');
  let idx      = 0;

  function typeChar() {
    if (idx >= chars.length) {
      cursor.style.display = 'none';
      document.getElementById('btn-l1-continue').style.display = 'block';
      return;
    }
    const ch = chars[idx++];
    if (ch === '\n') {
      out.appendChild(document.createElement('br'));
      playSFX('type');
      setTimeout(typeChar, 180);
    } else {
      out.insertAdjacentText('beforeend', ch);
      playSFX('type');
      setTimeout(typeChar, 38 + Math.random() * 28);
    }
  }

  setTimeout(typeChar, 700);

  document.getElementById('btn-l1-continue').addEventListener('click', () => {
    playSFX('click');
    nextLevel();
  });
}

// ════════════════════════════════════════════════════
// ██ LIVELLO 2 — IL CAVALIERE SENZA NOME ██
// ════════════════════════════════════════════════════

function renderL2() {
  const box = document.getElementById('level-content');
  // ✏️ Indizio e opzioni modificabili qui
  const question = `In Hollow Knight, come si chiama il boss finale del Pantheon of Hallownest nella sua forma più difficile?`;
  const options = [
    { id: 'A', label: 'The Radiance',     correct: false },
    { id: 'B', label: 'Absolute Radiance', correct: true  },
    { id: 'C', label: 'The Hollow Knight', correct: false },
    { id: 'D', label: 'Pure Vessel',       correct: false },
  ];

  box.innerHTML = `
    <div class="level-title">LIVELLO 2 — IL CAVALIERE SENZA NOME</div>
    <div class="level-clue">${question}</div>
    <div class="quiz-options" id="quiz-opts">
      ${options.map(o => `
        <button class="quiz-btn" data-correct="${o.correct}" data-id="${o.id}">
          <strong>${o.id})</strong>&nbsp; ${o.label}
        </button>
      `).join('')}
    </div>
    <div class="feedback" id="quiz-feedback"></div>
  `;

  document.querySelectorAll('.quiz-btn').forEach(btn => {
    btn.addEventListener('click', () => handleL2(btn));
  });
}

function handleL2(btn) {
  const allBtns = document.querySelectorAll('.quiz-btn');
  allBtns.forEach(b => b.disabled = true);

  const isCorrect = btn.dataset.correct === 'true';
  const fb = document.getElementById('quiz-feedback');

  if (isCorrect) {
    btn.classList.add('correct-ans');
    playSFX('correct');
    fb.textContent   = '✅ Esatto! Absolute Radiance — la forma definitiva.';
    fb.className     = 'feedback correct';
    setTimeout(() => nextLevel(), 1400);
  } else {
    btn.classList.add('wrong-ans');
    // Mostra la risposta corretta
    allBtns.forEach(b => { if (b.dataset.correct === 'true') b.classList.add('correct-ans'); });
    playSFX('wrong');
    fb.textContent = '❌ Sbagliato. Mi meraviglio di te. Riprova!';
    fb.className   = 'feedback wrong';
    setTimeout(() => {
      allBtns.forEach(b => {
        b.classList.remove('correct-ans', 'wrong-ans');
        b.disabled = false;
      });
      fb.textContent = '';
      fb.className   = 'feedback';
    }, 2000);
  }
}

// ════════════════════════════════════════════════════
// ██ LIVELLO 3 — IL PIANO DI ISAAC (ROT13) ██
// ════════════════════════════════════════════════════

function renderL3() {
  const box = document.getElementById('level-content');
  // ✏️ Stringa codificata e risposta
  const encoded = 'QRNQ PNG';   // ROT13 di "DEAD CAT"
  const answer  = 'DEAD CAT';  // case-insensitive

  box.innerHTML = `
    <div class="level-title">LIVELLO 3 — IL PIANO DI ISAAC</div>
    <div class="level-clue">
      In The Binding of Isaac, questo oggetto è uno dei più iconici e... indulgenti.<br>
      Decifra il suo nome in codice:<br>
      <em style="font-size:0.5rem;color:var(--text-dim)">(Suggerimento: 9 vite...)</em>
    </div>
    <div class="cipher-encoded" id="l3-encoded">${encoded}</div>
    <input
      type="text"
      class="text-input"
      id="l3-input"
      placeholder="scrivi la risposta..."
      autocomplete="off"
      spellcheck="false"
      maxlength="20"
    />
    <button class="btn btn-check" id="btn-l3-check">VERIFICA</button>
    <div class="feedback" id="l3-feedback"></div>
  `;

  // Salviamo la risposta come attributo data (non è sicurezza critica, è un gioco locale)
  document.getElementById('btn-l3-check').dataset.answer = answer;

  const check = () => {
    const input = document.getElementById('l3-input').value.trim().toUpperCase();
    const ans   = answer.toUpperCase();
    const fb    = document.getElementById('l3-feedback');

    if (input === ans) {
      playSFX('correct');
      fb.textContent = '✅ DEAD CAT! Sei un boss.';
      fb.className   = 'feedback correct';
      setTimeout(() => nextLevel(), 1300);
    } else {
      playSFX('wrong');
      fb.textContent = '❌ Non è quello. Fai come Tainted  Cain e creati la risposte.';
      fb.className   = 'feedback wrong';
    }
  };

  document.getElementById('btn-l3-check').addEventListener('click', check);
  document.getElementById('l3-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') check();
  });
}

// ════════════════════════════════════════════════════
// ██ LIVELLO 4 — INTRECCIA I CUORI (Kingdom Hearts) ██
// ════════════════════════════════════════════════════

function renderL4() {
  const box = document.getElementById('level-content');
  // ✏️ Risposta corretta
  const correctAnswer = 13;
  wrongAttempts[4]    = wrongAttempts[4] || 0;

  box.innerHTML = `
    <div class="level-title">LIVELLO 4 — INTRECCIA I CUORI</div>
    <div class="level-clue">
      La saga di Kingdom Hearts è famosa per i suoi titoli numerati in modo creativo.<br>
      Quanti giochi canonici compongono la saga completa? (Si, inclusi i gatcha ma non i porting/remake)
    </div>
    <input
      type="number"
      class="num-input"
      id="l4-input"
      min="1" max="30"
      placeholder="?"
    />
    <button class="btn btn-check" id="btn-l4-check">VERIFICA</button>
    <div class="hint-text" id="l4-hint">
      💡 Pensa al numero di Xehanort...
    </div>
    <div class="feedback" id="l4-feedback"></div>
  `;

  const check = () => {
    const val = parseInt(document.getElementById('l4-input').value, 10);
    const fb  = document.getElementById('l4-feedback');

    if (val === correctAnswer) {
      playSFX('correct');
      fb.textContent = `✅ Esatto! ${correctAnswer} giochi canonici nella saga.`;
      fb.className   = 'feedback correct';
      setTimeout(() => nextLevel(), 1300);
    } else {
      playSFX('wrong');
      wrongAttempts[4]++;
      fb.textContent = `❌ Te ne manca sicuro qualcuno secondario. Riprova.`;
      fb.className   = 'feedback wrong';
      if (wrongAttempts[4] >= 2) {
        document.getElementById('l4-hint').classList.add('visible');
      }
    }
  };

  document.getElementById('btn-l4-check').addEventListener('click', check);
  document.getElementById('l4-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') check();
  });
}

// ════════════════════════════════════════════════════
// ██ LIVELLO 5 — ABBANDONA OGNI SPERANZA (Slider) ██
// ════════════════════════════════════════════════════

function renderL5() {
  const box = document.getElementById('level-content');
  // ✏️ Risposta corretta
  const correctAnswer = 1;
  wrongAttempts[5] = wrongAttempts[5] || 0;

  box.innerHTML = `
    <div class="level-title">LIVELLO 5 — ABBANDONA OGNI SPERANZA</div>
    <div class="level-clue">
      Nei giochi Souls, morire fa parte del gioco.<br>
      Quante volte puoi morire consecutivamente prima di perdere
      le tue anime per sempre in Dark Souls?
    </div>
    <div class="slider-wrap">
      <div class="slider-display" id="l5-display">0</div>
      <input
        type="range"
        id="l5-slider"
        min="0" max="5" value="0" step="1"
        aria-label="numero di morti consecutive"
      />
      <div class="slider-label">morti consecutive senza recupero</div>
    </div>
    <button class="btn btn-check" id="btn-l5-check">VERIFICA</button>
    <div class="feedback" id="l5-feedback"></div>
  `;

  const slider  = document.getElementById('l5-slider');
  const display = document.getElementById('l5-display');

  slider.addEventListener('input', () => {
    display.textContent = slider.value;
    playSFX('click');
  });

  document.getElementById('btn-l5-check').addEventListener('click', () => {
    const val = parseInt(slider.value, 10);
    const fb  = document.getElementById('l5-feedback');

    if (val === correctAnswer) {
      playSFX('correct');
      fb.textContent = `✅ Esatto! 1 morte — poi perdi tutto se non recuperi.`;
      fb.className   = 'feedback correct';
      setTimeout(() => nextLevel(), 1400);
    } else {
      playSFX('wrong');
      wrongAttempts[5]++;
      fb.textContent = `❌ Non è ${val}. Pensa a quante "vite" hanno le tue anime.`;
      fb.className   = 'feedback wrong';
    }
  });
}

// ════════════════════════════════════════════════════
// ██ LIVELLO 6 — SEQUENZA SEGRETA (Simon Says) ██
// ════════════════════════════════════════════════════

function renderL6() {
  const box = document.getElementById('level-content');

  box.innerHTML = `
    <div class="level-title">LIVELLO 6 — SEQUENZA SEGRETA</div>
    <div class="level-clue">
      In Balatro, la fortuna non esiste: esiste la memoria e il pattern.<br>
      Ripeti la sequenza — proprio come impari i pattern dei boss nei Souls.
    </div>
    <div class="simon-status" id="simon-status">Osserva la sequenza…</div>
    <div class="simon-board">
      <button class="simon-btn" id="simon-green"  data-color="green"  aria-label="verde"  disabled></button>
      <button class="simon-btn" id="simon-red"    data-color="red"    aria-label="rosso"  disabled></button>
      <button class="simon-btn" id="simon-blue"   data-color="blue"   aria-label="blu"    disabled></button>
      <button class="simon-btn" id="simon-yellow" data-color="yellow" aria-label="giallo" disabled></button>
    </div>
    <div class="feedback" id="simon-feedback"></div>
  `;

  // Aggiungi listener
  document.querySelectorAll('.simon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!simonLocked) handleSimonInput(btn.dataset.color);
    });
  });

  // Avvia sequenza dopo breve pausa
  setTimeout(() => playSimonSequence(), 1000);
}

/** Riproduce la sequenza Simon Says con flash + suono */
function playSimonSequence() {
  simonLocked = true;
  simonInput  = [];
  const statusEl = document.getElementById('simon-status');
  if (statusEl) statusEl.textContent = 'Osserva la sequenza…';

  document.querySelectorAll('.simon-btn').forEach(b => b.disabled = true);

  let i = 0;
  function flashNext() {
    if (i >= SIMON_SEQUENCE.length) {
      // Finita la sequenza — abilita input utente
      setTimeout(() => {
        simonLocked = false;
        document.querySelectorAll('.simon-btn').forEach(b => b.disabled = false);
        const st = document.getElementById('simon-status');
        if (st) { st.textContent = 'Ora tocca a te!'; st.className = 'simon-status active'; }
      }, 400);
      return;
    }
    const color = SIMON_SEQUENCE[i];
    flashSimonBtn(color);
    i++;
    setTimeout(flashNext, 700);
  }
  setTimeout(flashNext, 400);
}

function flashSimonBtn(color) {
  const btn = document.getElementById(`simon-${color}`);
  if (!btn) return;
  btn.classList.add('lit');
  playSFX(`simon-${color}`);
  setTimeout(() => btn.classList.remove('lit'), 400);
}

function handleSimonInput(color) {
  if (simonLocked) return;

  simonInput.push(color);
  flashSimonBtn(color);

  const idx = simonInput.length - 1;
  const fb  = document.getElementById('simon-feedback');

  if (simonInput[idx] !== SIMON_SEQUENCE[idx]) {
    // Sbagliato — azzera e ripeti
    simonLocked = true;
    playSFX('wrong');
    if (fb) { fb.textContent = '❌ Sequenza sbagliata! Guarda di nuovo. (E daje che è facile)'; fb.className = 'feedback wrong'; }
    document.querySelectorAll('.simon-btn').forEach(b => b.disabled = true);
    simonInput = [];
    setTimeout(() => {
      if (fb) { fb.textContent = ''; fb.className = 'feedback'; }
      const st = document.getElementById('simon-status');
      if (st) { st.textContent = 'Osserva la sequenza…'; st.className = 'simon-status'; }
      playSimonSequence();
    }, 1600);
    return;
  }

  if (simonInput.length === SIMON_SEQUENCE.length) {
    // Sequenza completata!
    simonLocked = true;
    playSFX('correct');
    if (fb) { fb.textContent = '✅ Sequenza perfetta! (Difficile sbagliarla, era più per flavour questo livello)'; fb.className = 'feedback correct'; }
    setTimeout(() => nextLevel(), 1200);
  }
}

// ════════════════════════════════════════════════════
// ██ LIVELLO 7 — SILHOUETTE (Blur reveal) ██
// ════════════════════════════════════════════════════

function renderL7() {
  const box = document.getElementById('level-content');

  box.innerHTML = `
    <div class="level-title">LIVELLO 7 — SILHOUETTE</div>
    <div class="level-clue">
      Questa sagoma ti è familiare.<br>
      È l'oggetto che da oggi cambierà il tuo modo di giocare a tutti questi mondi.
    </div>
    <div class="blur-container">
      <div class="blur-step-indicator" id="blur-indicator">
        Risoluzione: ▓░░░░
      </div>
      ${getSteamDeckSVG()}
    </div>
    <button id="btn-l7-ok" class="btn btn-primary" style="display:none">
      HO CAPITO COSA STA PER SUCCEDERE &nbsp;▶
    </button>
    <div class="feedback" id="l7-feedback"></div>
  `;

  blurStep = 0;
  applyBlurStep();
  scheduleNextBlur();

  document.getElementById('btn-l7-ok').addEventListener('click', () => {
    playSFX('click');
    nextLevel();
  });
}

function applyBlurStep() {
  const svg       = document.getElementById('console-svg');
  const indicator = document.getElementById('blur-indicator');
  if (!svg || !indicator) return;

  const px = BLUR_STEPS[blurStep];
  svg.style.filter = px > 0 ? `blur(${px}px)` : 'none';

  // Indicatore visivo tipo progress bar ASCII
  const filled = blurStep + 1;
  const empty  = BLUR_STEPS.length - filled;
  const bar    = '▓'.repeat(filled) + '░'.repeat(empty);
  indicator.textContent = `Risoluzione: ${bar}`;

  if (blurStep >= BLUR_STEPS.length - 1) {
    // Completamente rivelato
    if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
    playSFX('correct');
    const btn = document.getElementById('btn-l7-ok');
    if (btn) btn.style.display = 'block';
    const fb = document.getElementById('l7-feedback');
    if (fb) { fb.textContent = '🎮 La vedi adesso?'; fb.className = 'feedback correct'; }
  }
}

function scheduleNextBlur() {
  if (blurStep >= BLUR_STEPS.length - 1) return;
  blurTimer = setTimeout(() => {
    blurStep++;
    applyBlurStep();
    scheduleNextBlur();
  }, BLUR_DELAY);
}

/** SVG ufficiale Steam Deck (secretFront.svg) */
function getSteamDeckSVG() {
  return `
  <svg id="console-svg" width="1024" height="414" viewBox="0 0 1024 414" fill="none"
       xmlns="http://www.w3.org/2000/svg"
       aria-label="Steam Deck" role="img"
       style="transition: filter 1.2s ease; filter: blur(${BLUR_STEPS[0]}px);">
    <path d="M34.8352 20.8957C34.8352 20.8957 41.5423 9.53977 66.2582 6.06818C83.5116 3.64578 158.188 4.98813 158.188 4.98813C158.188 4.98813 166.899 6.2379 166.899 10.6198M987.403 20.8957C987.403 20.8957 980.696 9.53977 955.98 6.06818C938.726 3.64578 864.05 4.98813 864.05 4.98813C864.05 4.98813 855.339 6.2379 855.339 10.6198M3.34961 149.594H49.1214C58.9864 149.594 66.9836 157.592 66.9836 167.457V236.361C66.9836 251.093 71.5375 265.465 80.0217 277.508L159.609 390.485C162.537 394.643 164.109 399.604 164.109 404.689M1020.38 149.594H974.606C964.741 149.594 956.743 157.592 956.743 167.457V236.361C956.743 251.093 952.19 265.465 943.705 277.508L864.118 390.485C861.19 394.643 859.618 399.604 859.618 404.689M192.587 256.887H112.642C105.025 256.887 98.8573 250.715 98.8573 243.093V163.108C98.8573 155.485 105.025 149.314 112.642 149.314H192.571C200.188 149.314 206.356 155.485 206.356 163.108V243.093C206.371 250.715 200.188 256.887 192.587 256.887ZM195.562 299.61H163.415C157.448 299.61 152.606 294.766 152.606 288.795C152.606 282.823 157.448 277.979 163.415 277.979H195.562C201.529 277.979 206.371 282.823 206.371 288.795C206.371 294.766 201.529 299.61 195.562 299.61ZM129.975 40.1229H113.665C109.98 40.1229 107.005 37.1296 107.005 33.4575C107.005 29.7699 109.996 26.792 113.665 26.792H129.975C133.66 26.792 136.636 29.7853 136.636 33.4575C136.652 37.1296 133.66 40.1229 129.975 40.1229ZM197.836 90.0094C197.836 108.893 182.539 124.201 163.669 124.201C144.799 124.201 129.501 108.893 129.501 90.0094C129.501 71.126 144.799 55.818 163.669 55.818C182.539 55.818 197.836 71.126 197.836 90.0094ZM186.822 90.635C186.822 103.698 176.24 114.288 163.185 114.288C150.131 114.288 139.549 103.698 139.549 90.635C139.549 77.5718 150.131 66.9819 163.185 66.9819C176.24 66.9819 186.822 77.5718 186.822 90.635ZM206.711 345.281H198.879C197.691 345.281 196.72 344.309 196.72 343.121C196.72 341.933 197.691 340.961 198.879 340.961H206.711C207.898 340.961 208.87 341.933 208.87 343.121C208.885 344.325 207.914 345.281 206.711 345.281ZM191.8 345.281H183.968C182.78 345.281 181.809 344.309 181.809 343.121C181.809 341.933 182.78 340.961 183.968 340.961H191.8C192.987 340.961 193.959 341.933 193.959 343.121C193.959 344.325 193.003 345.281 191.8 345.281ZM176.891 345.281H169.059C167.872 345.281 166.9 344.309 166.9 343.121C166.9 341.933 167.872 340.961 169.059 340.961H176.891C178.079 340.961 179.05 341.933 179.05 343.121C179.05 344.325 178.079 345.281 176.891 345.281ZM206.71 324.004H198.877C197.69 324.004 196.719 323.032 196.719 321.844C196.719 320.656 197.69 319.684 198.877 319.684H206.71C207.897 319.684 208.869 320.656 208.869 321.844C208.884 323.032 207.913 324.004 206.71 324.004ZM191.847 324.004H184.014C182.827 324.004 181.856 323.032 181.856 321.844C181.856 320.656 182.827 319.684 184.014 319.684H191.847C193.034 319.684 194.006 320.656 194.006 321.844C194.006 323.032 193.034 324.004 191.847 324.004ZM176.968 324.004H169.135C167.948 324.004 166.977 323.032 166.977 321.844C166.977 320.656 167.948 319.684 169.135 319.684H176.968C178.155 319.684 179.126 320.656 179.126 321.844C179.126 323.032 178.17 324.004 176.968 324.004ZM162.105 324.004H154.272C153.085 324.004 152.114 323.032 152.114 321.844C152.114 320.656 153.085 319.684 154.272 319.684H162.105C163.292 319.684 164.263 320.656 164.263 321.844C164.263 323.032 163.292 324.004 162.105 324.004ZM206.711 334.635H191.554C190.367 334.635 189.396 333.663 189.396 332.475C189.396 331.287 190.367 330.315 191.554 330.315H206.711C207.898 330.315 208.869 331.287 208.869 332.475C208.885 333.678 207.913 334.635 206.711 334.635ZM184.616 334.635H176.783C175.596 334.635 174.624 333.663 174.624 332.475C174.624 331.287 175.596 330.315 176.783 330.315H184.616C185.803 330.315 186.774 331.287 186.774 332.475C186.774 333.678 185.803 334.635 184.616 334.635ZM169.397 334.635H161.565C160.377 334.635 159.406 333.663 159.406 332.475C159.406 331.287 160.377 330.315 161.565 330.315H169.397C170.584 330.315 171.556 331.287 171.556 332.475C171.556 333.678 170.584 334.635 169.397 334.635ZM831.856 256.887H911.786C919.403 256.887 925.57 250.715 925.57 243.093V163.108C925.57 155.485 919.403 149.314 911.786 149.314H831.856C824.239 149.314 818.072 155.485 818.072 163.108V243.093C818.072 250.715 824.239 256.887 831.856 256.887ZM828.88 299.61H861.028C866.995 299.61 871.836 294.766 871.836 288.795C871.836 282.823 866.995 277.979 861.028 277.979H828.88C822.913 277.979 818.072 282.823 818.072 288.795C818.072 294.766 822.913 299.61 828.88 299.61ZM894.451 40.1229H910.761C914.446 40.1229 917.422 37.1296 917.422 33.4575C917.422 29.7699 914.431 26.792 910.761 26.792H894.451C890.766 26.792 887.79 29.7853 887.79 33.4575C887.79 37.1296 890.766 40.1229 894.451 40.1229ZM893.943 90.559C893.943 109.442 878.646 124.75 859.776 124.75C840.906 124.75 825.608 109.442 825.608 90.559C825.608 71.6756 840.906 56.3677 859.776 56.3677C878.646 56.3677 893.943 71.6756 893.943 90.559ZM883.615 90.5588C883.615 103.622 873.032 114.212 859.978 114.212C846.924 114.212 836.342 103.622 836.342 90.5588C836.342 77.4956 846.924 66.9057 859.978 66.9057C873.032 66.9057 883.615 77.4956 883.615 90.5588ZM817.717 345.281H825.55C826.737 345.281 827.709 344.309 827.709 343.121C827.709 341.933 826.737 340.961 825.55 340.961H817.717C816.53 340.961 815.559 341.933 815.559 343.121C815.559 344.325 816.515 345.281 817.717 345.281ZM832.626 345.281H840.459C841.646 345.281 842.617 344.309 842.617 343.121C842.617 341.933 841.646 340.961 840.459 340.961H832.626C831.439 340.961 830.467 341.933 830.467 343.121C830.467 344.325 831.439 345.281 832.626 345.281ZM847.551 345.281H855.384C856.571 345.281 857.543 344.309 857.543 343.121C857.543 341.933 856.571 340.961 855.384 340.961H847.551C846.364 340.961 845.393 341.933 845.393 343.121C845.377 344.325 846.349 345.281 847.551 345.281ZM817.717 324.004H825.55C826.737 324.004 827.709 323.032 827.709 321.844C827.709 320.656 826.737 319.684 825.55 319.684H817.717C816.53 319.684 815.559 320.656 815.559 321.844C815.559 323.032 816.515 324.004 817.717 324.004ZM832.58 324.004H840.413C841.6 324.004 842.572 323.032 842.572 321.844C842.572 320.656 841.6 319.684 840.413 319.684H832.58C831.393 319.684 830.422 320.656 830.422 321.844C830.422 323.032 831.393 324.004 832.58 324.004ZM847.46 324.004H855.292C856.48 324.004 857.451 323.032 857.451 321.844C857.451 320.656 856.48 319.684 855.292 319.684H847.46C846.272 319.684 845.301 320.656 845.301 321.844C845.301 323.032 846.272 324.004 847.46 324.004ZM862.338 324.004H870.17C871.358 324.004 872.329 323.032 872.329 321.844C872.329 320.656 871.358 319.684 870.17 319.684H862.338C861.151 319.684 860.179 320.656 860.179 321.844C860.179 323.032 861.135 324.004 862.338 324.004ZM817.717 334.635H832.874C834.061 334.635 835.032 333.663 835.032 332.475C835.032 331.287 834.061 330.315 832.874 330.315H817.717C816.53 330.315 815.559 331.287 815.559 332.475C815.559 333.678 816.515 334.635 817.717 334.635ZM839.827 334.635H847.66C848.847 334.635 849.818 333.663 849.818 332.475C849.818 331.287 848.847 330.315 847.66 330.315H839.827C838.64 330.315 837.669 331.287 837.669 332.475C837.653 333.678 838.624 334.635 839.827 334.635ZM855.045 334.635H862.878C864.065 334.635 865.037 333.663 865.037 332.475C865.037 331.287 864.065 330.315 862.878 330.315H855.045C853.858 330.315 852.887 331.287 852.887 332.475C852.887 333.678 853.843 334.635 855.045 334.635ZM974.606 44.096C974.606 52.4196 967.858 59.1672 959.534 59.1672C951.211 59.1672 944.463 52.4196 944.463 44.096C944.463 35.7724 951.211 29.0248 959.534 29.0248C967.858 29.0248 974.606 35.7724 974.606 44.096ZM974.606 103.871C974.606 112.195 967.858 118.942 959.534 118.942C951.211 118.942 944.463 112.195 944.463 103.871C944.463 95.5476 951.211 88.8 959.534 88.8C967.858 88.8 974.606 95.5476 974.606 103.871ZM1004.19 74.2384C1004.19 82.562 997.438 89.3096 989.114 89.3096C980.791 89.3096 974.043 82.562 974.043 74.2384C974.043 65.9148 980.791 59.1672 989.114 59.1672C997.438 59.1672 1004.19 65.9148 1004.19 74.2384ZM944.463 74.2384C944.463 82.562 937.716 89.3096 929.392 89.3096C921.068 89.3096 914.321 82.562 914.321 74.2384C914.321 65.9148 921.068 59.1672 929.392 59.1672C937.716 59.1672 944.463 65.9148 944.463 74.2384ZM801.936 389.956H221.335C219.315 389.956 217.696 388.32 217.696 386.314V31.0384C217.696 29.0172 219.33 27.3971 221.335 27.3971H801.921C803.94 27.3971 805.559 29.0326 805.559 31.0384V386.314C805.575 388.32 803.94 389.956 801.936 389.956ZM242.5 37H783.098V376.873H242.5V37ZM30.7604 84.1312C28.8943 77.2888 28.8943 70.0716 30.7604 63.2293C31.0549 62.1492 32.0359 61.4 33.1554 61.4H50.2378C52.7041 61.4 54.7034 59.4007 54.7034 56.9344V39.852C54.7034 38.7325 55.4526 37.7515 56.5327 37.457C63.375 35.5909 70.5922 35.5909 77.4346 37.457C78.5146 37.7515 79.2639 38.7325 79.2639 39.852V56.9344C79.2639 59.4007 81.2632 61.4 83.7294 61.4H100.812C101.931 61.4 102.912 62.1492 103.207 63.2293C105.073 70.0716 105.073 77.2888 103.207 84.1312C102.912 85.2112 101.931 85.9605 100.812 85.9605H83.7294C81.2632 85.9605 79.2639 87.9598 79.2639 90.426V107.508C79.2639 108.628 78.5146 109.609 77.4346 109.903C70.5922 111.77 63.375 111.77 56.5327 109.903C55.4526 109.609 54.7034 108.628 54.7034 107.508V90.426C54.7034 87.9598 52.7041 85.9605 50.2378 85.9605H33.1554C32.0359 85.9605 31.0549 85.2112 30.7604 84.1312Z" stroke="white" stroke-width="1.1556" stroke-miterlimit="10"/>
    <path d="M4.68799 138.986C4.07808 84.8566 3.77312 57.7917 17.3951 38.7736C21.7923 32.6345 27.135 27.2312 33.2243 22.765C52.0876 8.92969 79.1543 8.92969 133.288 8.92969H891.302C945.435 8.92969 972.502 8.92969 991.365 22.765C997.454 27.2312 1002.8 32.6345 1007.19 38.7736C1020.82 57.7917 1020.51 84.8566 1019.9 138.986L1018.87 230.404C1018.05 303.325 1017.64 339.786 998.847 365.286C992.776 373.525 985.454 380.765 977.146 386.744C951.436 405.247 914.973 405.247 842.047 405.247H182.542C109.616 405.247 73.1532 405.247 47.443 386.744C39.1358 380.765 31.8139 373.525 25.7421 365.286C6.95052 339.786 6.53969 303.325 5.71804 230.404L4.68799 138.986Z" stroke="white" stroke-width="3.46681"/>
    <path opacity="0.3" d="M1020.38 99.3572L1016.93 80.5049C1010.52 45.5118 980.024 20.0938 944.449 20.0938H79.2781C43.7032 20.0938 13.2086 45.5118 6.80144 80.5049L3.34961 99.3572M210.552 90.7616C210.552 116.843 189.409 137.985 163.328 137.985C137.247 137.985 116.105 116.843 116.105 90.7616C116.105 64.6806 137.247 43.5379 163.328 43.5379C189.409 43.5379 210.552 64.6806 210.552 90.7616ZM907.177 90.4787C907.177 116.56 886.034 137.702 859.953 137.702C833.872 137.702 812.73 116.56 812.73 90.4787C812.73 64.3977 833.872 43.2549 859.953 43.2549C886.034 43.2549 907.177 64.3977 907.177 90.4787Z" stroke="white" stroke-width="1.1556" stroke-miterlimit="10"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M310.358 29.0261C311.591 29.0261 312.591 28.0264 312.591 26.7933C312.591 25.5602 311.591 24.5605 310.358 24.5605C309.125 24.5605 308.125 25.5602 308.125 26.7933C308.125 28.0264 309.125 29.0261 310.358 29.0261ZM716.721 29.0261C717.954 29.0261 718.954 28.0264 718.954 26.7933C718.954 25.5602 717.954 24.5605 716.721 24.5605C715.488 24.5605 714.488 25.5602 714.488 26.7933C714.488 28.0264 715.488 29.0261 716.721 29.0261Z" fill="white"/>
  </svg>`;
}

// ════════════════════════════════════════════════════
// ██ LIVELLO 8 — CODICE FINALE (Keypad) ██
// ════════════════════════════════════════════════════

function renderL8() {
  const box = document.getElementById('level-content');
  keypadVal      = '';
  keypadAttempts = 0;
  wrongAttempts[8] = 0;

  box.innerHTML = `
    <div class="level-title">LIVELLO 8 — CODICE FINALE</div>
    <div class="level-clue">
      Hollow Knight. The Binding of Isaac. Dark Souls. Kingdom Hearts. Balatro.<br><br>
      Cosa accomuna tutti questi giochi?<br><br>
      Il fatto che da oggi potrai portarli sempre con te.<br><br>
      Inserisci il tuo <b>codice</b> per scoprire il perché.
    </div>
    <div class="keypad-wrap">
      <div class="keypad-display" id="kp-display">
        <span id="kp-text">_ _ _ _ _ _</span>
      </div>
      <div class="keypad-grid">
        ${[1,2,3,4,5,6,7,8,9].map(n => `
          <button class="key-btn" data-key="${n}">${n}</button>
        `).join('')}
        <button class="key-btn key-del" data-key="del">⌫</button>
        <button class="key-btn" data-key="0">0</button>
        <button class="key-btn key-ok"  data-key="ok">✓</button>
      </div>
    </div>
    <div class="hint-text" id="l8-hint">
      💡 Il codice è una data importante per te…<br>giorno, mese, anno. Senza spazi o simboli.
    </div>
    <div class="feedback" id="l8-feedback"></div>
  `;

  document.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', () => handleKeypad(btn.dataset.key));
  });

  // Tastiera fisica
  document.addEventListener('keydown', l8KeyHandler);
}

function l8KeyHandler(e) {
  if (e.key >= '0' && e.key <= '9') handleKeypad(e.key);
  else if (e.key === 'Backspace')    handleKeypad('del');
  else if (e.key === 'Enter')        handleKeypad('ok');
}

function handleKeypad(key) {
  playSFX('click');
  const fb = document.getElementById('l8-feedback');

  if (key === 'del') {
    keypadVal = keypadVal.slice(0, -1);
  } else if (key === 'ok') {
    checkFinalCode();
    return;
  } else {
    if (keypadVal.length < 8) keypadVal += key; // max 8 cifre
  }

  updateKeypadDisplay();
}

function updateKeypadDisplay() {
  const display = document.getElementById('kp-text');
  if (!display) return;
  if (keypadVal.length === 0) {
    display.textContent = '_ _ _ _ _ _';
  } else {
    display.textContent = keypadVal.split('').join(' ');
  }
}

function checkFinalCode() {
  const fb = document.getElementById('l8-feedback');
  if (keypadVal === CODICE_FINALE) {
    playSFX('levelup');
    if (fb) { fb.textContent = '✅ CODICE ACCETTATO.'; fb.className = 'feedback correct'; }
    // Rimuovi listener tastiera
    document.removeEventListener('keydown', l8KeyHandler);
    setTimeout(() => {
      currentLevel = 8; // ensure
      nextLevel();
    }, 1000);
  } else {
    playSFX('wrong');
    keypadAttempts++;
    wrongAttempts[8] = keypadAttempts;
    if (fb) { fb.textContent = `❌ Codice errato. Riprova. (tentativo ${keypadAttempts})`; fb.className = 'feedback wrong'; }
    if (keypadAttempts >= 3) {
      const hint = document.getElementById('l8-hint');
      if (hint) hint.classList.add('visible');
    }
    // Shake display
    const disp = document.getElementById('kp-display');
    if (disp) {
      disp.style.animation = 'none';
      void disp.offsetHeight;
      disp.style.animation = 'glitch-flash 0.4s ease';
    }
    keypadVal = '';
    setTimeout(() => updateKeypadDisplay(), 300);
  }
}

// ════════════════════════════════════════════════════
// SCHERMATA FINALE + CONFETTI
// ════════════════════════════════════════════════════

function showFinale() {
  // Rimuovi eventuali listener del livello 8
  document.removeEventListener('keydown', l8KeyHandler);
  if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }

  showScreen('screen-finale');

  // Aggiorna progress bar al 100%
  const pb = document.getElementById('progress-bar');
  if (pb) pb.style.width = '100%';

  // Gestione immagine di gruppo (nasconde se non trovata)
  const img = document.getElementById('group-photo');
  if (img) {
    img.addEventListener('load', () => {
      document.getElementById('photo-fallback').style.display = 'none';
    });
    // Se l'immagine era già in errore prima
    if (img.complete && !img.naturalWidth) {
      img.style.display = 'none';
      document.getElementById('photo-fallback').style.display = 'flex';
    }
  }

  // Confetti!
  startConfetti();

  // Pulsante ricomincia
  document.getElementById('btn-restart').addEventListener('click', () => {
    playSFX('click');
    stopConfetti();
    resetProgress();
    currentLevel = 0;
    wrongAttempts = {};
    location.reload(); // modo più sicuro per reset completo
  });
}

// ── Confetti ───────────────────────────────────────────────────

const CONFETTI_COLORS = [
  '#00ff88', '#9b59b6', '#e74c3c', '#f1c40f',
  '#3498db', '#2ecc71', '#e67e22', '#ff69b4'
];

function startConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  canvas.classList.add('active');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  confettiParticles = [];
  for (let i = 0; i < 180; i++) {
    confettiParticles.push({
      x:   Math.random() * canvas.width,
      y:   Math.random() * canvas.height - canvas.height,
      w:   Math.random() * 12 + 6,
      h:   Math.random() * 6  + 3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      speedY: Math.random() * 3 + 1.2,
      speedX: Math.random() * 2 - 1,
      angle:  Math.random() * Math.PI * 2,
      spin:   (Math.random() - 0.5) * 0.12,
      opacity: Math.random() * 0.5 + 0.5
    });
  }

  animateConfetti();
}

function animateConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  confettiParticles.forEach(p => {
    p.y     += p.speedY;
    p.x     += p.speedX;
    p.angle += p.spin;

    if (p.y > canvas.height + 20) {
      // Ricicla in cima
      p.y = -20;
      p.x = Math.random() * canvas.width;
    }

    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  });

  confettiRAF = requestAnimationFrame(animateConfetti);
}

function stopConfetti() {
  if (confettiRAF) { cancelAnimationFrame(confettiRAF); confettiRAF = null; }
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) canvas.classList.remove('active');
  confettiParticles = [];
}

// Ridimensiona canvas confetti al resize
window.addEventListener('resize', () => {
  const canvas = document.getElementById('confetti-canvas');
  if (canvas && canvas.classList.contains('active')) {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
});

// ════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════

(function init() {
  // Recupera progresso salvato
  const saved = loadProgress();

  // Il primo click/tasto avvia il contesto audio (rispetta policy browser autoplay)
  function onFirstInteraction() {
    initAudio();
    document.removeEventListener('click', onFirstInteraction);
    document.removeEventListener('keydown', onFirstInteraction);
  }
  document.addEventListener('click',   onFirstInteraction, { once: true });
  document.addEventListener('keydown', onFirstInteraction, { once: true });

  // Pulsante START
  document.getElementById('btn-start').addEventListener('click', () => {
    playSFX('click');
    currentLevel = 1;
    saveProgress();
    showLevelScreen(1);
  });

  // Se c'è un progresso salvato, mostra la schermata appropriata
  if (saved > 0 && saved <= 8) {
    // Mostra un piccolo banner "Continua dal livello N"
    const card = document.querySelector('.center-card');
    const resumeBanner = document.createElement('div');
    resumeBanner.style.cssText = `
      font-size: 0.42rem;
      color: var(--yellow);
      border: 1px dashed var(--yellow);
      padding: 0.6rem 1rem;
      text-align: center;
      max-width: 400px;
      line-height: 2;
      background: rgba(241,196,15,0.05);
    `;
    resumeBanner.innerHTML = `
      💾 Progresso salvato: LIVELLO ${saved}/8<br>
      <button id="btn-resume" class="btn btn-secondary" style="margin-top:0.6rem;font-size:0.4rem">
        ▶ RIPRENDI
      </button>
      &nbsp;
      <button id="btn-newgame" class="btn btn-secondary" style="margin-top:0.6rem;font-size:0.4rem;border-color:#e74c3c;color:#e74c3c">
        ✕ RICOMINCIA
      </button>
    `;
    card.appendChild(resumeBanner);

    document.getElementById('btn-resume').addEventListener('click', () => {
      playSFX('click');
      currentLevel = saved;
      showLevelScreen(saved);
    });
    document.getElementById('btn-newgame').addEventListener('click', () => {
      playSFX('click');
      resetProgress();
      resumeBanner.remove();
      currentLevel = 0;
      wrongAttempts = {};
    });
  } else if (saved > 8) {
    // Progresso al finale
    currentLevel = 9;
    showFinale();
    return;
  }

  // Mostra intro
  showScreen('screen-intro');
})();
