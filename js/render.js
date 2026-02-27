import { MONTHS, WEEKDAYS } from './constants.js';
import { state, upsertShift } from './state.js';
import { makeId } from './utils.js';
import { updateTimer, updateTimers } from './timer.js';

let editor = null;
let currentEditId = null;
let quickCrop = null;

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
  ensureEditor();
  ensureQuickCrop();

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
    gridEl.appendChild(createDayCard(year, month, day));
  }

  updateTimers(gridEl, state.shifts);
}

function createDayCard(year, month, day) {
  const id = makeId(year, month.key, day);
  const shift = state.shifts[id] || {};

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'day';
  card.dataset.id = id;

  card.innerHTML = `
    <div class="day-main">
      <span class="day-avatar" data-avatar role="button" tabindex="0" title="Добавить фото"></span>
      <input type="file" class="quick-photo-input" accept="image/*" hidden />
      <div class="day-meta">
        <div class="day-top">
          <span class="day-number">${day}</span>
          <span class="day-badge" data-badge></span>
        </div>
        <div class="day-name" data-name></div>
        <div class="day-note" data-note></div>
        <div class="day-time" data-time></div>
      </div>
    </div>
    <div class="timer compact" data-timer></div>
  `;

  updateDayCard(card, shift);

  const avatarEl = card.querySelector('[data-avatar]');
  const quickPhotoInput = card.querySelector('.quick-photo-input');

  avatarEl.addEventListener('click', (event) => {
    event.stopPropagation();
    quickPhotoInput.click();
  });

  avatarEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    quickPhotoInput.click();
  });

  quickPhotoInput.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  quickPhotoInput.addEventListener('change', async () => {
    const file = quickPhotoInput.files && quickPhotoInput.files[0];
    if (!file) return;
    const photoDataUrl = await readFileAsDataUrl(file);
    await openQuickCrop(id, photoDataUrl);
    quickPhotoInput.value = '';
  });

  card.addEventListener('click', () => {
    openEditor({
      id,
      dateLabel: `${day} ${month.name} ${year}`
    });
  });

  return card;
}

function updateDayCard(card, shift) {
  const nameEl = card.querySelector('[data-name]');
  const noteEl = card.querySelector('[data-note]');
  const timeEl = card.querySelector('[data-time]');
  const badgeEl = card.querySelector('[data-badge]');
  const avatarEl = card.querySelector('[data-avatar]');
  const name = shift.name || 'Не назначен';
  const note = shift.note || '';

  nameEl.textContent = name;
  noteEl.textContent = note || 'Без заметки';
  noteEl.classList.toggle('empty', !note);
  timeEl.textContent = shift.time ? `Приход: ${shift.time}` : 'Время не задано';
  renderAvatar(avatarEl, shift.photo, name);

  badgeEl.className = 'day-badge';
  badgeEl.textContent = '';

  if (!shift.status && (shift.name || shift.time || shift.note || shift.photo)) {
    badgeEl.textContent = 'В пути';
    badgeEl.classList.add('route');
  }

  if (shift.status === 'ok') {
    badgeEl.textContent = 'Пришел';
    badgeEl.classList.add('ok');
  }

  if (shift.status === 'late') {
    badgeEl.textContent = 'Опоздал';
    badgeEl.classList.add('late');
  }
}

function updateDayCardById(id) {
  const card = document.querySelector(`.day[data-id="${id}"]`);
  if (!card) return;

  const shift = state.shifts[id] || {};
  updateDayCard(card, shift);
  updateTimer(card, state.shifts);
}

function ensureEditor() {
  if (editor) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'editor-backdrop';
  backdrop.innerHTML = `
    <div class="editor-panel" role="dialog" aria-modal="true" aria-label="Редактирование смены">
      <div class="editor-head">
        <h2>Редактирование смены</h2>
        <button type="button" class="editor-close" data-close>Закрыть</button>
      </div>
      <div class="editor-date" data-date></div>
      <label class="editor-label" for="editorName">Имя сменщика</label>
      <input id="editorName" class="editor-input" type="text" placeholder="Введите имя" />
      <label class="editor-label" for="editorNote">Заметка</label>
      <input id="editorNote" class="editor-input" type="text" placeholder="Например: ключи у охраны" />
      <label class="editor-label" for="editorTime">Время прихода</label>
      <div class="editor-time">
        <button type="button" class="editor-time-step" data-step="-15">-15м</button>
        <input id="editorTime" class="editor-input editor-time-input" type="time" />
        <button type="button" class="editor-time-step" data-step="15">+15м</button>
      </div>
      <div class="editor-time-presets">
        <button type="button" class="editor-time-preset" data-time="08:00">08:00</button>
        <button type="button" class="editor-time-preset" data-time="09:00">09:00</button>
        <button type="button" class="editor-time-preset" data-time="10:00">10:00</button>
        <button type="button" class="editor-time-preset" data-time="12:00">12:00</button>
        <button type="button" class="editor-time-preset" data-time="18:00">18:00</button>
      </div>
      <div class="editor-status-title">Статус</div>
      <div class="editor-status-row">
        <button type="button" class="editor-status" data-status="">В пути</button>
        <button type="button" class="editor-status" data-status="ok">Пришел</button>
        <button type="button" class="editor-status" data-status="late">Опоздал</button>
      </div>
      <div class="editor-actions">
        <button type="button" class="editor-clear-shift">Очистить смену</button>
        <button type="button" class="editor-save">Сохранить</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const panel = backdrop.querySelector('.editor-panel');
  const closeBtn = backdrop.querySelector('.editor-close');
  const dateEl = backdrop.querySelector('[data-date]');
  const nameInput = backdrop.querySelector('#editorName');
  const noteInput = backdrop.querySelector('#editorNote');
  const timeInput = backdrop.querySelector('#editorTime');
  const timeStepButtons = Array.from(backdrop.querySelectorAll('.editor-time-step'));
  const timePresetButtons = Array.from(backdrop.querySelectorAll('.editor-time-preset'));
  const saveBtn = backdrop.querySelector('.editor-save');
  const clearShiftBtn = backdrop.querySelector('.editor-clear-shift');
  const statusButtons = Array.from(backdrop.querySelectorAll('.editor-status'));

  editor = {
    backdrop,
    panel,
    dateEl,
    nameInput,
    noteInput,
    timeInput,
    timeStepButtons,
    timePresetButtons,
    saveBtn,
    clearShiftBtn,
    statusButtons,
    selectedStatus: ''
  };

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.hasAttribute('data-close')) {
      closeEditor();
    }
  });

  closeBtn.addEventListener('click', () => {
    closeEditor();
  });

  panel.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  statusButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      editor.selectedStatus = btn.dataset.status || '';
      renderStatusSelection();
    });
  });

  timeStepButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = Number(btn.dataset.step || 0);
      editor.timeInput.value = shiftTimeByMinutes(editor.timeInput.value, step);
    });
  });

  timePresetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      editor.timeInput.value = btn.dataset.time || '';
    });
  });

  saveBtn.addEventListener('click', () => {
    if (!currentEditId) return;

    const prev = state.shifts[currentEditId] || {};
    const nextStatus = editor.selectedStatus;

    upsertShift(currentEditId, {
      name: editor.nameInput.value.trim(),
      note: editor.noteInput.value.trim(),
      photo: prev.photo || null,
      time: editor.timeInput.value,
      status: nextStatus,
      statusAt: nextStatus ? (prev.status === nextStatus ? prev.statusAt || new Date().toISOString() : new Date().toISOString()) : null
    });

    updateDayCardById(currentEditId);
    closeEditor();
  });

  clearShiftBtn.addEventListener('click', () => {
    if (!currentEditId) return;

    upsertShift(currentEditId, {
      name: '',
      note: '',
      photo: null,
      time: '',
      status: '',
      statusAt: null
    });

    updateDayCardById(currentEditId);
    closeEditor();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && editor.backdrop.classList.contains('open')) {
      closeEditor();
    }
  });
}

function openEditor({ id, dateLabel }) {
  ensureEditor();

  const shift = state.shifts[id] || {};
  currentEditId = id;
  editor.dateEl.textContent = dateLabel;
  editor.nameInput.value = shift.name || '';
  editor.noteInput.value = shift.note || '';
  editor.timeInput.value = shift.time || '';
  editor.selectedStatus = shift.status || '';
  renderStatusSelection();

  editor.backdrop.classList.add('open');
  editor.nameInput.focus();
}

function closeEditor() {
  if (!editor) return;
  editor.backdrop.classList.remove('open');
  currentEditId = null;
}

function renderStatusSelection() {
  editor.statusButtons.forEach((btn) => {
    const isActive = (btn.dataset.status || '') === editor.selectedStatus;
    btn.classList.toggle('active', isActive);
  });
}

function renderAvatar(el, photo, name) {
  el.classList.remove('has-photo');

  if (photo) {
    el.classList.add('has-photo');
    el.style.backgroundImage = `url("${photo}")`;
    el.textContent = '';
    return;
  }

  el.style.backgroundImage = '';
  el.textContent = getInitials(name);
}

function getInitials(name) {
  if (!name || name === 'Не назначен') return '+';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0].toUpperCase()).join('');
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function shiftTimeByMinutes(timeValue, deltaMinutes) {
  const base = /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeValue) ? timeValue : '09:00';
  const [h, m] = base.split(':').map(Number);
  let total = h * 60 + m + deltaMinutes;
  while (total < 0) total += 1440;
  while (total >= 1440) total -= 1440;
  const nextH = String(Math.floor(total / 60)).padStart(2, '0');
  const nextM = String(total % 60).padStart(2, '0');
  return `${nextH}:${nextM}`;
}

function ensureQuickCrop() {
  if (quickCrop) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'quick-crop-backdrop';
  backdrop.innerHTML = `
    <div class="quick-crop-panel" role="dialog" aria-modal="true" aria-label="Выбор области фото">
      <div class="quick-crop-title">Выберите область фото</div>
      <div class="quick-crop-preview" data-quick-preview></div>
      <label class="editor-label" for="quickCropZoom">Масштаб</label>
      <input id="quickCropZoom" class="editor-range" type="range" min="100" max="300" value="100" />
      <label class="editor-label" for="quickCropX">Сдвиг X</label>
      <input id="quickCropX" class="editor-range" type="range" min="0" max="100" value="50" />
      <label class="editor-label" for="quickCropY">Сдвиг Y</label>
      <input id="quickCropY" class="editor-range" type="range" min="0" max="100" value="50" />
      <div class="quick-crop-actions">
        <button type="button" class="quick-crop-cancel">Отмена</button>
        <button type="button" class="quick-crop-apply">Применить</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const panel = backdrop.querySelector('.quick-crop-panel');
  const preview = backdrop.querySelector('[data-quick-preview]');
  const zoom = backdrop.querySelector('#quickCropZoom');
  const x = backdrop.querySelector('#quickCropX');
  const y = backdrop.querySelector('#quickCropY');
  const cancelBtn = backdrop.querySelector('.quick-crop-cancel');
  const applyBtn = backdrop.querySelector('.quick-crop-apply');

  quickCrop = {
    backdrop,
    panel,
    preview,
    zoom,
    x,
    y,
    cancelBtn,
    applyBtn,
    image: null,
    dayId: null,
    resultPhoto: null
  };

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeQuickCrop();
  });
  panel.addEventListener('click', (event) => event.stopPropagation());
  cancelBtn.addEventListener('click', () => closeQuickCrop());

  [zoom, x, y].forEach((control) => {
    control.addEventListener('input', () => {
      renderQuickCropPreview();
    });
  });

  applyBtn.addEventListener('click', () => {
    if (!quickCrop.dayId || !quickCrop.resultPhoto) {
      closeQuickCrop();
      return;
    }
    upsertShift(quickCrop.dayId, { photo: quickCrop.resultPhoto });
    updateDayCardById(quickCrop.dayId);
    closeQuickCrop();
  });
}

async function openQuickCrop(dayId, dataUrl) {
  ensureQuickCrop();
  quickCrop.dayId = dayId;
  quickCrop.image = await loadImage(dataUrl);
  quickCrop.zoom.value = '100';
  quickCrop.x.value = '50';
  quickCrop.y.value = '50';
  renderQuickCropPreview();
  quickCrop.backdrop.classList.add('open');
}

function closeQuickCrop() {
  if (!quickCrop) return;
  quickCrop.backdrop.classList.remove('open');
  quickCrop.dayId = null;
  quickCrop.image = null;
  quickCrop.resultPhoto = null;
  quickCrop.preview.innerHTML = '';
}

function renderQuickCropPreview() {
  if (!quickCrop || !quickCrop.image) return;

  const canvas = document.createElement('canvas');
  canvas.width = 220;
  canvas.height = 220;

  drawCropWithParams(
    canvas,
    quickCrop.image,
    Number(quickCrop.zoom.value) / 100,
    Number(quickCrop.x.value) / 100,
    Number(quickCrop.y.value) / 100
  );

  quickCrop.resultPhoto = canvas.toDataURL('image/jpeg', 0.9);
  quickCrop.preview.innerHTML = '';
  quickCrop.preview.appendChild(canvas);
}

function drawCropWithParams(canvas, image, zoom, xRatio, yRatio) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const srcW = image.naturalWidth / zoom;
  const srcH = image.naturalHeight / zoom;
  const side = Math.min(srcW, srcH);
  const maxX = Math.max(0, image.naturalWidth - side);
  const maxY = Math.max(0, image.naturalHeight - side);
  const srcX = maxX * xRatio;
  const srcY = maxY * yRatio;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, srcX, srcY, side, side, 0, 0, canvas.width, canvas.height);
}
