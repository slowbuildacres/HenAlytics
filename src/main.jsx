import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import HomesteadApp from './HomesteadApp.jsx';

// Vercel Web Analytics: tracks page views privately (no cookies, no PII).
// Vercel Speed Insights: collects Core Web Vitals from real users so we can
// see how the app actually performs in the wild (LCP, FID, CLS, etc.).
// Both only send data when running on a Vercel deployment — not localhost.
//
// On native (Capacitor), the host is `localhost` or `capacitor://localhost`,
// so these scripts try to send data to a non-existent endpoint and spam the
// console with errors. Detect Capacitor and skip them entirely on native.
const isNative = !!(window.Capacitor?.isNativePlatform?.());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HomesteadApp />
    {!isNative && <Analytics />}
    {!isNative && <SpeedInsights />}
  </React.StrictMode>
);
