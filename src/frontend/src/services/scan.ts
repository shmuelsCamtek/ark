export interface ScanResultPayload {
  summary: string;
  acceptanceCriteria: string[];
  edgeCases: string[];
  mimeType?: string;
}

export async function scanUploadedDoc(
  name: string,
  mimeType: string,
  content: string,
): Promise<ScanResultPayload | null> {
  const upload = await fetch('/api/documents/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType, content }),
  });
  if (!upload.ok) return null;
  const { id } = (await upload.json()) as { id: string };
  const scanRes = await fetch(`/api/documents/${id}/scan`, { method: 'POST' });
  if (!scanRes.ok) return null;
  return (await scanRes.json()) as ScanResultPayload;
}

export async function scanAzureAttachment(
  url: string,
  name: string,
): Promise<ScanResultPayload | null> {
  const res = await fetch('/api/azure/attachments/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, name }),
  });
  if (!res.ok) return null;
  return (await res.json()) as ScanResultPayload;
}
