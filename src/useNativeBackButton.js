import { useEffect } from 'react';

/**
 * Handle the Android hardware back button when running natively.
 *
 * Behavior:
 *   - If `onBack` returns true, we've handled it — do nothing else.
 *   - If `onBack` returns false (or no onBack supplied), we exit the app
 *     when on the root view, otherwise we navigate back.
 *
 * No-op on web and iOS.
 */
export function useNativeBackButton(onBack) {
  useEffect(() => {
    const platform = window.Capacitor?.getPlatform?.();
    if (platform !== 'android') return;

    let listener;
    let cancelled = false;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        if (cancelled) return;
        listener = await App.addListener('backButton', ({ canGoBack }) => {
          const handled = onBack ? onBack() : false;
          if (handled) return;
          if (canGoBack) {
            window.history.back();
          } else {
            App.exitApp();
          }
        });
      } catch (e) {
        console.warn('[back-button] failed to attach listener', e);
      }
    })();

    return () => {
      cancelled = true;
      if (listener) listener.remove();
    };
  }, [onBack]);
}