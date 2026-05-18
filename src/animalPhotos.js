// ============================================================================
// ANIMAL PHOTOS — data layer for per-animal profile pics + photo timelines
// ----------------------------------------------------------------------------
// This module is a THIN WRAPPER over the photo helpers that already exist in
// sync.js (uploadPhoto / getPhotoUrl / deletePhoto / compressImage). It adds
// nothing to the storage layer — the Supabase `photos` bucket, compression,
// signed URLs, and per-user path namespacing are all already built and in
// production use for entry photos and the garden map.
//
// What this module adds is the ANIMAL-SHAPED conventions on top:
//   - a stable data shape for an animal's photos
//   - helpers to add / remove / reorder photos on an animal record
//   - the "profile photo" concept (first photo in the list)
//   - timeline ordering (chronological by capture date)
//
// DESIGN NOTES
// ------------
// Storage paths, never image bytes, live in the data blob — identical to how
// entry photos work (entry.photoPaths). An animal's photos are stored as:
//
//   animal.photos = [
//     { path: "<uid>/animal-<id>-<rand>.jpg", date: "YYYY-MM-DD", caption: "" },
//     ...
//   ]
//
// The PROFILE photo is simply photos[0]. "Set as profile" = move to index 0.
// This avoids a second field (profilePhotoPath) that could drift out of sync
// with the array. A helper (profilePhotoOf) reads it back.
//
// The TIMELINE is photos sorted by `date` ascending — that date is when the
// user says the photo was taken (defaults to upload day, editable), which is
// what makes the "watch the animal grow" view meaningful even if photos are
// uploaded out of order or backfilled later.
//
// This module is intentionally framework-agnostic (no React). UI components
// import it; it does not import them. It is safe to ship on its own — nothing
// else references it until the photo UI is wired in a later, verified stage.
// ============================================================================

import { uploadPhoto, getPhotoUrl, deletePhoto } from "./sync.js";

// Local date string (YYYY-MM-DD) in the user's timezone — matches the date
// convention used elsewhere in the app (Goats.jsx todayStr, etc.).
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ----------------------------------------------------------------------------
// READ HELPERS — pure, no side effects. Safe to call in render.
// ----------------------------------------------------------------------------

// Return an animal's photos as a normalized array, newest-data-shape first.
// Tolerates: missing field, null, or a legacy single-string photo path.
// Never throws; always returns an array.
export function photosOf(animal) {
  if (!animal) return [];
  const p = animal.photos;
  if (Array.isArray(p)) {
    // Filter to well-formed entries only — defensive against partial writes.
    return p.filter((x) => x && typeof x.path === "string" && x.path);
  }
  // Legacy / defensive: a bare string path.
  if (typeof p === "string" && p) {
    return [{ path: p, date: animal.photoDate || todayStr(), caption: "" }];
  }
  return [];
}

// The profile photo object (or null). Profile photo === first in the list.
export function profilePhotoOf(animal) {
  const list = photosOf(animal);
  return list.length > 0 ? list[0] : null;
}

// The animal's photos in TIMELINE order: chronological by capture date,
// oldest first, so a UI can render "how the animal changed over time".
// Photos with no/!invalid date sort to the end (treated as unknown-latest).
export function timelineOf(animal) {
  const list = photosOf(animal).slice();
  list.sort((a, b) => {
    const da = a.date || "";
    const db = b.date || "";
    if (da && db) return da.localeCompare(db);
    if (da) return -1;
    if (db) return 1;
    return 0;
  });
  return list;
}

// Does this animal have at least one photo?
export function hasPhotos(animal) {
  return photosOf(animal).length > 0;
}

// ----------------------------------------------------------------------------
// WRITE HELPERS — these return a NEW photos array; they never mutate the
// animal in place. Callers splice the result into their update(d => ...) call.
// Keeping these pure makes them trivial to unit-test and avoids surprising
// the app's immutable-ish update pattern.
// ----------------------------------------------------------------------------

// Append a photo (by storage path) to an animal's photo list.
// `date` defaults to today; `caption` optional. Returns the new array.
export function withPhotoAdded(animal, path, date, caption) {
  const list = photosOf(animal);
  return [
    ...list,
    { path, date: date || todayStr(), caption: caption || "" },
  ];
}

// Remove the photo at `path`. Returns the new array. (The actual storage
// deletion is a separate call — see removePhotoFromAnimal below — because
// the data update and the storage delete have different failure modes and
// shouldn't be entangled.)
export function withPhotoRemoved(animal, path) {
  return photosOf(animal).filter((p) => p.path !== path);
}

// Promote the photo at `path` to profile (index 0). Returns the new array.
export function withProfileSet(animal, path) {
  const list = photosOf(animal);
  const target = list.find((p) => p.path === path);
  if (!target) return list;
  return [target, ...list.filter((p) => p.path !== path)];
}

// Edit a photo's date and/or caption. Returns the new array.
export function withPhotoEdited(animal, path, changes) {
  return photosOf(animal).map((p) =>
    p.path === path ? { ...p, ...changes } : p
  );
}

// ----------------------------------------------------------------------------
// ASYNC OPERATIONS — these talk to Supabase Storage via the sync.js helpers.
// Each is wrapped so callers get a predictable { ok, ... } result rather than
// a thrown error, EXCEPT uploadAnimalPhoto which rethrows (the caller needs
// to know upload failed so it doesn't write a dangling path into the record).
// ----------------------------------------------------------------------------

// Upload a File/Blob for an animal and return its storage path.
// `user` is the Supabase auth user (required — uploads are per-user).
// `animalId` namespaces the path so an animal's photos are grouped.
//
// IMPORTANT for the integration stage: this RETHROWS on failure. The caller
// must await it inside try/catch and must NOT add the photo to the animal
// record unless this resolves — otherwise the record points at a path that
// was never stored. (This is the failure mode to watch given the known
// refresh-token bug: if auth is silently dead, the upload throws, and the
// caller should surface that to the user rather than swallow it.)
export async function uploadAnimalPhoto(user, animalId, file) {
  if (!user) throw new Error("You must be signed in to add animal photos.");
  if (!file) throw new Error("No photo selected.");
  // sync.js uploadPhoto signature is (user, entryId, file); the second arg is
  // just a path-prefixing key, so we pass an animal-scoped key.
  const path = await uploadPhoto(user, `animal-${animalId}`, file);
  return path;
}

// Resolve a storage path to a displayable (signed, 24h) URL. Returns null on
// failure rather than throwing — a broken image is a soft failure in the UI.
export async function resolveAnimalPhotoUrl(path) {
  if (!path) return null;
  try {
    return await getPhotoUrl(path);
  } catch (e) {
    return null;
  }
}

// Delete a photo from storage. Soft-fails (logs, returns {ok:false}) — a
// failed storage delete should not block the data update that removes the
// photo from the animal record. Worst case is an orphaned file in the bucket,
// which is harmless and can be swept later; a thrown error here would be worse.
export async function removeAnimalPhotoFromStorage(path) {
  if (!path) return { ok: true };
  try {
    await deletePhoto(path);
    return { ok: true };
  } catch (e) {
    console.warn("Animal photo storage delete failed (orphaned file left):", e);
    return { ok: false, error: e };
  }
}

// ----------------------------------------------------------------------------
// CONVENIENCE: full add / remove flows that combine storage + the pure data
// helper, for callers that have an `update(d => ...)` function. These are the
// functions the photo UI will most likely call directly.
// ----------------------------------------------------------------------------

// Upload a file and append it to an animal inside one update() call.
// `findAnimal(d)` must return the live animal object within the draft `d`.
// Throws if the upload fails (see uploadAnimalPhoto) — caller handles UX.
export async function addPhotoToAnimal({ user, animalId, file, date, caption, update, findAnimal }) {
  const path = await uploadAnimalPhoto(user, animalId, file);
  update((d) => {
    const animal = findAnimal(d);
    if (animal) animal.photos = withPhotoAdded(animal, path, date, caption);
    return d;
  });
  return path;
}

// Remove a photo from an animal: updates the record first (so the UI reflects
// it immediately), then attempts the storage delete (soft-fail).
export async function removePhotoFromAnimal({ path, update, findAnimal }) {
  update((d) => {
    const animal = findAnimal(d);
    if (animal) animal.photos = withPhotoRemoved(animal, path);
    return d;
  });
  return removeAnimalPhotoFromStorage(path);
}
