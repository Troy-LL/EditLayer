export const API_BASE = "http://localhost:3001";

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data;
}

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
  return parseJson(res);
}

export async function loadPagePreset(preset) {
  const res = await fetch(`${API_BASE}/page/preset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset }),
  });
  return parseJson(res);
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
  return parseJson(res);
}

export async function fetchSnapshots() {
  const res = await fetch(`${API_BASE}/page/snapshots`);
  return parseJson(res);
}

export async function createSnapshot(name) {
  const res = await fetch(`${API_BASE}/page/snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return parseJson(res);
}

export async function deleteSnapshot(id) {
  const res = await fetch(`${API_BASE}/page/snapshots/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return parseJson(res);
}

export async function restoreSnapshot(id) {
  const res = await fetch(`${API_BASE}/page/snapshots/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  });
  return parseJson(res);
}

export async function fetchAssets() {
  const res = await fetch(`${API_BASE}/assets`);
  return parseJson(res);
}

export async function deleteAsset(filename) {
  const res = await fetch(`${API_BASE}/assets/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
  return parseJson(res);
}
