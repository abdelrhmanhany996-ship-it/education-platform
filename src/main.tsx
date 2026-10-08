import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// A tab opened before a new deploy asks for code files that no longer exist: reload once to get the new ones
window.addEventListener('vite:preloadError', e => {
  try {
    if (sessionStorage.getItem('lms_reloaded_for_deploy')) return;
    sessionStorage.setItem('lms_reloaded_for_deploy', '1');
  } catch {
    return;
  }
  e.preventDefault();
  window.location.reload();
});
// Loaded fine: allow the same recovery after a later deploy
setTimeout(() => {
  try {
    sessionStorage.removeItem('lms_reloaded_for_deploy');
  } catch {
    /* storage blocked */
  }
}, 15_000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
