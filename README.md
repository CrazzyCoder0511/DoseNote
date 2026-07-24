# DoseNote

**Paste what your doctor told you. Get a schedule that actually reaches you.**

Built for the TKS Prompt to Product Challenge, July 2026.

---

## The problem

You leave the doctor's office with a fast verbal explanation, a scribbled note,
and a pharmacy label written in Latin abbreviations. Three days later you cannot
remember whether the antibiotic was *with food* or *on an empty stomach*, whether
you were supposed to avoid grapefruit, or whether you are meant to finish the
whole course even though you feel fine.

Roughly half of people taking long-term medication do not take it as prescribed.
Most existing reminder apps assume you have already translated the doctor's
instructions into a tidy structured schedule. **That translation step is the
actual hard part**, and it is the part DoseNote does.

## What it does

1. **Understands messy input.** Type, paste or speak whatever you remember.
   Full sentences, fragments, or a raw copy-paste from the pharmacy label.

   > *"Doctor said take the amoxicillin 500 three times a day for 10 days with
   > food, and the blood pressure one lisinopril 10mg every morning, don't take
   > it with grapefruit. Also ibuprofen 400mg every 6 hours as needed for the
   > pain, may cause drowsiness."*

   becomes three medications with correct names, doses, times, durations and
   warnings — including knowing that *grapefruit* belongs to the lisinopril and
   not the ibuprofen.

2. **Builds the schedule.** Times are inferred from the frequency
   ("three times a day" → 8am / 2pm / 8pm), or read directly when you give them
   ("at 7:30am and at 6pm"). Understands pharmacy shorthand: `bid`, `tid`,
   `qid`, `qhs`, `PO`.

3. **Flags what is worth asking about.** Two medications landing at the same
   time. A "with food" drug scheduled against an "empty stomach" drug. A dose
   written with no unit. The day a course ends.

4. **Alarms you.** A full-screen takeover with repeating sound, vibration and a
   system notification that stays until you tap **Taken** or **Snooze**.

5. **Explains how to take it.** Every medication gets a plain-language card —
   not "take PO with food," but "take this with food; have something in your
   stomach first, even a few crackers helps."

6. **Keeps the record.** The Prescriptions page separates what you are taking
   now from what you have finished, and tracks what you *actually* took against
   what was prescribed — "Prednisone, 17 of 20 doses (85%), missed doses were
   mostly in the evening."

   Your doctor asks "are you taking it?" at every appointment and most people
   guess. This answers the question, and points at *when* adherence slips, which
   is the part you can act on.

7. **Shares with a caregiver.** One link gives a parent, grandchild or carer a
   read-only view of the schedule and what has actually been taken. No account,
   no server — the schedule is encoded into the link itself.

## Honest limitations

- **A web app cannot override your phone's silent switch.** That is a native
  capability, and iOS restricts it even for native apps. DoseNote is as loud as
  the web permits: full-screen takeover, looping audio, vibration, and a
  persistent notification. Overriding the ringer is the first thing a native
  version would add.
- **Background alarms are limited.** Reminders fire reliably while the app is
  open (installed as a PWA, this works well on Android). True background
  scheduling needs a push server or a native app.
- **DoseNote is not medical advice.** It helps you remember what you were
  already told. It never changes a prescription. Always check against your
  pharmacy label and ask a pharmacist if something looks wrong.

## How AI was used

The entire product was designed and built through prompting, in about a day.

The interesting part was not asking for "a medication reminder app" — it was
using AI to interrogate the problem. Early prompting established that the
reminder was the commodity and the *capture* was the real pain, which redirected
the whole build.

From there, prompting drove the hard engineering: the natural-language parser
was built by generating a first version, then repeatedly running it against
adversarial inputs and feeding the failures back. Real bugs found and fixed this
way:

| Input | Bug | Fix |
|---|---|---|
| "Doctor said take the amoxicillin…" | Named the medication *"Doctor Said"* | Anchor the name to the word preceding the dose |
| "the blood pressure one lisinopril 10mg" | Named it *"Blood Pressure"* | Same anchor rule finds *Lisinopril* |
| "don't take it with grapefruit" | Apostrophe split into a phantom drug called *"T"* | Normalize apostrophes before tokenizing |
| "…grapefruit. Also ibuprofen…" | Warning attached to the wrong medication | Treat sentence periods as boundaries (without breaking decimals) |
| "TAKE 1 CAPSULE BY MOUTH" | Invented a medication called *"By Mouth"* | Route vocabulary |
| "3 TIMES DAILY" | Read as once daily | Frequency regex with optional article |
| "hello how are you doing today" | Produced a medication | Require a dose, schedule, or instruction before accepting |
| "amoxicillin 500" | Silently guessed mg | Capture unitless, flag for confirmation |

That last one is the design principle in miniature: on a health product, an
honest *"confirm this"* beats a confident guess.

## Running it

No build step, no dependencies, no backend.

Open `index.html` in a browser, or visit the published link. To develop locally
with the service worker active, serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Notifications, speech input and the service worker require HTTPS or localhost —
they are inactive when opening the file directly from disk.

## Privacy

There is no server and no account. Everything lives in `localStorage` on your
own device. The caregiver link carries the data inside the URL fragment, which
browsers never send to a server. Nothing about your health leaves your phone
unless you choose to send someone a link.

## Files

| File | Purpose |
|---|---|
| `index.html` | Structure and views |
| `styles.css` | Styling, light and dark |
| `parser.js` | Natural-language → structured medications |
| `app.js` | Schedule engine, alarms, storage, sharing |
| `sw.js` | Offline caching |
| `manifest.json` | PWA install metadata |
