import { formatDuration } from './utils.js';

const TRANSITION_WINDOW_MS = 6 * 60 * 60 * 1000;

export function updateTimers(rootEl, shifts) {
  rootEl.querySelectorAll('.day').forEach((card) => updateTimer(card, shifts));
}

export function updateTimer(card, shifts) {
  if (card.classList.contains('empty')) return;

  const timerEl = card.querySelector('[data-timer]');
  if (!timerEl) return;

  const id = card.dataset.id;
  const shift = shifts[id] || {};
  const shiftTime = shift.time;

  timerEl.className = 'timer compact';
  card.classList.remove('state-ok', 'state-late', 'state-dynamic');
  card.style.removeProperty('--day-bg');
  card.style.removeProperty('--day-border');

  if (!shiftTime) {
    renderTimer(timerEl, 'Нет времени', 'Укажите время прихода');
    if (shift.status === 'ok') {
      card.classList.add('state-ok');
    }
    if (shift.status === 'late') {
      card.classList.add('state-late');
    }
    return;
  }

  const [year, month, day] = id.split('-').map(Number);
  const [hours, minutes] = shiftTime.split(':').map(Number);
  const start = new Date(year, month, day, hours, minutes, 0, 0);
  const diff = start.getTime() - Date.now();

  if (shift.status === 'ok') {
    card.classList.add('state-ok');
    timerEl.classList.add('timer-ok');
    renderTimer(timerEl, 'Пришел вовремя', shiftTime);
    return;
  }

  if (shift.status === 'late') {
    card.classList.add('state-late');
    timerEl.classList.add('started');
    renderTimer(timerEl, 'Опоздал', shiftTime);
    return;
  }

  if (diff > 0) {
    if (diff < 3600000) timerEl.classList.add('warn');
    applyDynamicColor(card, diff);
    renderTimer(timerEl, 'До смены', formatDuration(diff));
  } else {
    timerEl.classList.add('started');
    card.classList.add('state-late');
    renderTimer(timerEl, 'Просрочка', formatDuration(Math.abs(diff)));
  }
}

function renderTimer(timerEl, label, value) {
  timerEl.innerHTML = `
    <span class="timer-label">${label}</span>
    <span class="timer-value">${value}</span>
  `;
}

function applyDynamicColor(card, diff) {
  const ratio = Math.max(0, Math.min(1, 1 - diff / TRANSITION_WINDOW_MS));
  const hue = 120 - Math.round(120 * ratio);
  const borderHue = Math.max(0, hue - 8);
  card.classList.add('state-dynamic');
  card.style.setProperty('--day-bg', `hsl(${hue} 75% 92%)`);
  card.style.setProperty('--day-border', `hsl(${borderHue} 62% 58%)`);
}
