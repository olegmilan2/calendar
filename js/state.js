import { onValue, ref, set } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
import { DB_ROOT, LOCAL_CACHE_KEY } from './constants.js';
import { db } from './firebase.js';

export const state = {
  monthIndex: 0,
  shifts: loadCache()
};

export function upsertShift(id, partial) {
  const current = state.shifts[id] || emptyShift();
  state.shifts[id] = { ...current, ...partial };
  saveCache();
  syncShift(id);
}

export function initRealtimeSync(onRemoteChange) {
  const shiftsRef = ref(db, DB_ROOT);

  onValue(
    shiftsRef,
    (snapshot) => {
      const remoteShifts = snapshot.val() || {};
      if (!isSameShifts(state.shifts, remoteShifts)) {
        state.shifts = remoteShifts;
        saveCache();
        onRemoteChange();
      }
    },
    (error) => {
      console.error('Firebase sync error:', error);
    }
  );
}

function syncShift(id) {
  const shiftRef = ref(db, `${DB_ROOT}/${id}`);
  set(shiftRef, state.shifts[id]).catch((error) => {
    console.error(`Failed to save shift ${id}:`, error);
  });
}

function loadCache() {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache() {
  localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(state.shifts));
}

function emptyShift() {
  return { name: '', time: '', status: '', statusAt: null };
}

function isSameShifts(a, b) {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();

  if (aKeys.length !== bKeys.length) return false;

  for (let i = 0; i < aKeys.length; i += 1) {
    if (aKeys[i] !== bKeys[i]) return false;

    const aShift = a[aKeys[i]] || emptyShift();
    const bShift = b[bKeys[i]] || emptyShift();
    if (aShift.name !== bShift.name) return false;
    if (aShift.time !== bShift.time) return false;
    if (aShift.status !== bShift.status) return false;
    if ((aShift.statusAt || null) !== (bShift.statusAt || null)) return false;
  }

  return true;
}
