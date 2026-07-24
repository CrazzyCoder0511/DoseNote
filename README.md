# MedBuddy

**Paste what your doctor told you. Get a schedule that actually reaches you.**

Built for the **TKS Prompt to Product Challenge** — July 2026.

MedBuddy is a privacy-first medication companion that turns messy doctor's orders into a daily dose schedule with alarms, plain-language instructions, and adherence tracking. No account, no backend, no app store — just open it in your browser and go.

---

## The problem

You leave the doctor's office with a fast verbal explanation, a scribbled note, and a pharmacy label written in Latin abbreviations. Three days later you cannot remember whether the antibiotic was *with food* or *on an empty stomach*, whether you were supposed to avoid grapefruit, or whether you are meant to finish the whole course even though you feel fine.

Roughly half of people taking long-term medication do not take it as prescribed. Most reminder apps assume you have already translated the doctor's instructions into a tidy structured schedule. **That translation step is the actual hard part** — and it is the part MedBuddy does.

---

## What MedBuddy does

| Step | What happens |
|---|---|
| **Capture** | Type, paste, speak, or photograph a pharmacy label |
| **Understand** | A custom parser extracts medications, doses, times, durations, and warnings |
| **Schedule** | Doses are placed on a timeline with conflict checks |
| **Remind** | Full-screen alarms with sound, vibration, and persistent notifications |
| **Track** | Adherence, streaks, and missed-dose patterns — not just what was prescribed, but what you actually took |
| **Share** | One link gives a caregiver a read-only view of the schedule |

---

## Key features

### 1. Understands messy input

Type, paste, or speak whatever you remember — full sentences, fragments, or a raw copy-paste from the pharmacy label.

> *"Doctor said take the amoxicillin 500 three times a day for 10 days with food, and the blood pressure one lisinopril 10mg every morning, don't take it with grapefruit. Also ibuprofen 400mg every 6 hours as needed for the pain, may cause drowsiness."*

That becomes three medications with correct names, doses, times, durations, and warnings — including knowing that *grapefruit* belongs to the lisinopril and not the ibuprofen.

### 2. Scans pharmacy labels

Point your camera at a medicine bottle or box. **Tesseract.js** runs OCR entirely in the browser — the image never leaves your device. MedBuddy extracts the drug name, parses dosing instructions from the label text, and optionally looks up purpose, warnings, and side effects from the **OpenFDA** database.

### 3. Builds the schedule

Times are inferred from frequency ("three times a day" → 8am / 2pm / 8pm), or read directly when you give them ("at 7:30am and at 6pm"). Understands pharmacy shorthand: `bid`, `tid`, `qid`, `qhs`, `PO`, `PRN`.

### 4. Flags what is worth asking about

- Two medications landing at the same time
- A "with food" drug scheduled against an "empty stomach" drug
- A dose written with no unit
- The day a course ends

MedBuddy surfaces these before you save — so you can fix them or confirm with your pharmacist.

### 5. Alarms you — for real

A full-screen takeover with repeating sound, vibration, and a system notification that stays until you tap **Taken** or **Snooze**. A 10-second test alarm lets you verify everything works before you need it.

### 6. Explains how to take it

Every medication gets a plain-language instruction card — not "take PO with food," but *"take this with food; have something in your stomach first, even a few crackers helps."*

### 7. Keeps the record

The **Prescriptions** page separates what you are taking now from what you have finished, and tracks what you *actually* took against what was prescribed:

> *Prednisone — 17 of 20 doses (85%). Missed doses were mostly in the evening.*

Your doctor asks "are you taking it?" at every appointment and most people guess. MedBuddy answers the question — and points at *when* adherence slips, which is the part you can act on.

The **Today** dashboard shows daily progress, active medication count, adherence percentage, and day streak at a glance.

### 8. Shares with a caregiver

One link gives a parent, grandchild, or carer a read-only view of the schedule and what has actually been taken. No account, no server — the schedule is encoded into the link itself (URL fragment, never sent to any server).

### 9. Helps you find care

Describe your symptoms in plain language and MedBuddy recommends the right type of specialist, then searches for real doctors nearby using your location. Works globally via **OpenStreetMap Overpass**; in the US it also queries the **NPI Registry**. Browse by specialty or search by symptom — no API keys required.

---

## How it works

```
Doctor's words / pharmacy label / voice memo
        │
        ▼
  ┌─────────────┐     ┌──────────────┐
  │  NLP Parser │     │  OCR Scanner │
  │  (parser.js)│     │ (scanner.js) │
  └──────┬──────┘     └──────┬───────┘
         │                   │
         └─────────┬─────────┘
                   ▼
          Structured medications
          (name, dose, times, duration, warnings)
                   │
                   ▼
          ┌────────────────┐
          │ Schedule engine │  ← conflict checks, timeline, adherence
          │    (app.js)     │
          └────────┬───────┘
                   │
         ┌─────────┼─────────┐
         ▼         ▼         ▼
     Alarms    Dashboard   Caregiver link
```

Everything runs client-side. Your health data lives in `localStorage` on your own device.

---

## Try it

No build step. No dependencies. No backend.

```bash
python -m http.server 8000
```

Then open **http://localhost:8000** in your browser.

> Notifications, speech input, and the service worker require HTTPS or localhost — they are inactive when opening the file directly from disk.

Install it as a **PWA** (Add to Home Screen) for a standalone app experience with offline caching.

---

## How AI was used

The entire product was designed and built through prompting, in about a day.

The interesting part was not asking for "a medication reminder app" — it was using AI to interrogate the problem. Early prompting established that the reminder was the commodity and the *capture* was the real pain, which redirected the whole build.

From there, prompting drove the hard engineering. The natural-language parser was built by generating a first version, then repeatedly running it against adversarial inputs and feeding the failures back. Real bugs found and fixed this way:

| Input | Bug | Fix |
|---|---|---|
| "Doctor said take the amoxicillin…" | Named the medication *"Doctor Said"* | Anchor the name to the word preceding the dose |
| "the blood pressure one lisinopril 10mg" | Named it *"Blood Pressure"* | Same anchor rule finds *Lisinopril* |
| "don't take it with grapefruit" | Apostrophe split into a phantom drug called *"T"* | Normalize apostrophes before tokenizing |
| "…grapefruit. Also ibuprofen…" | Warning attached to the wrong medication | Treat sentence periods as boundaries (without breaking decimals) |
| "TAKE 1 CAPSULE BY MOUTH" | Invented a medication called *"By Mouth"* | Route vocabulary blocklist |
| "3 TIMES DAILY" | Read as once daily | Frequency regex with optional article |
| "hello how are you doing today" | Produced a medication | Require a dose, schedule, or instruction before accepting |
| "amoxicillin 500" | Silently guessed mg | Capture unitless, flag for confirmation |

That last one is the design principle in miniature: on a health product, an honest *"confirm this"* beats a confident guess.

AI also drove the doctor-finder feature (symptom-to-specialty mapping, geolocation flow), the OCR scanner integration, and the full UI — all iterated through prompt-and-test cycles rather than hand-written from scratch.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vanilla HTML / CSS / JS | Zero build step, runs anywhere, easy to inspect and demo |
| Parser | Custom NLP (`parser.js`) | No LLM API needed — fast, offline, deterministic |
| OCR | Tesseract.js (lazy-loaded) | Runs in-browser; images never uploaded |
| Drug info | OpenFDA API | Free, no API key |
| Doctor search | OSM Overpass + US NPI Registry | Worldwide coverage, no API keys |
| Storage | `localStorage` | No server, no account |
| Offline | Service worker (`sw.js`) | PWA install + cache |
| Sharing | URL fragment encoding | Data stays client-side; fragment never hits servers |

---

## Privacy

There is no server and no account. Everything lives in `localStorage` on your own device. The caregiver link carries data inside the URL fragment, which browsers never send to a server. OCR runs locally — your photos are not uploaded. Nothing about your health leaves your phone unless you choose to send someone a link.

---

## Honest limitations

- **MedBuddy is not medical advice.** It helps you remember what you were already told. It never changes a prescription. Always check against your pharmacy label and ask a pharmacist if something looks wrong.
- **A web app cannot override your phone's silent switch.** That is a native capability, and iOS restricts it even for native apps. MedBuddy is as loud as the web permits: full-screen takeover, looping audio, vibration, and a persistent notification.
- **Background alarms are limited.** Reminders fire reliably while the app is open (installed as a PWA, this works well on Android). True background scheduling needs a push server or a native app.
- **Doctor search quality varies by region.** OpenStreetMap coverage is excellent in cities but sparse in rural areas. The NPI Registry covers US providers only.
- **OCR accuracy depends on label quality.** Blurry photos or unusual fonts may need manual correction — which MedBuddy always lets you do before saving.

---

## Project structure

| File | Purpose |
|---|---|
| `index.html` | App shell — Today, Prescriptions, Add, and Find Care views |
| `styles.css` | Styling, light and dark mode |
| `parser.js` | Natural-language → structured medications |
| `scanner.js` | OCR label scanning + OpenFDA drug lookup |
| `doctors.js` | Symptom-to-specialty mapping + doctor search |
| `app.js` | Schedule engine, alarms, storage, sharing, dashboard |
| `sw.js` | Offline caching for PWA |
| `manifest.json` | PWA install metadata |

---

## License

Built as an entry for the TKS Prompt to Product Challenge, July 2026.
