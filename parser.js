/* DoseNote — natural language medication parser.
   Turns messy doctor's-orders text into structured schedules.
   No network, no dependencies. Everything runs in the tab. */

const DOSE_RE =
  /(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?|tablets?|tabs?|pills?|capsules?|caps?|drops?|puffs?|sprays?)\b/i;

/* Words that can never be a drug name. Used to decide where one
   medication ends and the next begins. Generous on purpose — a missed
   word here just means we merge two fragments, which is the safe failure. */
const KNOWN_WORDS = new Set(
  `doctor doctors dr physician nurse pharmacist pharmacy prescription prescribed prescribe
   said says say told tell telling label script note notes appointment visit
   by mouth orally oral po iv im sc subq subcutaneous injection inject shot
   inhale inhaler nebulizer topical apply rub skin eye eyes ear ears nose nostril both
   another other same usual regular new old up about around roughly approximately
   should shouldnt must need needs needed want wants supposed got give given
   dont doesnt cant wont didnt isnt arent wasnt havent hasnt couldnt wouldnt
   take takes taking took then and also plus with without on off at in the a an of for to
   every each per day days daily night nightly nights morning mornings evening evenings
   afternoon afternoons noon midday bedtime bed sleep wake waking meal meals food foods
   breakfast lunch dinner supper snack empty stomach water glass full once twice thrice
   one two three four five six seven eight nine ten times time hour hours hrs hr
   week weeks month months year years as needed prn required necessary when
   pain fever headache nausea cough allergy allergies symptoms symptom
   before after during between while until finish finishing finished complete completing
   entire whole course dose doses dosage do dont don not never avoid avoiding skip
   crush chew split break swallow whole drink eat
   grapefruit dairy milk cheese yogurt alcohol beer wine antacid antacids caffeine coffee
   may might can could cause causes causing drowsy drowsiness dizzy dizziness sleepy upset
   is are was were be been being it its this that these those his her their my your
   am pm ac pc qd od bid tid qid qhs hs prn stat
   mg mcg g ml iu unit units tablet tablets tab tabs pill pills capsule capsules cap caps
   drop drops puff puffs spray sprays
   if you they he she we i sure make keep stay right left side effect effects
   all everything them rest remaining medication medications medicine medicines
   meds med drug drugs refill refills bottle bottles pack box strip sheet`
    .split(/\s+/)
    .filter(Boolean)
);

/* Hard delimiters always start a new fragment. The period lookahead keeps
   decimals like "0.5 mg" intact — only sentence-ending periods split. */
const HARD_SPLIT = /\n+|;|\.(?=\s|$)|!|\?|(?:\s+and\s+then\s+)|(?:\s+then\s+)|,/gi;

/* Apostrophes are stripped rather than split, so "don't" reads as one
   known word instead of a stray "t" that looks like a drug name. */
function normalize(text) {
  return (text || '').replace(/[‘’'`]/g, '');
}

/* --------------------------------------------------------------------- */
/* Fragment splitting                                                     */
/* --------------------------------------------------------------------- */

function splitFragments(text) {
  const rough = normalize(text)
    .split(HARD_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);

  // " and " is ambiguous ("with food and water" vs "aspirin and lisinopril"),
  // so only split on it when what follows looks like a fresh medication.
  const expanded = [];
  for (const chunk of rough) {
    const parts = chunk.split(/\s+and\s+/i);
    let buffer = parts[0];
    for (let i = 1; i < parts.length; i++) {
      if (startsNewMedication(parts[i])) {
        expanded.push(buffer);
        buffer = parts[i];
      } else {
        buffer += ' and ' + parts[i];
      }
    }
    expanded.push(buffer);
  }

  // Fragments that don't introduce a medication ("with food", "for 10 days")
  // belong to whatever came before them.
  const merged = [];
  for (const frag of expanded) {
    if (merged.length && !startsNewMedication(frag)) {
      merged[merged.length - 1] += ', ' + frag;
    } else {
      merged.push(frag);
    }
  }
  return merged.filter((f) => f.trim().length > 1);
}

/* A fragment introduces a medication if it contains an unrecognized word
   near the front — that word is almost always the drug name. */
function startsNewMedication(fragment) {
  const tokens = tokenize(fragment);
  if (!tokens.length) return false;
  const lookahead = Math.min(tokens.length, 4);
  for (let i = 0; i < lookahead; i++) {
    const t = tokens[i];
    if (/^\d/.test(t)) continue;
    if (!KNOWN_WORDS.has(t)) return true;
  }
  return false;
}

function tokenize(s) {
  return normalize(s)
    .toLowerCase()
    .replace(/[^a-z0-9.\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/* --------------------------------------------------------------------- */
/* Field extraction                                                       */
/* --------------------------------------------------------------------- */

function extractName(fragment) {
  const cleaned = normalize(fragment);

  // Strongest signal: whatever sits directly in front of the dose.
  // "the blood pressure one lisinopril 10mg" -> Lisinopril, not Blood Pressure.
  const dose = cleaned.match(DOSE_RE);
  if (dose && dose.index > 0) {
    const before = cleaned
      .slice(0, dose.index)
      .replace(/[^A-Za-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const words = [];
    for (let i = before.length - 1; i >= 0; i--) {
      const w = before[i];
      if (/^\d/.test(w) || KNOWN_WORDS.has(w.toLowerCase())) break;
      words.unshift(w);
      if (words.length === 2) break;
    }
    if (words.length) return titleCase(words);
  }

  // No dose written down — fall back to the first unrecognized word.
  const tokens = cleaned
    .replace(/[^A-Za-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const nameWords = [];
  for (const raw of tokens) {
    const t = raw.toLowerCase();
    if (/^\d/.test(t) || isUnitWord(t)) {
      if (nameWords.length) break;
      continue;
    }
    if (KNOWN_WORDS.has(t)) {
      if (nameWords.length) break;
      continue;
    }
    nameWords.push(raw);
    if (nameWords.length === 3) break;
  }

  return nameWords.length ? titleCase(nameWords) : 'Medication';
}

function isUnitWord(t) {
  return /^(mg|mcg|g|ml|iu|units?|tablets?|tabs?|pills?|capsules?|caps?|drops?|puffs?|sprays?)$/.test(
    t
  );
}

function titleCase(words) {
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/* Returns { text, unitKnown }. A number with no unit ("amoxicillin 500")
   is captured but deliberately left unitless — guessing mg on a medication
   is the kind of error worth making the user confirm instead. */
function extractDose(fragment) {
  const cleaned = normalize(fragment);

  const m = cleaned.match(DOSE_RE);
  if (m) return { text: `${m[1]} ${m[2].toLowerCase()}`, unitKnown: true };

  for (const bare of cleaned.matchAll(/([A-Za-z][A-Za-z-]{3,})\s+(\d+(?:\.\d+)?)\b/g)) {
    if (!KNOWN_WORDS.has(bare[1].toLowerCase())) {
      return { text: bare[2], unitKnown: false };
    }
  }
  return { text: '', unitKnown: true };
}

const WORD_NUMBERS = {
  once: 1, one: 1, a: 1,
  twice: 2, two: 2, double: 2,
  thrice: 3, three: 3,
  four: 4, five: 5, six: 6,
};

/* Returns { perDay, intervalHours, anchors[], explicitTimes[], asNeeded } */
function extractFrequency(fragment) {
  const s = normalize(fragment).toLowerCase();
  const out = {
    perDay: null,
    intervalHours: null,
    anchors: [],
    explicitTimes: [],
    asNeeded: /\b(as needed|prn|if needed|when needed|as required)\b/.test(s),
  };

  // Explicit clock times: "at 8am", "at 14:00", "at 8:30 pm"
  const timeRe = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/g;
  let tm;
  while ((tm = timeRe.exec(s)) !== null) {
    let hour = parseInt(tm[1], 10);
    const min = tm[2] ? parseInt(tm[2], 10) : 0;
    const mer = tm[3];
    if (hour > 23) continue;
    if (mer === 'pm' && hour < 12) hour += 12;
    if (mer === 'am' && hour === 12) hour = 0;
    out.explicitTimes.push(fmtTime(hour, min));
  }

  // "every 6 hours"
  const interval = s.match(/\bevery\s+(\d+)\s*(?:hours?|hrs?|h)\b/);
  if (interval) out.intervalHours = parseInt(interval[1], 10);

  // Latin shorthand from prescriptions
  if (/\b(qid)\b/.test(s)) out.perDay = 4;
  else if (/\b(tid)\b/.test(s)) out.perDay = 3;
  else if (/\b(bid)\b/.test(s)) out.perDay = 2;
  else if (/\b(qd|od)\b/.test(s)) out.perDay = 1;
  if (/\b(qhs|hs)\b/.test(s)) out.anchors.push('night');

  // "three times a day", "2x daily", "4 times per day"
  if (out.perDay === null) {
    const nx = s.match(/\b(\d+)\s*x\s*(?:a|per|each)?\s*(?:day|daily)\b/);
    // "three times a day", "3 times daily", "twice per day" — the article
    // is optional because pharmacy labels drop it.
    const words = s.match(
      /\b(once|twice|thrice|one|two|three|four|five|six|\d+)\s*times?\s*(?:a|per|each)?\s*(?:day|daily)\b/
    );
    const articled = s.match(
      /\b(once|twice|thrice|one|two|three|four|five|six|\d+)\s*(?:a|per|each)\s*day\b/
    );
    const dailyWord = s.match(/\b(once|twice|thrice|one|two|three|four|five|six|\d+)\s+daily\b/);
    if (nx) out.perDay = parseInt(nx[1], 10);
    else if (words) out.perDay = numFrom(words[1]);
    else if (articled) out.perDay = numFrom(articled[1]);
    else if (dailyWord) out.perDay = numFrom(dailyWord[1]);
    else if (/\b(daily|every day|each day)\b/.test(s)) out.perDay = 1;
  }

  // Time-of-day anchors
  if (/\b(morning|breakfast|wake|waking|am)\b/.test(s)) out.anchors.push('morning');
  if (/\b(noon|midday|lunch)\b/.test(s)) out.anchors.push('midday');
  if (/\b(evening|dinner|supper)\b/.test(s)) out.anchors.push('evening');
  if (/\b(night|bedtime|before bed|nightly|sleep)\b/.test(s)) out.anchors.push('night');
  out.anchors = [...new Set(out.anchors)];

  // Did we find any real scheduling information at all? Used to reject
  // fragments that are just conversation and not a prescription.
  out.hasSignal =
    out.perDay !== null ||
    out.intervalHours !== null ||
    out.explicitTimes.length > 0 ||
    out.anchors.length > 0 ||
    out.asNeeded;

  return out;
}

function numFrom(word) {
  if (/^\d+$/.test(word)) return parseInt(word, 10);
  return WORD_NUMBERS[word] || 1;
}

const ANCHOR_TIMES = {
  morning: '08:00',
  midday: '12:30',
  evening: '18:00',
  night: '21:30',
};

const EVEN_SPREAD = {
  1: ['09:00'],
  2: ['09:00', '21:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['08:00', '12:00', '16:00', '20:00'],
  5: ['08:00', '11:30', '15:00', '18:30', '22:00'],
  6: ['08:00', '12:00', '16:00', '20:00', '00:00', '04:00'],
};

function buildTimes(freq) {
  if (freq.explicitTimes.length) return dedupeSorted(freq.explicitTimes);

  if (freq.intervalHours) {
    const times = [];
    const step = freq.intervalHours;
    for (let h = 8; h < 8 + 24; h += step) times.push(fmtTime(h % 24, 0));
    return dedupeSorted(times);
  }

  const anchors = freq.anchors;
  const perDay = freq.perDay;

  // Anchors are more specific than a count, so prefer them when they agree.
  if (anchors.length && (perDay === null || anchors.length === perDay)) {
    return dedupeSorted(anchors.map((a) => ANCHOR_TIMES[a]));
  }

  if (perDay && EVEN_SPREAD[perDay]) return EVEN_SPREAD[perDay].slice();
  if (perDay) {
    const times = [];
    const step = Math.floor(16 / perDay) || 1;
    for (let i = 0; i < perDay; i++) times.push(fmtTime((8 + i * step) % 24, 0));
    return dedupeSorted(times);
  }

  if (anchors.length) return dedupeSorted(anchors.map((a) => ANCHOR_TIMES[a]));
  return ['09:00'];
}

function dedupeSorted(list) {
  return [...new Set(list)].sort();
}

function fmtTime(h, m) {
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function extractDuration(fragment) {
  const s = fragment.toLowerCase();
  const m = s.match(
    /\bfor\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(day|week|month)s?\b/
  );
  if (m) {
    const n = numFromWord(m[1]);
    const mult = m[2] === 'week' ? 7 : m[2] === 'month' ? 30 : 1;
    return n * mult;
  }
  if (/\b(ongoing|indefinitely|long term|maintenance|every day forever)\b/.test(s)) return null;
  return null;
}

function numFromWord(w) {
  if (/^\d+$/.test(w)) return parseInt(w, 10);
  const map = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  return map[w] || 1;
}

/* --------------------------------------------------------------------- */
/* Instructions — matched patterns become plain-language guidance          */
/* --------------------------------------------------------------------- */

const INSTRUCTION_RULES = [
  {
    test: /\b(with food|with a meal|with meals|after eating|after food|after a meal|with breakfast|with dinner|with lunch)\b/,
    tag: 'with-food',
    text: 'Take this with food. Have something in your stomach first — even a few crackers helps.',
  },
  {
    test: /\b(empty stomach|before eating|before food|before a meal|before meals|without food)\b/,
    tag: 'empty-stomach',
    text: 'Take this on an empty stomach — about 1 hour before eating or 2 hours after.',
  },
  {
    test: /\b(grapefruit)\b/,
    tag: 'grapefruit',
    text: 'Avoid grapefruit and grapefruit juice while taking this. It can change how much of the medicine reaches your blood.',
  },
  {
    test: /\b(dairy|milk|cheese|yogurt|calcium)\b/,
    tag: 'dairy',
    text: 'Avoid dairy around this dose. Milk, cheese and yogurt can stop it from being absorbed properly.',
  },
  {
    test: /\b(alcohol|beer|wine|drinking)\b/,
    tag: 'alcohol',
    text: 'Do not drink alcohol while taking this.',
  },
  {
    test: /\b(drowsy|drowsiness|sleepy|sedating|do not drive|dont drive)\b/,
    tag: 'drowsy',
    text: 'This can make you drowsy. Do not drive or use machinery until you know how it affects you.',
  },
  {
    test: /\b(full glass|plenty of water|lots of water|with water)\b/,
    tag: 'water',
    text: 'Take with a full glass of water.',
  },
  {
    test: /\b(do not crush|dont crush|do not chew|dont chew|swallow whole|do not split|dont split)\b/,
    tag: 'swallow-whole',
    text: 'Swallow whole. Do not crush, chew or split the tablet.',
  },
  {
    test: /\b(finish|complete|entire course|whole course|full course|all of them)\b/,
    tag: 'finish-course',
    text: 'Finish the entire course even if you feel better early. Stopping short can let the infection come back stronger.',
  },
  {
    test: /\b(as needed|prn|if needed|when needed|as required)\b/,
    tag: 'as-needed',
    text: 'Only take this when you actually need it — not on a fixed schedule.',
  },
];

function extractInstructions(fragment) {
  const s = normalize(fragment).toLowerCase();
  const found = [];
  for (const rule of INSTRUCTION_RULES) {
    if (rule.test.test(s)) found.push({ tag: rule.tag, text: rule.text });
  }
  return found;
}

/* --------------------------------------------------------------------- */
/* Frequency label for display                                            */
/* --------------------------------------------------------------------- */

function frequencyLabel(freq, times) {
  if (freq.asNeeded) {
    return freq.intervalHours
      ? `As needed, up to every ${freq.intervalHours} hours`
      : 'As needed';
  }
  if (freq.intervalHours) return `Every ${freq.intervalHours} hours`;
  const n = times.length;
  if (n === 1) {
    const t = times[0];
    const h = parseInt(t.slice(0, 2), 10);
    if (h < 11) return 'Once daily, morning';
    if (h < 15) return 'Once daily, midday';
    if (h < 20) return 'Once daily, evening';
    return 'Once daily, night';
  }
  if (n === 2) return 'Twice daily';
  if (n === 3) return 'Three times daily';
  if (n === 4) return 'Four times daily';
  return `${n} times daily`;
}

/* --------------------------------------------------------------------- */
/* Public API                                                             */
/* --------------------------------------------------------------------- */

function parseOrders(text) {
  const fragments = splitFragments(text || '');
  const meds = [];

  for (const fragment of fragments) {
    const freq = extractFrequency(fragment);
    const times = buildTimes(freq);
    const name = extractName(fragment);
    const dose = extractDose(fragment);
    const instructions = extractInstructions(fragment);

    // A real order carries a dose, a schedule, or a handling instruction.
    // Without any of the three this is just prose, so drop it.
    if (!dose.text && !freq.hasSignal && !instructions.length) continue;
    if (name === 'Medication' && !dose.text) continue;

    meds.push({
      id: 'm' + Math.random().toString(36).slice(2, 9),
      name,
      dose: dose.text,
      doseUnitUnknown: !dose.unitKnown,
      times,
      frequencyLabel: frequencyLabel(freq, times),
      durationDays: extractDuration(fragment),
      asNeeded: freq.asNeeded,
      instructions,
      raw: fragment.trim(),
      startDate: todayISO(),
    });
  }

  return { meds, flags: buildFlags(meds) };
}

function todayISO() {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/* --------------------------------------------------------------------- */
/* Flags — things worth asking a pharmacist or doctor about                */
/* --------------------------------------------------------------------- */

function buildFlags(meds) {
  const flags = [];

  // Two or more scheduled meds landing on the same clock time.
  const byTime = {};
  for (const med of meds) {
    if (med.asNeeded) continue;
    for (const t of med.times) {
      (byTime[t] = byTime[t] || []).push(med.name);
    }
  }
  for (const [time, names] of Object.entries(byTime)) {
    if (names.length > 1) {
      flags.push({
        level: 'check',
        title: `${names.length} medications at ${prettyTime(time)}`,
        detail: `${names.join(' and ')} are both scheduled for ${prettyTime(
          time
        )}. Worth asking whether they can be taken together or should be spaced apart.`,
      });
    }
  }

  // Conflicting food instructions at the same time.
  const withFood = meds.filter((m) => m.instructions.some((i) => i.tag === 'with-food'));
  const emptyStomach = meds.filter((m) => m.instructions.some((i) => i.tag === 'empty-stomach'));
  for (const a of withFood) {
    for (const b of emptyStomach) {
      const shared = a.times.filter((t) => b.times.includes(t));
      if (shared.length) {
        flags.push({
          level: 'conflict',
          title: `${a.name} and ${b.name} conflict`,
          detail: `${a.name} needs food and ${b.name} needs an empty stomach, but both are set for ${prettyTime(
            shared[0]
          )}. These need to be separated.`,
        });
      }
    }
  }

  // Courses that end, so you know when you're done.
  for (const med of meds) {
    if (med.durationDays) {
      const end = new Date();
      end.setDate(end.getDate() + med.durationDays - 1);
      flags.push({
        level: 'info',
        title: `${med.name} course ends ${end.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })}`,
        detail: `${med.durationDays} days total, ${med.times.length * med.durationDays} doses. ${
          med.instructions.some((i) => i.tag === 'finish-course')
            ? 'Finish all of them.'
            : 'Check whether you need a refill or a follow-up.'
        }`,
      });
    }
  }

  // No duration on anything — common gap in handwritten notes.
  if (meds.length && meds.every((m) => !m.durationDays && !m.asNeeded)) {
    flags.push({
      level: 'info',
      title: 'No end date given',
      detail:
        'None of these have a stated duration. If any of them is a short course, ask how many days it should run for.',
    });
  }

  return flags;
}

function prettyTime(t) {
  const [h, m] = t.split(':').map(Number);
  const mer = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${mer}`;
}

window.DoseParser = { parseOrders, prettyTime, todayISO };
