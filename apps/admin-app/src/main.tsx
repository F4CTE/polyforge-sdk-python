import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { initAnalytics } from './lib/analytics';
import { initSentry } from './lib/sentry';
import './globals.css';

initAnalytics();
initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
