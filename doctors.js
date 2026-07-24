/* DoseNote — symptom-to-specialty mapper + global doctor search.
   Uses browser geolocation, OpenStreetMap Overpass API (worldwide),
   and the US NPI Registry. No API keys needed for any of them. */

const SPECIALTIES = [
  {
    name: 'Cardiologist',
    taxonomy: 'Cardiovascular Disease',
    osm: 'cardiology',
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
    osm: 'dermatology',
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
    osm: 'orthopaedics',
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
    osm: 'gastroenterology',
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
    osm: 'neurology',
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
    osm: 'psychiatry',
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
    osm: 'pulmonology',
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
    osm: 'endocrinology',
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
    osm: 'ophthalmology',
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
    osm: 'otolaryngology',
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
    osm: 'urology',
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
    osm: 'allergology',
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
    osm: 'rheumatology',
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
    osm: 'gynaecology',
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
    osm: 'paediatrics',
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
    osm: 'dentist',
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
    osm: 'general',
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
/* Symptom  ->  Specialty matching                                      */
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
/* Geolocation                                                          */
/* ------------------------------------------------------------------- */

function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        const msgs = {
          1: 'Location permission denied. You can type a city or address instead.',
          2: 'Could not determine your location. Try typing a city or address.',
          3: 'Location request timed out. Try typing a city or address.',
        };
        reject(new Error(msgs[err.code] || 'Location unavailable.'));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

/* ------------------------------------------------------------------- */
/* Nominatim — OpenStreetMap geocoding (free, no key)                    */
/* ------------------------------------------------------------------- */

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OSM_HEADERS = { 'Accept': 'application/json' };

async function reverseGeocode(lat, lon) {
  const url = `${NOMINATIM}/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18`;
  const res = await fetch(url, { headers: OSM_HEADERS });
  if (!res.ok) return null;
  const data = await res.json();
  const addr = data.address || {};
  return {
    city: addr.city || addr.town || addr.village || addr.municipality || addr.county || '',
    state: addr.state || '',
    country: addr.country || '',
    countryCode: (addr.country_code || '').toLowerCase(),
    postcode: addr.postcode || '',
    displayName: buildLocationName(addr),
  };
}

function buildLocationName(addr) {
  const city = addr.city || addr.town || addr.village || addr.municipality || '';
  const state = addr.state || '';
  const country = addr.country || '';
  if (city && state) return `${city}, ${state}`;
  if (city && country) return `${city}, ${country}`;
  if (state && country) return `${state}, ${country}`;
  return country || 'your area';
}

async function geocodeAddress(query) {
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, { headers: OSM_HEADERS });
  if (!res.ok) throw new Error('Could not find that location.');
  const data = await res.json();
  if (!data.length) throw new Error('No results for that location. Try a different city or address.');
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}

/* ------------------------------------------------------------------- */
/* Overpass API — find healthcare providers worldwide (free, no key)     */
/* ------------------------------------------------------------------- */

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function queryOverpass(query) {
  let lastErr;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(mirror, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) { lastErr = new Error(`${res.status} from ${mirror}`); continue; }
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All Overpass mirrors failed');
}

async function searchOverpass(lat, lon, radiusMeters, osmSpecialty) {
  const r = radiusMeters || 8000;

  let specialtyFilter = '';
  if (osmSpecialty && osmSpecialty !== 'general' && osmSpecialty !== 'dentist') {
    specialtyFilter = `["healthcare:speciality"~"${osmSpecialty}",i]`;
  }

  const isDentist = osmSpecialty === 'dentist';

  const query = isDentist
    ? `[out:json][timeout:15];
       (
         nwr["amenity"="dentist"](around:${r},${lat},${lon});
         nwr["healthcare"="dentist"](around:${r},${lat},${lon});
       );
       out center body qt 15;`
    : specialtyFilter
    ? `[out:json][timeout:15];
       (
         nwr["healthcare"="doctor"]${specialtyFilter}(around:${r},${lat},${lon});
         nwr["healthcare"="centre"]${specialtyFilter}(around:${r},${lat},${lon});
         nwr["amenity"="doctors"]${specialtyFilter}(around:${r},${lat},${lon});
         nwr["amenity"="clinic"]${specialtyFilter}(around:${r},${lat},${lon});
         nwr["amenity"="hospital"]${specialtyFilter}(around:${r},${lat},${lon});
       );
       out center body qt 15;`
    : `[out:json][timeout:15];
       (
         nwr["amenity"="doctors"](around:${r},${lat},${lon});
         nwr["amenity"="clinic"](around:${r},${lat},${lon});
         nwr["healthcare"="doctor"](around:${r},${lat},${lon});
         nwr["healthcare"="centre"](around:${r},${lat},${lon});
       );
       out center body qt 20;`;

  const data = await queryOverpass(query);
  const elements = data.elements || [];

  return elements
    .map((el) => formatOSMResult(el, lat, lon))
    .filter((d) => d.name && d.name !== 'Provider')
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 15);
}

function formatOSMResult(el, userLat, userLon) {
  const tags = el.tags || {};
  const elLat = el.lat || (el.center && el.center.lat) || 0;
  const elLon = el.lon || (el.center && el.center.lon) || 0;

  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const city = tags['addr:city'] || tags['addr:town'] || '';
  const state = tags['addr:state'] || '';
  const postcode = tags['addr:postcode'] || '';
  const country = tags['addr:country'] || '';

  const parts = [street, city, [state, postcode].filter(Boolean).join(' '), country]
    .filter((s) => s && s.trim())
    .join(', ');

  const phone = tags.phone || tags['contact:phone'] || '';
  const cleanPhone = phone.replace(/[^0-9+]/g, '');

  const specTags = tags['healthcare:speciality'] || tags['healthcare:specialty'] || '';
  const specList = specTags
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(', ');

  const amenity = tags.amenity || tags.healthcare || '';
  const typeLabel =
    amenity === 'hospital' ? 'Hospital'
    : amenity === 'clinic' ? 'Clinic'
    : amenity === 'dentist' ? 'Dentist'
    : 'Doctor';

  return {
    name: tags.name || '',
    credential: '',
    specialty: specList || typeLabel,
    phone: cleanPhone,
    phoneDisplay: phone,
    address: parts || 'Address not listed',
    website: tags.website || tags['contact:website'] || '',
    lat: elLat,
    lon: elLon,
    distanceKm: haversine(userLat, userLon, elLat, elLon),
  };
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ------------------------------------------------------------------- */
/* NPI Registry — US only (free, no key)                                */
/* ------------------------------------------------------------------- */

const NPI_API = 'https://npiregistry.cms.hhs.gov/api/';

async function searchNPI(taxonomy, zipCode, limit) {
  const zip5 = zipCode.slice(0, 5);
  // Round zips like "10000" come from reverse geocoding at borough/city level.
  // Use a shorter prefix so the wildcard catches neighboring codes.
  const prefix = /00$/.test(zip5) ? zip5.slice(0, 3) : zip5;

  const url = new URL(NPI_API);
  url.searchParams.set('version', '2.1');
  url.searchParams.set('taxonomy_description', taxonomy);
  url.searchParams.set('postal_code', prefix + '*');
  url.searchParams.set('enumeration_type', 'NPI-1');
  url.searchParams.set('limit', String(limit || 10));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('NPI search failed');
  const data = await res.json();
  return (data.results || []).map(formatNPIProvider);
}

function formatNPIProvider(raw) {
  const basic = raw.basic || {};
  const addr =
    (raw.addresses || []).find((a) => a.address_purpose === 'LOCATION') ||
    (raw.addresses || [])[0] ||
    {};
  const tax = (raw.taxonomies || []).find((t) => t.primary) || (raw.taxonomies || [])[0] || {};

  const name = [titleCase(basic.first_name || ''), titleCase(basic.last_name || '')]
    .filter(Boolean)
    .join(' ');

  const credential = basic.credential || '';
  const phone = (addr.telephone_number || '').replace(/[^0-9]/g, '');
  const phoneDisplay =
    phone.length === 10
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
    website: '',
    distanceKm: null,
  };
}

/* ------------------------------------------------------------------- */
/* Unified search — picks the right API based on country                 */
/* ------------------------------------------------------------------- */

async function searchNearby(lat, lon, countryCode, taxonomy, osmSpecialty, postcode) {
  const isUS = countryCode === 'us';

  if (isUS && postcode) {
    try {
      const npiResults = await searchNPI(taxonomy || 'Family Medicine', postcode, 10);
      if (npiResults.length) return { source: 'npi', results: npiResults };
    } catch (e) {
      console.warn('NPI failed, falling back to Overpass', e);
    }
  }

  const results = await searchOverpass(lat, lon, 8000, osmSpecialty || '');

  if (!results.length) {
    const wider = await searchOverpass(lat, lon, 25000, osmSpecialty || '');
    if (wider.length) return { source: 'osm', results: wider, widened: true };
  }

  return { source: 'osm', results };
}

/* ------------------------------------------------------------------- */
/* Helpers                                                               */
/* ------------------------------------------------------------------- */

function titleCase(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function mapsLink(doc) {
  if (doc.lat && doc.lon) {
    return `https://www.google.com/maps/search/?api=1&query=${doc.lat},${doc.lon}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(doc.address)}`;
}

function formatDistance(km) {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

window.DoctorFinder = {
  SPECIALTIES,
  matchSpecialties,
  getUserLocation,
  reverseGeocode,
  geocodeAddress,
  searchNearby,
  searchNPI,
  searchOverpass,
  mapsLink,
  formatDistance,
};
