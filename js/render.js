import { MONTHS, WEEKDAYS } from './constants.js';
import { state, upsertShift } from './state.js';
import { makeId } from './utils.js';
import { updateTimer, updateTimers } from './timer.js';

let editor = null;
let currentEditId = null;

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
    <div class="day-top">
      <span class="day-number">${day}</span>
      <span class="day-avatar" data-avatar></span>
      <span class="day-badge" data-badge></span>
    </div>
    <div class="day-name" data-name></div>
    <div class="day-time" data-time></div>
    <div class="timer compact" data-timer></div>
  `;

  updateDayCard(card, shift);

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
  const timeEl = card.querySelector('[data-time]');
  const badgeEl = card.querySelector('[data-badge]');
  const avatarEl = card.querySelector('[data-avatar]');
  const name = shift.name || 'Не назначен';

  nameEl.textContent = name;
  timeEl.textContent = shift.time ? `Приход: ${shift.time}` : 'Время не задано';
  renderAvatar(avatarEl, shift.photo, name);

  badgeEl.className = 'day-badge';
  badgeEl.textContent = '';

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
      <label class="editor-label" for="editorPhoto">Фото сменщика</label>
      <div class="editor-photo-row">
        <input id="editorPhoto" class="editor-input editor-file" type="file" accept="image/*" />
        <button type="button" class="editor-remove-photo">Убрать фото</button>
      </div>
      <div class="editor-photo-preview" data-photo-preview></div>
      <label class="editor-label" for="editorTime">Время прихода</label>
      <input id="editorTime" class="editor-input" type="time" />
      <div class="editor-status-title">Статус</div>
      <div class="editor-status-row">
        <button type="button" class="editor-status" data-status="">Без статуса</button>
        <button type="button" class="editor-status" data-status="ok">Пришел</button>
        <button type="button" class="editor-status" data-status="late">Опоздал</button>
      </div>
      <button type="button" class="editor-save">Сохранить</button>
    </div>
  `;

  document.body.appendChild(backdrop);

  const panel = backdrop.querySelector('.editor-panel');
  const dateEl = backdrop.querySelector('[data-date]');
  const nameInput = backdrop.querySelector('#editorName');
  const photoInput = backdrop.querySelector('#editorPhoto');
  const removePhotoBtn = backdrop.querySelector('.editor-remove-photo');
  const photoPreview = backdrop.querySelector('[data-photo-preview]');
  const timeInput = backdrop.querySelector('#editorTime');
  const saveBtn = backdrop.querySelector('.editor-save');
  const statusButtons = Array.from(backdrop.querySelectorAll('.editor-status'));

  editor = {
    backdrop,
    panel,
    dateEl,
    nameInput,
    photoInput,
    removePhotoBtn,
    photoPreview,
    timeInput,
    saveBtn,
    statusButtons,
    selectedStatus: '',
    selectedPhoto: ''
  };

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.hasAttribute('data-close')) {
      closeEditor();
    }
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

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    const photoDataUrl = await readFileAsDataUrl(file);
    editor.selectedPhoto = photoDataUrl;
    renderEditorPhotoPreview();
    photoInput.value = '';
  });

  removePhotoBtn.addEventListener('click', () => {
    editor.selectedPhoto = '';
    renderEditorPhotoPreview();
  });

  saveBtn.addEventListener('click', () => {
    if (!currentEditId) return;

    const prev = state.shifts[currentEditId] || {};
    const nextStatus = editor.selectedStatus;

    upsertShift(currentEditId, {
      name: editor.nameInput.value.trim(),
      photo: editor.selectedPhoto || null,
      time: editor.timeInput.value,
      status: nextStatus,
      statusAt: nextStatus ? (prev.status === nextStatus ? prev.statusAt || new Date().toISOString() : new Date().toISOString()) : null
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
  editor.selectedPhoto = shift.photo || '';
  editor.photoInput.value = '';
  editor.timeInput.value = shift.time || '';
  editor.selectedStatus = shift.status || '';
  renderStatusSelection();
  renderEditorPhotoPreview();

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

function renderEditorPhotoPreview() {
  if (!editor.selectedPhoto) {
    editor.photoPreview.innerHTML = '<span class="editor-photo-empty">Фото не выбрано</span>';
    return;
  }

  editor.photoPreview.innerHTML = `<img src="${editor.selectedPhoto}" alt="Фото сменщика" />`;
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
