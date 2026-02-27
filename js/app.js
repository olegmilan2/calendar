import './firebase.js';
import { initRealtimeSync, state } from './state.js';
import { updateTimers } from './timer.js';
import { renderMonth, renderTabs, renderWeekdays } from './render.js';

const THEME_KEY = 'shift_calendar_theme_v1';
const tabsEl = document.getElementById('tabs');
const monthTitleEl = document.getElementById('monthTitle');
const weekdaysEl = document.getElementById('weekdays');
const gridEl = document.getElementById('grid');
const themeToggleBtn = document.getElementById('themeToggle');

function repaint() {
  renderTabs(tabsEl, repaint);
  renderMonth(monthTitleEl, gridEl);
}

setupTheme();
renderWeekdays(weekdaysEl);
repaint();
initRealtimeSync(repaint);

setInterval(() => {
  updateTimers(gridEl, state.shifts);
}, 1000);

function setupTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const initial = saved === 'dark' ? 'dark' : 'light';
  applyTheme(initial);

  if (!themeToggleBtn) return;
  themeToggleBtn.addEventListener('click', () => {
    const next = (document.body.dataset.theme || 'light') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  document.documentElement.dataset.theme = theme;
  if (themeToggleBtn) {
    themeToggleBtn.textContent = theme === 'dark' ? '🌙' : '💡';
    themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Включить светлую тему' : 'Включить темную тему');
    themeToggleBtn.setAttribute('title', theme === 'dark' ? 'Включить светлую тему' : 'Включить темную тему');
  }
  localStorage.setItem(THEME_KEY, theme);
}
