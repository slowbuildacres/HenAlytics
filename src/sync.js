// ============================================================================
// SYNC LAYER
// ----------------------------------------------------------------------------
// When a user is signed in, homestead data lives in Supabase and stays in sync
// across devices. When signed out, data lives in localStorage. This module
// hides that distinction from the rest of the app.
//
// Photos always go to Supabase Storage (only available when signed in).
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase.js';

const STORAGE_KEY = 'homestead_data_v1';

// ============================================================================
// LOCAL STORAGE HELPERS (exported for app to use during sign-in transitions)
// ============================================================================

export function readLocalHomestead() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
}

function writeLocalHomestead(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Local save failed', e);
  }
}

export function clearLocalHomestead() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

// ============================================================================
// CLOUD HELPERS
// ============================================================================

async function readCloudHomestead(userId) {
  const { data, error } = await supabase
    .from('user_homestead')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Cloud read failed', error);
    throw error;
  }
  return data ? data.data : null;
}

async function writeCloudHomestead(userId, data) {
  const { error } = await supabase
    .from('user_homestead')
    .upsert({
      user_id: userId,
      data,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Cloud save failed', error);
    throw error;
  }
}

// ============================================================================
// PUBLIC LOAD / SAVE API
// ============================================================================

// Load homestead data. Returns { source, data }:
//   source = "cloud"        — data came from the user's cloud account
//   source = "cloud-empty"  — user is signed in but has no cloud row yet
//   source = "local"        — signed out, loaded from localStorage
//   data   = the homestead object (null if cloud-empty or no local data)
export async function loadHomestead(user) {
  if (user && isSupabaseConfigured) {
    try {
      const cloud = await readCloudHomestead(user.id);
      if (cloud) {
        // Mirror to local cache for fast loads next time.
        writeLocalHomestead(cloud);
        return { source: 'cloud', data: cloud };
      }
      return { source: 'cloud-empty', data: null };
    } catch (e) {
      // If we can't reach the cloud, fall back to local cache so the app
      // still works. The user might be offline.
      console.warn('Falling back to local cache after cloud read error', e);
      const local = readLocalHomestead();
      return { source: 'local', data: local };
    }
  }
  // Signed out: read from localStorage.
  const local = readLocalHomestead();
  return { source: 'local', data: local };
}

// Save homestead data. If signed in, writes both cloud and local cache.
// If signed out, writes local only.
// Returns { ok, location, error? }.
export async function saveHomestead(user, data) {
  // Always write the local cache (offline buffer for signed-in users).
  writeLocalHomestead(data);

  if (user && isSupabaseConfigured) {
    try {
      await writeCloudHomestead(user.id, data);
      return { ok: true, location: 'cloud' };
    } catch (e) {
      // Cloud failed but local saved — return partial success so UI can show "Error"
      return { ok: false, location: 'local', error: e };
    }
  }
  return { ok: true, location: 'local' };
}

// ============================================================================
// PHOTO UPLOADS
// ============================================================================

// Resize an image to fit within maxDim, encode as JPEG quality 0.85.
// Most phone photos are 4-12MB; this brings them to ~200-500KB.
export async function compressImage(file, maxDim = 1600, quality = 0.85) {
  const img = await fileToImage(file);

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round(height * (maxDim / width));
      width = maxDim;
    } else {
      width = Math.round(width * (maxDim / height));
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
      'image/jpeg',
      quality
    );
  });
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// Upload a photo to Supabase storage. The file path is `userId/entryId-randomId.jpg`,
// matching the RLS policies. Returns the storage path so we can show it later.
export async function uploadPhoto(user, entryId, file) {
  if (!user || !isSupabaseConfigured) {
    throw new Error('You must be signed in to upload photos.');
  }

  const blob = await compressImage(file);
  const random = Math.random().toString(36).slice(2, 8);
  const path = `${user.id}/${entryId}-${random}.jpg`;

  const { error } = await supabase.storage
    .from('photos')
    .upload(path, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
    });

  if (error) {
    console.error('Photo upload failed', error);
    throw error;
  }

  return path;
}

// Generate a temporary signed URL for displaying a photo. Lasts 1 hour.
// Returns null if the photo can't be loaded (e.g., user is signed out).
export async function getPhotoUrl(path) {
  if (!path || !isSupabaseConfigured) return null;
  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(path, 3600);
  if (error) {
    console.warn('Signed URL failed', error);
    return null;
  }
  return data.signedUrl;
}

// Delete a photo from storage. Used when removing an entry that has a photo.
export async function deletePhoto(path) {
  if (!path || !isSupabaseConfigured) return;
  await supabase.storage.from('photos').remove([path]);
}
