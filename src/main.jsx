import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import HomesteadApp from './HomesteadApp.jsx';

// Vercel Web Analytics: tracks page views privately (no cookies, no PII).
// Only sends data when running on a Vercel deployment, not localhost.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HomesteadApp />
    <Analytics />
  </React.StrictMode>
);
