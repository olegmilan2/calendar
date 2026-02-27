import { STATE_KEY } from './constants.js';

export const state = {
  monthIndex: 0,
  shifts: loadState()
};

export function ensureShift(id) {
  if (!state.shifts[id]) {
    state.shifts[id] = { name: '', time: '', status: '', statusAt: null };
  }
}

export function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state.shifts));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
