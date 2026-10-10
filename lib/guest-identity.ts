"use client";

export interface GuestProfile {
  id: string;
  name: string;
  color: string;
}

const ANIMALS = [
  "Fox",
  "Owl",
  "Bear",
  "Wolf",
  "Heron",
  "Otter",
  "Lynx",
  "Wren",
  "Badger",
  "Newt",
  "Crane",
  "Mole",
];

const COLORS = [
  "#7c3aed",
  "#2563eb",
  "#059669",
  "#ea580c",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#b45309",
];

const randomId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return Math.random().toString(36).slice(2, 18);
};

/**
 * Stable anonymous identity per share link, kept in this browser only.
 * If the visitor later signs in, the platform profile takes over instead.
 */
export function getOrCreateGuestProfile(token: string): GuestProfile {
  const key = `filebase-guest:${token}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GuestProfile>;
      if (parsed.id && parsed.name && parsed.color) {
        return { id: parsed.id, name: parsed.name, color: parsed.color };
      }
    }
  } catch {
    // corrupted entry — fall through and mint a fresh one
  }
  const id = randomId();
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const profile: GuestProfile = {
    id,
    name: `Guest ${ANIMALS[hash % ANIMALS.length]} ${1000 + (hash % 9000)}`,
    color: COLORS[hash % COLORS.length],
  };
  try {
    localStorage.setItem(key, JSON.stringify(profile));
  } catch {
    // private mode — identity just won't persist
  }
  return profile;
}
