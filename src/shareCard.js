// ============================================================================
// SHARE CARDS — images for the share sheet + public links that preview on
// Facebook.
// ----------------------------------------------------------------------------
// A photo posted to Facebook can't link anywhere, but a link can: Facebook
// scrapes its Open Graph tags and shows a big preview card. So a share link is
//   1. the card rendered to a JPEG on the device (html2canvas),
//   2. uploaded to the public "share-cards" storage bucket under the user's id,
//   3. a small public.share_cards row holding the numbers on the card,
// and https://henalytics.com/s/<id> (api/share-page.js) serves a page with
// og:image = that JPEG plus "Get Henalytics" buttons.
//
// Only what's on the card is shared. Needs an account (the row and the image
// belong to the user and are deleted with the account). Tables + bucket:
// supabase/migrations/20261104_share_cards.sql.
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase.js';

export const SHARE_BASE = 'https://henalytics.com/s/';

async function loadHtml2Canvas() {
  if (typeof window !== 'undefined' && window.html2canvas) return window.html2canvas;
  const mod = await import('html2canvas');
  return mod.default || mod;
}

// Render a DOM node to a Blob. `width` = output pixel width (height follows
// the node's aspect ratio).
export async function renderNodeToBlob(node, { width = 1080, type = 'image/png', quality = 0.9 } = {}) {
  if (!node) throw new Error('Nothing to render');
  const h2c = await loadHtml2Canvas();
  const rect = node.getBoundingClientRect();
  const scale = rect.width > 0 ? width / rect.width : 3;
  const canvas = await h2c(node, { scale, useCORS: true, backgroundColor: null, logging: false });
  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the image'))), type, quality);
  });
}

export function canShareFiles() {
  try {
    if (typeof navigator === 'undefined' || !navigator.canShare) return false;
    return navigator.canShare({ files: [new File([''], 't.png', { type: 'image/png' })] });
  } catch (_) { return false; }
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Share an image through the phone's share sheet (Facebook, Messages, ...),
// or download it where that isn't available. Returns "shared" | "downloaded"
// | "cancelled".
export async function shareImageBlob(blob, { filename = 'henalytics.png', title, text } = {}) {
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  if (canShareFiles()) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  download(blob, filename);
  return 'downloaded';
}

// Share (or copy) a URL. Returns "shared" | "copied" | "cancelled" | "failed".
export async function shareUrl(url, text) {
  try {
    if (navigator.share) {
      await navigator.share({ url, text });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
  }
  try {
    await navigator.clipboard.writeText(text ? `${text} ${url}` : url);
    return 'copied';
  } catch (_) {
    return 'failed';
  }
}

const ID_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';
function randomId(n = 10) {
  const bytes = new Uint8Array(n);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join('');
}

const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

// card = { kind, title, subtitle, emoji, stats: [{ label, value }] }
// previewNode = a 1200x630-shaped DOM node to render as the Facebook preview.
// Returns the public URL. Throws with a friendly message on failure.
export async function createShareLink(card, previewNode) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Share links aren't available right now.");
  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in (free) to share a link. You can still share the image.');

  const id = randomId();
  const blob = await renderNodeToBlob(previewNode, { width: 1200, type: 'image/jpeg', quality: 0.88 });
  const path = `${user.id}/${id}.jpg`;
  const up = await supabase.storage.from('share-cards').upload(path, blob, {
    contentType: 'image/jpeg', upsert: false, cacheControl: '31536000',
  });
  if (up.error) throw new Error("Couldn't upload the card. Check your connection and try again.");

  const row = {
    id,
    user_id: user.id,
    kind: clip(card.kind || 'stats', 30),
    title: clip(card.title, 120),
    subtitle: clip(card.subtitle, 200),
    emoji: clip(card.emoji, 8),
    stats: (card.stats || []).slice(0, 6).map((s) => ({ label: clip(s.label, 30), value: clip(s.value, 30) })),
    image_path: path,
  };
  const ins = await supabase.from('share_cards').insert(row);
  if (ins.error) {
    try { await supabase.storage.from('share-cards').remove([path]); } catch (_) {}
    throw new Error("Couldn't create the link. Try again in a moment.");
  }
  return SHARE_BASE + id;
}
