/* DoseNote — symptom-to-specialty mapper + NPI Registry search.
   No API key. The NPI Registry is a free, public US government API. */

const SPECIALTIES = [
  {
    name: 'Cardiologist',
    taxonomy: 'Cardiovascular Disease',
    icon: '❤️',
    desc: 'Heart & blood vessels',
    keywords: [
      'heart', 'chest pain', 'chest', 'palpitation', 'palpitations',
      'blood pressure', 'high blood pressure', 'hypertension', 'cholesterol',
      'cardiac', 'heartbeat', 'irregular heartbeat', 'arrhythmia',
      'shortness of breath', 'swollen legs', 'swollen ankles',
    ],
  },
  {
    name: 'Dermatologist',
    taxonomy: 'Dermatology',
    icon: '\u{1F9B4}',
    desc: 'Skin, hair & nails',
    keywords: [
      'skin', 'rash', 'acne', 'eczema', 'psoriasis', 'mole', 'moles',
      'itchy', 'itching', 'hives', 'dry skin', 'wart', 'warts',
      'hair loss', 'bald', 'balding', 'nail', 'fungus', 'sunburn',
    ],
  },
  {
    name: 'Orthopedic Surgeon',
    taxonomy: 'Orthopaedic Surgery',
    icon: '\u{1F9B7}',
    desc: 'Bones, joints & muscles',
    keywords: [
      'bone', 'bones', 'joint', 'joints', 'back pain', 'back', 'spine',
      'fracture', 'broken bone', 'knee', 'shoulder', 'hip', 'ankle',
      'arthritis', 'sports injury', 'tendon', 'ligament', 'sprain',
      'muscle pain', 'neck pain', 'scoliosis', 'posture',
    ],
  },
  {
    name: 'Gastroenterologist',
    taxonomy: 'Gastroenterology',
    icon: '\u{1F3E5}',
    desc: 'Digestive system',
    keywords: [
      'stomach', 'stomach pain', 'digestive', 'digestion', 'acid reflux',
      'heartburn', 'ibs', 'bowel', 'constipation', 'diarrhea', 'nausea',
      'vomiting', 'bloating', 'bloated', 'ulcer', 'crohns', 'colitis',
      'liver', 'gallbladder', 'abdominal pain', 'abdomen',
    ],
  },
  {
    name: 'Neurologist',
    taxonomy: 'Neurology',
    icon: '\u{1F9E0}',
    desc: 'Brain & nervous system',
    keywords: [
      'headache', 'headaches', 'migraine', 'migraines', 'seizure', 'seizures',
      'epilepsy', 'numbness', 'tingling', 'dizziness', 'dizzy', 'vertigo',
      'tremor', 'tremors', 'memory loss', 'confusion', 'stroke',
      'multiple sclerosis', 'nerve', 'nerve pain', 'neuropathy',
    ],
  },
  {
    name: 'Psychiatrist',
    taxonomy: 'Psychiatry & Neurology',
    icon: '\u{1F9D1}‍⚕️',
    desc: 'Mental health',
    keywords: [
      'anxiety', 'depression', 'depressed', 'mental health', 'stress',
      'panic', 'panic attack', 'mood', 'mood swings', 'bipolar',
      'ocd', 'ptsd', 'insomnia', 'sleep problems', 'eating disorder',
      'adhd', 'attention', 'suicidal', 'self harm', 'trauma',
    ],
  },
  {
    name: 'Pulmonologist',
    taxonomy: 'Pulmonary Disease',
    icon: '\u{1FAC1}',
    desc: 'Lungs & breathing',
    keywords: [
      'breathing', 'breath', 'lung', 'lungs', 'asthma', 'cough', 'coughing',
      'wheezing', 'wheeze', 'bronchitis', 'pneumonia', 'copd',
      'shortness of breath', 'chest tightness', 'sleep apnea', 'snoring',
    ],
  },
  {
    name: 'Endocrinologist',
    taxonomy: 'Endocrinology, Diabetes & Metabolism',
    icon: '⚖️',
    desc: 'Hormones & metabolism',
    keywords: [
      'diabetes', 'diabetic', 'blood sugar', 'insulin', 'thyroid',
      'hormone', 'hormones', 'metabolism', 'weight gain', 'weight loss',
      'fatigue', 'tired', 'pcos', 'adrenal', 'growth',
    ],
  },
  {
    name: 'Ophthalmologist',
    taxonomy: 'Ophthalmology',
    icon: '\u{1F441}️',
    desc: 'Eyes & vision',
    keywords: [
      'eye', 'eyes', 'vision', 'blurry', 'blurry vision', 'blind',
      'glasses', 'contacts', 'glaucoma', 'cataract', 'cataracts',
      'eye pain', 'red eye', 'dry eyes', 'floaters',
    ],
  },
  {
    name: 'ENT Specialist',
    taxonomy: 'Otolaryngology',
    icon: '\u{1F442}',
    desc: 'Ear, nose & throat',
    keywords: [
      'ear', 'ears', 'ear pain', 'earache', 'hearing', 'hearing loss',
      'deaf', 'nose', 'nasal', 'sinus', 'sinusitis', 'throat',
      'sore throat', 'tonsil', 'tonsils', 'voice', 'hoarse',
      'nosebleed', 'congestion', 'stuffed up', 'runny nose',
    ],
  },
  {
    name: 'Urologist',
    taxonomy: 'Urology',
    icon: '\u{1F3E5}',
    desc: 'Urinary & reproductive',
    keywords: [
      'kidney', 'kidneys', 'bladder', 'urinary', 'urination',
      'kidney stone', 'kidney stones', 'uti', 'prostate',
      'incontinence', 'blood in urine', 'frequent urination',
    ],
  },
  {
    name: 'Allergist',
    taxonomy: 'Allergy & Immunology',
    icon: '\u{1F927}',
    desc: 'Allergies & immune system',
    keywords: [
      'allergy', 'allergies', 'allergic', 'hay fever', 'food allergy',
      'peanut', 'shellfish', 'bee sting', 'anaphylaxis', 'swelling',
      'sneezing', 'watery eyes', 'immune', 'immunology',
    ],
  },
  {
    name: 'Rheumatologist',
    taxonomy: 'Rheumatology',
    icon: '\u{1F9B4}',
    desc: 'Autoimmune & joint diseases',
    keywords: [
      'arthritis', 'rheumatoid', 'lupus', 'autoimmune', 'joint swelling',
      'joint stiffness', 'fibromyalgia', 'gout', 'inflammation',
      'swollen joints', 'chronic pain',
    ],
  },
  {
    name: 'OB/GYN',
    taxonomy: 'Obstetrics & Gynecology',
    icon: '\u{1F469}‍⚕️',
    desc: 'Women\'s health',
    keywords: [
      'menstrual', 'period', 'periods', 'pregnancy', 'pregnant',
      'pelvic', 'pelvic pain', 'cramping', 'cramps', 'fertility',
      'ovary', 'ovarian', 'uterus', 'cervical', 'breast',
    ],
  },
  {
    name: 'Pediatrician',
    taxonomy: 'Pediatrics',
    icon: '\u{1F476}',
    desc: 'Children\'s health',
    keywords: [
      'child', 'children', 'baby', 'babies', 'infant', 'kid', 'kids',
      'toddler', 'newborn', 'pediatric', 'vaccination', 'growth',
      'developmental', 'fever child',
    ],
  },
  {
    name: 'Dentist',
    taxonomy: 'Dentist',
    icon: '\u{1F9B7}',
    desc: 'Teeth & oral health',
    keywords: [
      'tooth', 'teeth', 'dental', 'toothache', 'cavity', 'cavities',
      'gum', 'gums', 'bleeding gums', 'wisdom tooth', 'braces',
      'jaw', 'jaw pain', 'mouth', 'oral',
    ],
  },
  {
    name: 'Family Medicine',
    taxonomy: 'Family Medicine',
    icon: '\u{1FA7A}',
    desc: 'General & primary care',
    keywords: [
      'general', 'checkup', 'check up', 'physical', 'fever', 'cold',
      'flu', 'cough', 'sore throat', 'infection', 'sick', 'tired',
      'not feeling well', 'annual', 'routine', 'primary care',
    ],
  },
];

/* ------------------------------------------------------------------- */
/* Symptom  →  Specialty matching                                       */
/* ------------------------------------------------------------------- */

function matchSpecialties(text) {
  if (!text || !text.trim()) return [];

  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const scores = [];

  for (const spec of SPECIALTIES) {
    let score = 0;
    for (const kw of spec.keywords) {
      if (lower.includes(kw)) {
        score += kw.split(/\s+/).length;
      }
    }
    if (score > 0) scores.push({ ...spec, score });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, 3);
}

/* ------------------------------------------------------------------- */
/* NPI Registry search                                                  */
/* ------------------------------------------------------------------- */

const NPI_API = 'https://npiregistry.cms.hhs.gov/api/';

async function searchNPI(taxonomy, zipCode, limit) {
  const url = new URL(NPI_API);
  url.searchParams.set('version', '2.1');
  url.searchParams.set('taxonomy_description', taxonomy);
  url.searchParams.set('postal_code', zipCode.slice(0, 5) + '*');
  url.searchParams.set('enumeration_type', 'NPI-1');
  url.searchParams.set('limit', String(limit || 10));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('NPI search failed');
  const data = await res.json();
  return (data.results || []).map(formatProvider);
}

function formatProvider(raw) {
  const basic = raw.basic || {};
  const addr =
    (raw.addresses || []).find((a) => a.address_purpose === 'LOCATION') ||
    (raw.addresses || [])[0] ||
    {};
  const tax = (raw.taxonomies || []).find((t) => t.primary) || (raw.taxonomies || [])[0] || {};

  const name = [
    titleCase(basic.first_name || ''),
    titleCase(basic.last_name || ''),
  ]
    .filter(Boolean)
    .join(' ');

  const credential = basic.credential || '';

  const phone = (addr.telephone_number || '').replace(/[^0-9]/g, '');
  const phoneDisplay = phone.length === 10
    ? `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`
    : addr.telephone_number || '';

  const street = titleCase(addr.address_1 || '');
  const suite = addr.address_2 ? ', ' + titleCase(addr.address_2) : '';
  const city = titleCase(addr.city || '');
  const state = (addr.state || '').toUpperCase();
  const zip = (addr.postal_code || '').slice(0, 5);
  const fullAddress = [street + suite, `${city}, ${state} ${zip}`]
    .filter((s) => s.trim())
    .join(', ');

  return {
    name: name || 'Provider',
    credential,
    specialty: tax.desc || '',
    phone,
    phoneDisplay,
    address: fullAddress,
    street,
    city,
    state,
    zip,
    npi: raw.number,
  };
}

function titleCase(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function mapsLink(doc) {
  const q = encodeURIComponent(doc.address);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

window.DoctorFinder = {
  SPECIALTIES,
  matchSpecialties,
  searchNPI,
  mapsLink,
};
