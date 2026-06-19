export const API_BASE = "http://localhost:3001";

export async function fetchPage() {
  const res = await fetch(`${API_BASE}/page`);
  if (!res.ok) throw new Error("Failed to load page");
  return res.json();
}

export async function savePage(config) {
  const res = await fetch(`${API_BASE}/page`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
  if (!res.ok) throw new Error("Failed to save page");
  return res.json();
}

export async function loadPagePreset(preset) {
  const res = await fetch(`${API_BASE}/page/preset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset }),
  });
  if (!res.ok) throw new Error("Failed to load preset");
  return res.json();
}

export async function uploadAsset(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const res = await fetch(`${API_BASE}/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: btoa(binary), mimeType: file.type }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Upload failed");
  }
  return res.json();
}
