const ORG_URL = process.env.AZURE_DEVOPS_ORG || '';
const PROJECT = process.env.AZURE_DEVOPS_PROJECT || '';
const PAT = process.env.AZURE_DEVOPS_PAT || '';

function authHeaders(): Record<string, string> {
  const encoded = Buffer.from(`:${PAT}`).toString('base64');
  return {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/json-patch+json',
  };
}

export interface WorkItemResult {
  id: number;
  title: string;
  type: string;
  state: string;
  areaPath?: string;
  iterationPath?: string;
}

export async function getWorkItem(id: string): Promise<WorkItemResult | null> {
  if (!ORG_URL || !PAT) return null;

  const url = `${ORG_URL}/${PROJECT}/_apis/wit/workitems/${id}?api-version=7.1`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) return null;

  const data = await res.json();
  const fields = data.fields || {};
  return {
    id: data.id,
    title: fields['System.Title'] || '',
    type: fields['System.WorkItemType'] || '',
    state: fields['System.State'] || '',
    areaPath: fields['System.AreaPath'],
    iterationPath: fields['System.IterationPath'],
  };
}

export async function createWorkItem(params: {
  title: string;
  description: string;
  type: string;
  acceptanceCriteria: string;
  parentId?: string;
}): Promise<{ id: number; url: string }> {
  const patchDoc = [
    { op: 'add', path: '/fields/System.Title', value: params.title },
    { op: 'add', path: '/fields/System.Description', value: params.description },
    { op: 'add', path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria', value: params.acceptanceCriteria },
  ];

  const url = `${ORG_URL}/${PROJECT}/_apis/wit/workitems/$${params.type}?api-version=7.1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(patchDoc),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure DevOps API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    url: data._links?.html?.href || `${ORG_URL}/${PROJECT}/_workitems/edit/${data.id}`,
  };
}
