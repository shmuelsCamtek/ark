const GRAPH = 'https://graph.microsoft.com/v1.0';

export interface UploadResult {
  id: string;
  name: string;
  webUrl: string;
}

async function graphFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

export async function resolveSiteId(siteUrl: string, token: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(siteUrl);
  } catch {
    throw new Error(`Invalid SharePoint site URL: ${siteUrl}`);
  }
  const path = u.pathname.replace(/\/+$/, '');
  const res = await graphFetch(`${GRAPH}/sites/${u.hostname}:${path}`, token);
  if (!res.ok) {
    throw new Error(`Graph site lookup failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function ensureFolder(siteId: string, folderName: string, token: string): Promise<void> {
  const res = await graphFetch(`${GRAPH}/sites/${siteId}/drive/root/children`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    }),
  });
  if (res.ok || res.status === 409) return;
  throw new Error(`Graph ensureFolder failed: ${res.status} ${await res.text()}`);
}

export async function uploadHtml(
  siteId: string,
  folderName: string,
  filename: string,
  html: string,
  token: string,
): Promise<UploadResult> {
  const encodedFolder = encodeURIComponent(folderName);
  const encodedName = encodeURIComponent(filename);
  const url = `${GRAPH}/sites/${siteId}/drive/root:/${encodedFolder}/${encodedName}:/content?@microsoft.graph.conflictBehavior=replace`;
  const res = await graphFetch(url, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  });
  if (!res.ok) {
    throw new Error(`Graph upload failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string; name: string; webUrl: string };
  return { id: data.id, name: data.name, webUrl: data.webUrl };
}
