// Copyright (c) 2026 PolyForge Labs. All Rights Reserved. See LICENSE for details.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
