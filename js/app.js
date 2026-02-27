import './firebase.js';
import { state } from './state.js';
import { updateTimers } from './timer.js';
import { renderMonth, renderTabs, renderWeekdays } from './render.js';

const tabsEl = document.getElementById('tabs');
const monthTitleEl = document.getElementById('monthTitle');
const weekdaysEl = document.getElementById('weekdays');
const gridEl = document.getElementById('grid');

function repaint() {
  renderTabs(tabsEl, repaint);
  renderMonth(monthTitleEl, gridEl);
}

renderWeekdays(weekdaysEl);
repaint();

setInterval(() => {
  updateTimers(gridEl, state.shifts);
}, 1000);
