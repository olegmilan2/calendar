import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAnalytics,
  isSupported
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDvAdWKecvVAui8htUl5SOxWEcAQ7YGLDk',
  authDomain: 'odesa-3712c.firebaseapp.com',
  databaseURL: 'https://odesa-3712c-default-rtdb.firebaseio.com',
  projectId: 'odesa-3712c',
  storageBucket: 'odesa-3712c.firebasestorage.app',
  messagingSenderId: '422605893082',
  appId: '1:422605893082:web:132db8f0d2c19a3d4b64e3',
  measurementId: 'G-C1DNTB0MPR'
};

export const app = initializeApp(firebaseConfig);
export let analytics = null;

(async () => {
  if (await isSupported()) {
    analytics = getAnalytics(app);
  }
})();
