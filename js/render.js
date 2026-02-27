import { MONTHS, WEEKDAYS } from './constants.js';
import { state, upsertShift } from './state.js';
import { escapeHtml, makeId, pad } from './utils.js';
import { updateTimer, updateTimers } from './timer.js';

export function renderWeekdays(weekdaysEl) {
  weekdaysEl.innerHTML = '';
  for (const name of WEEKDAYS) {
    const el = document.createElement('div');
    el.className = 'weekday';
    el.textContent = name;
    weekdaysEl.appendChild(el);
  }
}

export function renderTabs(tabsEl, onMonthChange) {
  tabsEl.innerHTML = '';

  MONTHS.forEach((month, idx) => {
    const btn = document.createElement('button');
    btn.className = `tab ${idx === state.monthIndex ? 'active' : ''}`;
    btn.textContent = month.name;
    btn.addEventListener('click', () => {
      state.monthIndex = idx;
      onMonthChange();
    });
    tabsEl.appendChild(btn);
  });
}

export function renderMonth(monthTitleEl, gridEl) {
  const year = new Date().getFullYear();
  const month = MONTHS[state.monthIndex];
  monthTitleEl.textContent = `${month.name} ${year}`;
  gridEl.innerHTML = '';

  const first = new Date(year, month.key, 1);
  const lastDay = new Date(year, month.key + 1, 0).getDate();
  const mondayShift = (first.getDay() + 6) % 7;

  for (let i = 0; i < mondayShift; i += 1) {
    const empty = document.createElement('div');
    empty.className = 'day empty';
    gridEl.appendChild(empty);
  }

  for (let day = 1; day <= lastDay; day += 1) {
    gridEl.appendChild(createDayCard(year, month.key, day));
  }

  updateTimers(gridEl, state.shifts);
}

function createDayCard(year, month, day) {
  const id = makeId(year, month, day);
  const data = state.shifts[id] || { name: '', time: '', status: '' };

  const card = document.createElement('div');
  card.className = 'day';
  card.dataset.id = id;

  card.innerHTML = `
    <div class="day-number">${day}</div>
    <div>
      <label>Имя сменщика</label>
      <input type="text" class="name-input" value="${escapeHtml(data.name)}" placeholder="Введите имя" />
    </div>
    <div class="time-panel">
      <label>Время прихода</label>
      <input type="time" class="time-input" value="${escapeHtml(data.time)}" />
    </div>
    <div class="timer" data-timer></div>
    <div class="actions">
      <button class="btn ok" type="button">Пришел</button>
      <button class="btn late" type="button">Опоздал</button>
    </div>
    <div class="status"></div>
  `;

  const nameInput = card.querySelector('.name-input');
  const timeInput = card.querySelector('.time-input');
  const statusEl = card.querySelector('.status');

  const updateShift = () => {
    upsertShift(id, {
      name: nameInput.value.trim(),
      time: timeInput.value
    });
    updateTimer(card, state.shifts);
  };

  nameInput.addEventListener('input', updateShift);
  timeInput.addEventListener('input', updateShift);

  card.querySelector('.btn.ok').addEventListener('click', () => {
    upsertShift(id, {
      status: 'ok',
      statusAt: new Date().toISOString()
    });
    renderStatus(statusEl, state.shifts[id]);
  });

  card.querySelector('.btn.late').addEventListener('click', () => {
    upsertShift(id, {
      status: 'late',
      statusAt: new Date().toISOString()
    });
    renderStatus(statusEl, state.shifts[id]);
  });

  renderStatus(statusEl, data);

  return card;
}

function renderStatus(el, shift) {
  el.className = 'status';

  if (!shift.status) {
    el.textContent = '';
    return;
  }

  const t = shift.statusAt ? new Date(shift.statusAt) : new Date();
  const hm = `${pad(t.getHours())}:${pad(t.getMinutes())}`;

  if (shift.status === 'ok') {
    el.classList.add('ok');
    el.textContent = `Пришел в ${hm}`;
  } else {
    el.classList.add('late');
    el.textContent = `Опоздал (${hm})`;
  }
}
