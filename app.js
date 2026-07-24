/* DoseNote — app shell, schedule engine and alarms.
   State lives in localStorage only. Nothing about your health leaves the device. */

const STORE_KEY = 'dosenote.v1';
const SNOOZE_MINUTES = 10;
const MISSED_AFTER_MINUTES = 60;

let state = { meds: [], log: {}, snooze: {} };
let pending = null;          // parse result awaiting confirmation
let readonly = false;
const firedThisSession = new Set();

/* --------------------------------------------------------------------- */
/* Storage                                                                */
/* --------------------------------------------------------------------- */

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = {
        meds: parsed.meds || [],
        log: parsed.log || {},
        snooze: parsed.snooze || {},
      };
    }
  } catch (err) {
    console.warn('Could not read saved data, starting fresh.', err);
  }
}

function save() {
  if (readonly) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Could not save.', err);
  }
}

/* --------------------------------------------------------------------- */
/* Date helpers                                                           */
/* --------------------------------------------------------------------- */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function dateFromISOAndTime(iso, time) {
  const [y, m, d] = iso.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA + 'T00:00:00');
  const b = new Date(isoB + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function doseKey(medId, iso, time) {
  return `${medId}|${iso}|${time}`;
}

/* --------------------------------------------------------------------- */
/* Schedule                                                               */
/* --------------------------------------------------------------------- */

function isActiveOn(med, iso) {
  const elapsed = daysBetween(med.startDate || iso, iso);
  if (elapsed < 0) return false;
  if (med.durationDays && elapsed >= med.durationDays) return false;
  return true;
}

function dosesFor(iso) {
  const list = [];
  for (const med of state.meds) {
    if (!isActiveOn(med, iso)) continue;
    if (med.asNeeded) {
      list.push({ med, time: 'prn', at: null, key: doseKey(med.id, iso, 'prn') });
      continue;
    }
    for (const time of med.times) {
      list.push({
        med,
        time,
        at: dateFromISOAndTime(iso, time),
        key: doseKey(med.id, iso, time),
      });
    }
  }
  list.sort((a, b) => {
    if (!a.at) return 1;
    if (!b.at) return -1;
    return a.at - b.at;
  });
  return list;
}

function doseStatus(dose, now) {
  if (state.log[dose.key] === 'taken') return 'taken';
  if (!dose.at) return 'upcoming';
  const diffMin = (now - dose.at) / 60000;
  if (diffMin < 0) return 'upcoming';
  if (diffMin <= MISSED_AFTER_MINUTES) return 'now';
  return 'missed';
}

/* --------------------------------------------------------------------- */
/* Rendering — Today                                                      */
/* --------------------------------------------------------------------- */

let lastRenderSig = null;

function renderToday() {
  const iso = todayISO();
  const now = new Date();
  const doses = dosesFor(iso);
  const nextDose = doses.find((d) => d.at && doseStatus(d, now) === 'upcoming');

  // The clock ticks every second but the view rarely changes. Rebuilding the
  // list only when something visible moved keeps taps from landing on a
  // element that was just replaced.
  const sig =
    iso +
    '|' +
    doses.map((d) => d.key + ':' + doseStatus(d, now)).join(',') +
    '|' +
    (nextDose ? nextDose.key + relativeTime(nextDose.at, now) : '');
  if (sig === lastRenderSig) return;
  lastRenderSig = sig;

  $('#today-date').textContent = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const taken = doses.filter((d) => state.log[d.key] === 'taken').length;

  $('#today-empty').hidden = doses.length > 0;
  $('#timeline').hidden = doses.length === 0;

  $('#today-summary').textContent = doses.length
    ? `${taken} of ${doses.length} doses taken`
    : 'No medications yet.';

  // Next upcoming dose banner
  const next = nextDose;
  const banner = $('#next-dose');
  if (next) {
    banner.hidden = false;
    $('#next-dose-name').textContent =
      next.med.name + (next.med.dose ? ` · ${next.med.dose}` : '');
    $('#next-dose-when').textContent = `${DoseParser.prettyTime(next.time)} — ${relativeTime(
      next.at,
      now
    )}`;
  } else {
    banner.hidden = true;
  }

  const tl = $('#timeline');
  tl.innerHTML = '';
  for (const dose of doses) {
    const status = doseStatus(dose, now);
    const li = document.createElement('li');
    li.className = 'dose';
    if (status === 'taken') li.classList.add('is-taken');
    if (status === 'missed') li.classList.add('is-missed');
    if (status === 'now') li.classList.add('is-now');

    const timeEl = document.createElement('span');
    timeEl.className = 'dose-time';
    timeEl.textContent = dose.at ? DoseParser.prettyTime(dose.time) : 'As needed';

    const main = document.createElement('div');
    main.className = 'dose-main';
    const name = document.createElement('div');
    name.className = 'dose-name';
    name.textContent = dose.med.name;
    const sub = document.createElement('div');
    sub.className = 'dose-sub';
    sub.textContent = subtitleFor(dose, status);
    main.append(name, sub);

    li.append(timeEl, main);

    if (!readonly) {
      const check = document.createElement('button');
      check.className = 'dose-check';
      check.setAttribute(
        'aria-label',
        status === 'taken' ? `Mark ${dose.med.name} as not taken` : `Mark ${dose.med.name} as taken`
      );
      check.addEventListener('click', () => toggleTaken(dose.key));
      li.append(check);
    } else {
      const mark = document.createElement('span');
      mark.className = 'pill';
      mark.textContent = status === 'taken' ? 'Taken' : status === 'missed' ? 'Missed' : 'Pending';
      li.append(mark);
    }

    tl.append(li);
  }
}

function subtitleFor(dose, status) {
  const bits = [];
  if (dose.med.dose) bits.push(dose.med.dose);
  const key = dose.med.instructions.find(
    (i) => i.tag === 'with-food' || i.tag === 'empty-stomach'
  );
  if (key) bits.push(key.tag === 'with-food' ? 'with food' : 'empty stomach');
  if (status === 'missed') bits.push('missed');
  return bits.join(' · ') || dose.med.frequencyLabel;
}

function relativeTime(then, now) {
  const mins = Math.round((then - now) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `in ${hrs}h ${rem}m` : `in ${hrs}h`;
}

function toggleTaken(key) {
  if (state.log[key] === 'taken') delete state.log[key];
  else state.log[key] = 'taken';
  save();
  renderToday();
}

/* --------------------------------------------------------------------- */
/* Rendering — Medications                                                */
/* --------------------------------------------------------------------- */

function renderMeds() {
  const list = $('#med-list');
  list.innerHTML = '';
  $('#meds-empty').hidden = state.meds.length > 0;

  for (const med of state.meds) {
    const card = document.createElement('div');
    card.className = 'med-card';
    card.tabIndex = 0;

    const top = document.createElement('div');
    top.className = 'med-top';
    const name = document.createElement('span');
    name.className = 'med-name';
    name.textContent = med.name;
    const dose = document.createElement('span');
    dose.className = 'med-dose';
    dose.textContent = med.dose;
    top.append(name, dose);

    const meta = document.createElement('div');
    meta.className = 'med-meta';
    meta.textContent = metaLine(med);

    const pills = document.createElement('div');
    pills.className = 'pills';
    for (const ins of med.instructions) {
      const p = document.createElement('span');
      p.className = 'pill' + (isWarnTag(ins.tag) ? ' pill-warn' : '');
      p.textContent = pillLabel(ins.tag);
      pills.append(p);
    }

    card.append(top, meta, pills);
    card.addEventListener('click', () => openSheet(med));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSheet(med);
      }
    });
    list.append(card);
  }

  renderFlags();
}

function metaLine(med) {
  const bits = [med.frequencyLabel];
  if (!med.asNeeded) bits.push(med.times.map(DoseParser.prettyTime).join(', '));
  if (med.durationDays) {
    const end = new Date();
    const start = new Date(med.startDate + 'T00:00:00');
    end.setTime(start.getTime() + (med.durationDays - 1) * 86400000);
    bits.push(
      `${med.durationDays} days, through ${end.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })}`
    );
  }
  return bits.join(' · ');
}

const PILL_LABELS = {
  'with-food': 'With food',
  'empty-stomach': 'Empty stomach',
  grapefruit: 'No grapefruit',
  dairy: 'No dairy',
  alcohol: 'No alcohol',
  drowsy: 'Causes drowsiness',
  water: 'Full glass of water',
  'swallow-whole': 'Swallow whole',
  'finish-course': 'Finish the course',
  'as-needed': 'As needed',
};

function pillLabel(tag) {
  return PILL_LABELS[tag] || tag;
}

function isWarnTag(tag) {
  return ['grapefruit', 'dairy', 'alcohol', 'drowsy', 'finish-course'].includes(tag);
}

function renderFlags() {
  const wrap = $('#flags');
  wrap.innerHTML = '';
  for (const flag of computeFlags()) {
    const el = document.createElement('div');
    el.className = 'flag flag-' + flag.level;
    const t = document.createElement('strong');
    t.textContent = flag.title;
    const d = document.createElement('p');
    d.textContent = flag.detail;
    el.append(t, d);
    wrap.append(el);
  }
}

/* Flags are recomputed from saved meds so they stay correct after edits. */
function computeFlags() {
  const meds = state.meds;
  const flags = [];

  const byTime = {};
  for (const med of meds) {
    if (med.asNeeded) continue;
    for (const t of med.times) (byTime[t] = byTime[t] || []).push(med.name);
  }
  for (const [time, names] of Object.entries(byTime)) {
    if (names.length > 1) {
      flags.push({
        level: 'check',
        title: `${names.length} medications at ${DoseParser.prettyTime(time)}`,
        detail: `${names.join(
          ' and '
        )} are both scheduled for the same time. Worth asking a pharmacist whether they can be taken together.`,
      });
    }
  }

  for (const med of meds) {
    if (med.doseUnitUnknown && med.dose) {
      flags.push({
        level: 'check',
        title: `Confirm the unit for ${med.name}`,
        detail: `Your note said "${med.dose}" with no unit. Check the label or prescription — it is most likely mg, but do not assume.`,
      });
    }
  }

  const withFood = meds.filter((m) => m.instructions.some((i) => i.tag === 'with-food'));
  const empty = meds.filter((m) => m.instructions.some((i) => i.tag === 'empty-stomach'));
  for (const a of withFood) {
    for (const b of empty) {
      const shared = a.times.filter((t) => b.times.includes(t));
      if (shared.length) {
        flags.push({
          level: 'conflict',
          title: `${a.name} and ${b.name} conflict`,
          detail: `${a.name} needs food and ${b.name} needs an empty stomach, but both sit at ${DoseParser.prettyTime(
            shared[0]
          )}. These need to be spaced apart.`,
        });
      }
    }
  }

  for (const med of meds) {
    if (!med.durationDays) continue;
    const start = new Date(med.startDate + 'T00:00:00');
    const end = new Date(start.getTime() + (med.durationDays - 1) * 86400000);
    const daysLeft = Math.ceil((end - new Date()) / 86400000);
    if (daysLeft >= 0) {
      flags.push({
        level: 'info',
        title: `${med.name}: ${daysLeft === 0 ? 'last day' : `${daysLeft} days left`}`,
        detail: `Course ends ${end.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })}. ${
          med.instructions.some((i) => i.tag === 'finish-course')
            ? 'Finish every dose even if you feel better.'
            : 'Check whether you need a refill or follow-up.'
        }`,
      });
    }
  }

  return flags;
}

/* --------------------------------------------------------------------- */
/* Instruction sheet                                                      */
/* --------------------------------------------------------------------- */

function openSheet(med) {
  const body = $('#sheet-body');
  body.innerHTML = '';

  const h = document.createElement('h2');
  h.textContent = med.name;
  const sub = document.createElement('p');
  sub.className = 'muted';
  sub.textContent = [med.dose, med.frequencyLabel].filter(Boolean).join(' · ');
  body.append(h, sub);

  if (!med.asNeeded) {
    const times = document.createElement('div');
    times.className = 'sheet-times';
    for (const t of med.times) {
      const p = document.createElement('span');
      p.className = 'pill';
      p.textContent = DoseParser.prettyTime(t);
      times.append(p);
    }
    body.append(times);
  }

  const howTitle = document.createElement('h3');
  howTitle.style.marginTop = '1.4rem';
  howTitle.textContent = 'How to take it';
  body.append(howTitle);

  const ul = document.createElement('ul');
  ul.className = 'howto';
  const items = med.instructions.length
    ? med.instructions
    : [{ tag: 'plain', text: 'No special instructions were given. Take it at the scheduled times.' }];
  for (const ins of items) {
    const li = document.createElement('li');
    if (isWarnTag(ins.tag)) li.className = 'warn';
    li.textContent = ins.text;
    ul.append(li);
  }
  body.append(ul);

  if (med.raw) {
    const raw = document.createElement('p');
    raw.className = 'muted small';
    raw.style.marginTop = '1.2rem';
    raw.textContent = `From your note: "${med.raw}"`;
    body.append(raw);
  }

  if (!readonly) {
    const del = document.createElement('button');
    del.className = 'danger-link';
    del.textContent = 'Remove this medication';
    del.addEventListener('click', () => {
      state.meds = state.meds.filter((m) => m.id !== med.id);
      save();
      closeSheet();
      renderAll();
    });
    body.append(del);
  }

  $('#sheet').hidden = false;
}

function closeSheet() {
  $('#sheet').hidden = true;
}

/* --------------------------------------------------------------------- */
/* Intake and parse preview                                               */
/* --------------------------------------------------------------------- */

const EXAMPLES = {
  antibiotic:
    'Amoxicillin 500mg three times a day for 10 days, take with food and finish the entire course.',
  chronic:
    'Lisinopril 10mg every morning, avoid grapefruit. Atorvastatin 20mg at bedtime, swallow whole.',
  messy:
    "Doctor said take the amoxicillin 500 three times a day for 10 days with food, and the blood pressure one lisinopril 10mg every morning, don't take it with grapefruit. Also ibuprofen 400mg every 6 hours as needed for the pain, with a full glass of water, may cause drowsiness.",
  label:
    'AMOXICILLIN 500MG CAPSULE. TAKE 1 CAPSULE BY MOUTH 3 TIMES DAILY FOR 10 DAYS. TAKE WITH FOOD. FINISH ALL MEDICATION.',
};

function runParse() {
  const text = $('#orders-input').value.trim();
  if (!text) return;
  const result = DoseParser.parseOrders(text);

  if (!result.meds.length) {
    $('#parse-preview').innerHTML =
      '<p class="muted">I could not find a medication in that. Try including the name and how often to take it — for example "amoxicillin 500mg three times a day".</p>';
    $('#parse-result').hidden = false;
    $('#save-btn').disabled = true;
    pending = null;
    return;
  }

  pending = result.meds;
  $('#save-btn').disabled = false;
  renderPreview();
  $('#parse-result').hidden = false;
  $('#parse-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPreview() {
  const wrap = $('#parse-preview');
  wrap.innerHTML = '';

  pending.forEach((med, idx) => {
    const card = document.createElement('div');
    card.className = 'preview-card';

    card.append(field('Name', med.name, (v) => (pending[idx].name = v)));
    card.append(
      field(
        'Dose',
        med.dose,
        (v) => {
          pending[idx].dose = v;
          // Still incomplete until a unit is actually typed.
          pending[idx].doseUnitUnknown = v.trim() !== '' && !/[a-z]/i.test(v);
        },
        med.doseUnitUnknown ? 'add the unit — mg, ml, tablets…' : ''
      )
    );
    card.append(
      field('Times', med.times.join(', '), (v) => {
        const times = v
          .split(',')
          .map((t) => normalizeTime(t.trim()))
          .filter(Boolean);
        if (times.length) pending[idx].times = times;
      })
    );
    card.append(
      field('Days', med.durationDays ? String(med.durationDays) : '', (v) => {
        const n = parseInt(v, 10);
        pending[idx].durationDays = Number.isFinite(n) && n > 0 ? n : null;
      }, 'blank = ongoing')
    );

    if (med.instructions.length) {
      const pills = document.createElement('div');
      pills.className = 'pills';
      for (const ins of med.instructions) {
        const p = document.createElement('span');
        p.className = 'pill' + (isWarnTag(ins.tag) ? ' pill-warn' : '');
        p.textContent = pillLabel(ins.tag);
        pills.append(p);
      }
      card.append(pills);
    }

    const raw = document.createElement('div');
    raw.className = 'raw';
    raw.textContent = `read from: "${med.raw}"`;
    card.append(raw);

    wrap.append(card);
  });
}

function field(label, value, onChange, placeholder) {
  const row = document.createElement('div');
  row.className = 'row';
  const l = document.createElement('label');
  l.textContent = label;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  if (placeholder) input.placeholder = placeholder;
  input.addEventListener('input', () => onChange(input.value));
  row.append(l, input);
  return row;
}

/* Accepts "8:00", "8am", "20:00", "8" and returns "HH:MM". */
function normalizeTime(str) {
  if (!str) return null;
  const m = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3] && m[3].toLowerCase();
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
}

function savePending() {
  if (!pending || !pending.length) return;
  state.meds.push(...pending);
  save();
  pending = null;
  $('#orders-input').value = '';
  $('#parse-result').hidden = true;
  renderAll();
  switchView('today');
}

/* --------------------------------------------------------------------- */
/* Alarms                                                                 */
/* --------------------------------------------------------------------- */

let audioCtx = null;
let beepTimer = null;
let activeAlarm = null;

function alarmsReady() {
  return audioCtx !== null && audioCtx.state === 'running';
}

async function enableAlarms() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
  } catch (err) {
    console.warn('Audio unavailable.', err);
  }
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (err) {
      console.warn('Notification permission failed.', err);
    }
  }
  updateAlarmStatus();
}

function updateAlarmStatus() {
  const el = $('#alarm-status');
  if (readonly) {
    el.hidden = true;
    return;
  }
  el.hidden = alarmsReady();
}

function beep() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  // Two short rising tones — carries better than a single flat beep.
  [0, 0.22].forEach((offset, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(i === 0 ? 880 : 1180, now + offset);
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.32, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.19);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.2);
  });
}

function fireAlarm(dose) {
  if (activeAlarm) return;
  activeAlarm = dose;
  firedThisSession.add(dose.key);

  $('#alarm-name').textContent = dose.med.name;
  $('#alarm-dose').textContent = [dose.med.dose, dose.at ? DoseParser.prettyTime(dose.time) : '']
    .filter(Boolean)
    .join(' · ');

  const ins = $('#alarm-instructions');
  ins.innerHTML = '';
  for (const item of dose.med.instructions) {
    const d = document.createElement('div');
    d.textContent = item.text;
    ins.append(d);
  }

  $('#alarm-foot').textContent = dose.isTest
    ? 'This was a test alarm.'
    : 'Snoozing reminds you again in 10 minutes.';

  $('#alarm').hidden = false;

  beep();
  beepTimer = setInterval(beep, 1400);

  if (navigator.vibrate) {
    try {
      navigator.vibrate([500, 250, 500, 250, 500]);
    } catch (err) {
      void err;
    }
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`Time to take ${dose.med.name}`, {
        body: dose.med.dose || 'Tap to open DoseNote',
        tag: dose.key,
        requireInteraction: true,
      });
    } catch (err) {
      void err;
    }
  }
}

function dismissAlarm(action) {
  if (!activeAlarm) return;
  const dose = activeAlarm;

  clearInterval(beepTimer);
  beepTimer = null;
  if (navigator.vibrate) {
    try {
      navigator.vibrate(0);
    } catch (err) {
      void err;
    }
  }
  $('#alarm').hidden = true;
  activeAlarm = null;

  if (dose.isTest) return;

  if (action === 'taken') {
    state.log[dose.key] = 'taken';
  } else {
    state.snooze[dose.key] = Date.now() + SNOOZE_MINUTES * 60000;
    firedThisSession.delete(dose.key);
  }
  save();
  renderToday();
}

function checkDueDoses() {
  if (readonly || activeAlarm) return;
  const now = new Date();
  const iso = todayISO();

  for (const dose of dosesFor(iso)) {
    if (!dose.at) continue;
    if (state.log[dose.key] === 'taken') continue;
    if (firedThisSession.has(dose.key)) continue;

    const snoozedUntil = state.snooze[dose.key];
    if (snoozedUntil && Date.now() < snoozedUntil) continue;

    const dueAt = snoozedUntil && Date.now() >= snoozedUntil ? snoozedUntil : dose.at.getTime();
    const elapsedMin = (Date.now() - dueAt) / 60000;

    if (elapsedMin >= 0 && elapsedMin <= MISSED_AFTER_MINUTES) {
      fireAlarm(dose);
      return;
    }
  }
}

function testAlarm() {
  enableAlarms().then(() => {
    const med = state.meds[0] || {
      name: 'Test medication',
      dose: '500 mg',
      instructions: [
        { tag: 'with-food', text: 'This is what a real alarm looks like. Take with food.' },
      ],
    };
    $('#test-alarm').textContent = 'Firing in 10s…';
    setTimeout(() => {
      $('#test-alarm').textContent = 'Test alarm (10s)';
      fireAlarm({ med, time: '00:00', at: new Date(), key: 'test', isTest: true });
    }, 10000);
  });
}

/* --------------------------------------------------------------------- */
/* Caregiver share link                                                   */
/* --------------------------------------------------------------------- */

function encodeState() {
  // Only the last week of history travels in the link — a caregiver cares
  // about recent adherence, and it keeps the URL from growing forever.
  const cutoff = new Date(Date.now() - 7 * 86400000);
  const recentLog = {};
  for (const [key, value] of Object.entries(state.log)) {
    const iso = key.split('|')[1];
    if (iso && new Date(iso + 'T00:00:00') >= cutoff) recentLog[key] = value;
  }
  const payload = JSON.stringify({ meds: state.meds, log: recentLog });
  const bytes = new TextEncoder().encode(payload);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function shareWithCaregiver() {
  if (!state.meds.length) {
    alert('Add a medication first.');
    return;
  }
  const url = location.origin + location.pathname + '#view=' + encodeState();
  try {
    await navigator.clipboard.writeText(url);
    const btn = $('#share-btn');
    btn.textContent = 'Link copied';
    setTimeout(() => (btn.textContent = 'Share with caregiver'), 2200);
  } catch (err) {
    void err;
    prompt('Copy this link and send it to your caregiver:', url);
  }
}

function tryReadonlyMode() {
  const hash = location.hash;
  if (!hash.startsWith('#view=')) return false;
  try {
    const data = decodeState(hash.slice(6));
    state = { meds: data.meds || [], log: data.log || {}, snooze: {} };
    readonly = true;
    document.body.classList.add('readonly');
    const banner = document.createElement('div');
    banner.className = 'readonly-banner';
    banner.textContent = 'Caregiver view — read only. This is a shared snapshot of someone’s schedule.';
    document.body.insertBefore(banner, document.body.firstChild);
    return true;
  } catch (err) {
    console.warn('Could not read shared link.', err);
    return false;
  }
}

/* --------------------------------------------------------------------- */
/* Views                                                                  */
/* --------------------------------------------------------------------- */

function switchView(name) {
  $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === 'view-' + name));
  $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === name));
  window.scrollTo({ top: 0 });
}

function renderAll() {
  renderToday();
  renderMeds();
  updateAlarmStatus();
}

/* --------------------------------------------------------------------- */
/* Speech input                                                           */
/* --------------------------------------------------------------------- */

function setupMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $('#mic-btn');
  if (!SR) {
    btn.hidden = true;
    return;
  }
  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = 'en-US';
  let listening = false;

  rec.addEventListener('result', (e) => {
    let text = '';
    for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
    const box = $('#orders-input');
    box.value = (box.value + ' ' + text).trim();
  });
  rec.addEventListener('end', () => {
    listening = false;
    btn.textContent = 'Speak it';
    btn.classList.remove('is-on');
  });
  rec.addEventListener('error', () => {
    listening = false;
    btn.textContent = 'Speak it';
    btn.classList.remove('is-on');
  });

  btn.addEventListener('click', () => {
    if (listening) {
      rec.stop();
    } else {
      try {
        rec.start();
        listening = true;
        btn.textContent = 'Listening… tap to stop';
        btn.classList.add('is-on');
      } catch (err) {
        void err;
      }
    }
  });
}

/* --------------------------------------------------------------------- */
/* Wiring                                                                 */
/* --------------------------------------------------------------------- */

function init() {
  const shared = tryReadonlyMode();
  if (!shared) load();

  $$('.tab').forEach((tab) =>
    tab.addEventListener('click', () => switchView(tab.dataset.view))
  );
  $$('[data-goto]').forEach((btn) =>
    btn.addEventListener('click', () => switchView(btn.dataset.goto))
  );

  $('#parse-btn').addEventListener('click', runParse);
  $('#save-btn').addEventListener('click', savePending);
  $('#discard-btn').addEventListener('click', () => {
    pending = null;
    $('#parse-result').hidden = true;
  });
  $('#clear-btn').addEventListener('click', () => {
    $('#orders-input').value = '';
    $('#parse-result').hidden = true;
    pending = null;
  });

  $$('[data-example]').forEach((chip) =>
    chip.addEventListener('click', () => {
      $('#orders-input').value = EXAMPLES[chip.dataset.example];
      runParse();
    })
  );

  $('#enable-alarms').addEventListener('click', enableAlarms);
  $('#test-alarm').addEventListener('click', testAlarm);
  $('#alarm-taken').addEventListener('click', () => dismissAlarm('taken'));
  $('#alarm-snooze').addEventListener('click', () => dismissAlarm('snooze'));
  $('#share-btn').addEventListener('click', shareWithCaregiver);

  $('#sheet-close').addEventListener('click', closeSheet);
  $('#sheet').addEventListener('click', (e) => {
    if (e.target.id === 'sheet') closeSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
  });

  setupMic();
  renderAll();

  setInterval(() => {
    renderToday();
    checkDueDoses();
  }, 1000);

  // Re-check immediately when the tab comes back into focus.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      renderToday();
      checkDueDoses();
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW failed', err));
  }
}

document.addEventListener('DOMContentLoaded', init);
