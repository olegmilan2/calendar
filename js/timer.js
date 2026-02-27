import { formatDuration } from './utils.js';

export function updateTimers(rootEl, shifts) {
  rootEl.querySelectorAll('.day').forEach((card) => updateTimer(card, shifts));
}

export function updateTimer(card, shifts) {
  if (card.classList.contains('empty')) return;

  const timerEl = card.querySelector('[data-timer]');
  const id = card.dataset.id;
  const shift = shifts[id] || {};
  const shiftTime = shift.time;

  timerEl.className = 'timer';

  if (!shiftTime) {
    timerEl.textContent = 'Укажите время прихода';
    return;
  }

  const [year, month, day] = id.split('-').map(Number);
  const [hours, minutes] = shiftTime.split(':').map(Number);
  const start = new Date(year, month, day, hours, minutes, 0, 0);
  const diff = start.getTime() - Date.now();

  if (diff > 0) {
    if (diff < 3600000) timerEl.classList.add('warn');
    timerEl.textContent = `До смены: ${formatDuration(diff)}`;
  } else {
    timerEl.classList.add('started');
    timerEl.textContent = `Смена началась ${formatDuration(Math.abs(diff))} назад`;
  }
}
