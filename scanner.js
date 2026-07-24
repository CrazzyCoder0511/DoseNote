/* DoseNote — medicine scanner.
   Tesseract.js for OCR (runs entirely in the browser — no image data leaves the device).
   OpenFDA for drug information (free, no API key). */

let tesseractWorker = null;

/* ------------------------------------------------------------------- */
/* Tesseract.js — lazy-loaded OCR                                       */
/* ------------------------------------------------------------------- */

function loadTesseract() {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load OCR engine. Check your connection.'));
    document.head.append(script);
  });
}

async function getWorker() {
  await loadTesseract();
  if (!tesseractWorker) {
    tesseractWorker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          const el = document.getElementById('scan-progress');
          if (el) el.textContent = `Reading label… ${pct}%`;
        }
      },
    });
  }
  return tesseractWorker;
}

async function recognizeImage(imageSource) {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageSource);
  return data.text || '';
}

/* ------------------------------------------------------------------- */
/* Extract medicine name from OCR text                                  */
/* ------------------------------------------------------------------- */

const COMMON_DRUGS = [
  'acetaminophen', 'adderall', 'albuterol', 'alprazolam', 'amoxicillin',
  'amlodipine', 'aspirin', 'atenolol', 'atorvastatin', 'azithromycin',
  'benzonatate', 'buspirone', 'cephalexin', 'cetirizine', 'ciprofloxacin',
  'citalopram', 'clindamycin', 'clonazepam', 'cyclobenzaprine',
  'diazepam', 'diclofenac', 'doxycycline', 'duloxetine', 'escitalopram',
  'famotidine', 'fluconazole', 'fluoxetine', 'furosemide', 'gabapentin',
  'hydrochlorothiazide', 'hydrocodone', 'hydroxyzine', 'ibuprofen',
  'levothyroxine', 'lisinopril', 'loratadine', 'lorazepam', 'losartan',
  'meloxicam', 'metformin', 'metoprolol', 'metronidazole', 'montelukast',
  'naproxen', 'omeprazole', 'ondansetron', 'oxycodone', 'pantoprazole',
  'penicillin', 'prednisone', 'pregabalin', 'propranolol', 'rosuvastatin',
  'sertraline', 'simvastatin', 'sumatriptan', 'tamsulosin', 'tramadol',
  'trazodone', 'valacyclovir', 'venlafaxine', 'warfarin', 'zolpidem',
];

function extractMedicineFromOCR(ocrText) {
  const cleaned = ocrText
    .replace(/[^A-Za-z0-9\s.,;:/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Check for known drug names in the OCR text
  const lower = cleaned.toLowerCase();
  for (const drug of COMMON_DRUGS) {
    if (lower.includes(drug)) {
      const idx = lower.indexOf(drug);
      const raw = cleaned.slice(idx, idx + drug.length);
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
  }

  // 2. Look for a word directly before a dose pattern (e.g. "Amoxicillin 500mg")
  const dosePattern = /\b([A-Za-z][A-Za-z-]{2,})\s+(\d+(?:\.\d+)?)\s*(mg|mcg|ml|g|iu)\b/gi;
  let match;
  while ((match = dosePattern.exec(cleaned)) !== null) {
    const candidate = match[1].toLowerCase();
    if (!isLabelNoise(candidate)) {
      return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    }
  }

  // 3. Fall back to the parser
  const parsed = DoseParser.parseOrders(cleaned);
  if (parsed.meds.length && parsed.meds[0].name !== 'Medication') {
    return parsed.meds[0].name;
  }

  return '';
}

function isLabelNoise(word) {
  const noise = new Set([
    'take', 'tablet', 'tablets', 'capsule', 'capsules', 'oral',
    'refill', 'refills', 'quantity', 'qty', 'discard', 'after',
    'date', 'filled', 'prescribed', 'pharmacy', 'store', 'phone',
    'doctor', 'patient', 'prescription', 'number', 'directions',
    'each', 'every', 'daily', 'twice', 'once', 'times', 'mouth',
    'generic', 'brand', 'mfg', 'manufacturer', 'lot', 'exp',
    'warning', 'caution', 'may', 'cause', 'with', 'food', 'water',
  ]);
  return noise.has(word);
}

/* ------------------------------------------------------------------- */
/* OpenFDA drug lookup (free, no API key)                               */
/* ------------------------------------------------------------------- */

const FDA_API = 'https://api.fda.gov/drug/label.json';

async function lookupDrug(name) {
  const q = encodeURIComponent(name.toLowerCase());
  const url = `${FDA_API}?search=openfda.brand_name:"${q}"+openfda.generic_name:"${q}"&limit=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results || !data.results.length) return null;
    return formatFDAResult(data.results[0], name);
  } catch (e) {
    console.warn('FDA lookup failed:', e);
    return null;
  }
}

function formatFDAResult(label, queryName) {
  const openfda = label.openfda || {};
  const brandNames = openfda.brand_name || [];
  const genericNames = openfda.generic_name || [];

  return {
    brandName: brandNames[0] ? titleCase(brandNames[0]) : '',
    genericName: genericNames[0] ? titleCase(genericNames[0]) : '',
    displayName: brandNames[0]
      ? titleCase(brandNames[0])
      : genericNames[0]
        ? titleCase(genericNames[0])
        : queryName,
    purpose: cleanFDA(label.indications_and_usage || label.purpose),
    sideEffects: cleanFDA(label.adverse_reactions),
    warnings: cleanFDA(label.warnings_and_cautions || label.warnings),
    dosageInfo: cleanFDA(label.dosage_and_administration),
    drugClass: (openfda.pharm_class_epc || []).map(c => c.replace(/\s*\[.*\]/, '')).join(', '),
  };
}

function cleanFDA(arr) {
  if (!arr || !arr.length) return '';
  let text = arr[0]
    .replace(/<[^>]+>/g, ' ')       // strip HTML tags
    .replace(/\s+/g, ' ')           // collapse whitespace
    .replace(/^\d+(\.\d+)?\s+[A-Z ]{2,}[\s:]+/, '') // strip section headers like "1 INDICATIONS AND USAGE"
    .replace(/\[see [^\]]+\]/gi, '') // strip "[see Warnings and Precautions]"
    .trim();

  // Take first 2-3 sentences — FDA text is extremely verbose
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const short = sentences.slice(0, 3).join(' ').trim();
  return short.length > 400 ? short.slice(0, 400) + '…' : short;
}

function titleCase(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/* ------------------------------------------------------------------- */
/* Public API                                                            */
/* ------------------------------------------------------------------- */

window.MedScanner = {
  recognizeImage,
  extractMedicineFromOCR,
  lookupDrug,
};
