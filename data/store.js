const COLLECTIONS = [
  'config',
  'users',
  'properties',
  'tenants',
  'tenantRequests',
  'documents',
  'documentTypes',
  'rentSchedule',
  'payments',
  'bills',
  'accounts',
  'ledger',
  'bankStatements',
  'issues',
  'contracts',
  'notifications',
  'auditLog'
];

const OVERLAY_KEY = 'landlordDesk.dataOverlay';
const CHANGE_EVENT = 'landlorddesk:store-change';

let baseData;
let loading;

function readOverlay() {
  const rawOverlay = window.localStorage.getItem(OVERLAY_KEY);
  if (!rawOverlay) return {};

  let overlay;
  try {
    overlay = JSON.parse(rawOverlay);
  } catch (error) {
    throw new Error('Saved demo data is not valid JSON. Reset demo data to continue.', { cause: error });
  }

  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
    throw new Error('Saved demo data has an invalid format. Reset demo data to continue.');
  }

  return overlay;
}

function assertCollection(collection) {
  if (!COLLECTIONS.includes(collection)) {
    throw new Error(`Unknown data collection: ${collection}`);
  }
}

function dispatchChange(collection) {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
    detail: { collection }
  }));
}

window.addEventListener('storage', (event) => {
  if (event.key === OVERLAY_KEY || event.key === null) {
    dispatchChange(null);
  }
});

// Replace this JSON fetch layer with the API bootstrap call when a backend is introduced.
export async function loadAll() {
  if (baseData) return getAllCollections();
  if (!loading) {
    loading = Promise.all(COLLECTIONS.map(async (collection) => {
      const url = new URL(`./${collection}.json`, import.meta.url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Could not load ${collection}.json (${response.status} ${response.statusText})`);
      }

      let value;
      try {
        value = await response.json();
      } catch (error) {
        throw new Error(`${collection}.json is not valid JSON.`, { cause: error });
      }

      if (collection !== 'config' && !Array.isArray(value)) {
        throw new Error(`${collection}.json must contain an array.`);
      }

      return [collection, value];
    })).then((entries) => {
      baseData = Object.fromEntries(entries);
    }).catch((error) => {
      loading = undefined;
      throw error;
    });
  }

  await loading;
  return getAllCollections();
}

function getAllCollections() {
  const all = {};
  for (const collection of COLLECTIONS) {
    all[collection] = get(collection);
  }
  return all;
}

// Replace this overlay lookup with the corresponding API read when a backend is introduced.
export function get(collection) {
  assertCollection(collection);
  if (!baseData) {
    throw new Error('Call and await loadAll() before reading a collection.');
  }

  const overlay = readOverlay();
  return Object.hasOwn(overlay, collection)
    ? structuredClone(overlay[collection])
    : structuredClone(baseData[collection]);
}

// Replace this localStorage overlay write with the corresponding API write when a backend is introduced.
export function save(collection, items) {
  assertCollection(collection);
  if (!baseData) {
    throw new Error('Call and await loadAll() before saving a collection.');
  }
  const isConfigObject = collection === 'config'
    && items
    && typeof items === 'object'
    && !Array.isArray(items);
  if (collection === 'config' && !isConfigObject) {
    throw new TypeError('The config collection must be a configuration object.');
  }
  if (collection !== 'config' && !Array.isArray(items)) {
    throw new TypeError(`The ${collection} collection must be an array.`);
  }

  const overlay = readOverlay();
  overlay[collection] = structuredClone(items);
  window.localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay));
  dispatchChange(collection);
  return get(collection);
}

// Replace this overlay removal with the backend's demo-data reset operation when introduced.
export function resetDemo() {
  window.localStorage.removeItem(OVERLAY_KEY);
  dispatchChange(null);
}

export { COLLECTIONS, CHANGE_EVENT };
