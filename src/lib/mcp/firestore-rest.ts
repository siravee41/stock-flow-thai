// Minimal Firestore REST helpers for public MCP tools.
// Runs on the Worker; uses fetch and the project's public web API key.
const PROJECT_ID = "stock-system-d1250";
const API_KEY = "AIzaSyB6G9cm0EeUkYUuZoDpv1f4koJPZzCmfOI";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

type FSValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
  mapValue?: { fields?: Record<string, FSValue> };
  arrayValue?: { values?: FSValue[] };
};

export function decode(v: FSValue | undefined): unknown {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.nullValue !== undefined) return null;
  if (v.mapValue) return decodeFields(v.mapValue.fields ?? {});
  if (v.arrayValue) return (v.arrayValue.values ?? []).map(decode);
  return null;
}

export function decodeFields(fields: Record<string, FSValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(fields)) out[k] = decode(val);
  return out;
}

export async function listCollection(name: string, pageSize = 100) {
  const url = `${BASE}/${encodeURIComponent(name)}?pageSize=${pageSize}&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    documents?: Array<{ name: string; fields?: Record<string, FSValue> }>;
  };
  return (data.documents ?? []).map((d) => ({
    id: d.name.split("/").pop() ?? "",
    ...decodeFields(d.fields ?? {}),
  }));
}
