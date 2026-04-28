import { InteractiveBrowserCredential, type TokenCredential } from '@azure/identity';

const ORG_URL = process.env.AZURE_DEVOPS_ORG || 'https://dev.azure.com/AzCamtek';
const PROJECT = process.env.AZURE_DEVOPS_PROJECT || 'Falcon';
const PAT = process.env.AZURE_DEVOPS_PAT || '';

const AZURE_DEVOPS_SCOPE = '499b84ac-1321-427f-aa17-267ca6975798/.default';
let credential: TokenCredential | null = null;

function getCredential(): TokenCredential {
  if (!credential) {
    credential = new InteractiveBrowserCredential({
      tenantId: process.env.AZURE_TENANT_ID || 'organizations',
    });
  }
  return credential;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (PAT) {
    const encoded = Buffer.from(`:${PAT}`).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }

  const token = await getCredential().getToken(AZURE_DEVOPS_SCOPE);
  if (!token) throw new Error('Failed to acquire Azure AD token');
  return { Authorization: `Bearer ${token.token}` };
}

export interface WorkItemAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
}

export interface WorkItemResult {
  id: number;
  title: string;
  type: string;
  state: string;
  assignedTo?: string;
  areaPath?: string;
  iterationPath?: string;
  attachments?: WorkItemAttachment[];
}

export interface AzureUserProfile {
  id: string;
  displayName: string;
  email: string;
}

export async function getCurrentUser(): Promise<AzureUserProfile | null> {
  const url = `${ORG_URL}/_apis/connectionData?api-version=7.1-preview`;
  console.log('[azure] getCurrentUser: acquiring auth headers...');
  const headers = await authHeaders();
  console.log('[azure] getCurrentUser: fetching', url);
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    console.error('[azure] getCurrentUser failed:', res.status, text);
    return null;
  }

  const data = await res.json();
  const user = data.authenticatedUser;
  return {
    id: user?.id ?? '',
    displayName: user?.providerDisplayName ?? '',
    email: user?.properties?.Account?.$value ?? '',
  };
}

export async function getWorkItem(id: string): Promise<WorkItemResult | null> {

  const url = `${ORG_URL}/${PROJECT}/_apis/wit/workitems/${id}?$expand=relations&api-version=7.1`;
  const headers = await authHeaders();
  const res = await fetch(url, { headers });
  if (!res.ok) return null;

  const data = await res.json();
  const fields = data.fields || {};

  // Extract attachments from relations
  const attachments: WorkItemAttachment[] = [];
  if (data.relations) {
    for (const rel of data.relations) {
      if (rel.rel === 'AttachedFile') {
        const attrs = rel.attributes || {};
        attachments.push({
          id: String(attrs.id || rel.url?.split('/').pop() || Date.now()),
          name: attrs.name || 'attachment',
          url: rel.url || '',
          size: attrs.resourceSize || 0,
        });
      }
    }
  }

  return {
    id: data.id,
    title: fields['System.Title'] || '',
    type: fields['System.WorkItemType'] || '',
    state: fields['System.State'] || '',
    assignedTo: fields['System.AssignedTo']?.displayName || fields['System.AssignedTo'] || undefined,
    areaPath: fields['System.AreaPath'],
    iterationPath: fields['System.IterationPath'],
    attachments: attachments.length > 0 ? attachments : undefined,
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
  const auth = await authHeaders();
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json-patch+json' },
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

export async function searchWorkItems(query: string, top = 15): Promise<WorkItemResult[]> {
  const escaped = query.replace(/'/g, "''");
  const isNumeric = /^\d+$/.test(query);

  let whereClause = `[System.TeamProject] = '${PROJECT}' AND [System.Title] CONTAINS '${escaped}'`;
  if (isNumeric) {
    whereClause = `[System.TeamProject] = '${PROJECT}' AND ([System.Title] CONTAINS '${escaped}' OR [System.Id] = ${query})`;
  }

  const wiql = `SELECT [System.Id] FROM WorkItems WHERE ${whereClause}`;

  const auth = await authHeaders();
  const wiqlUrl = `${ORG_URL}/${PROJECT}/_apis/wit/wiql?api-version=7.1&$top=${top}`;
  const wiqlRes = await fetch(wiqlUrl, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: wiql }),
  });

  if (!wiqlRes.ok) {
    const text = await wiqlRes.text();
    console.error('[azure] searchWorkItems WIQL failed:', wiqlRes.status, text);
    return [];
  }

  const wiqlData = await wiqlRes.json();
  const ids: number[] = (wiqlData.workItems || []).map((wi: { id: number }) => wi.id);
  if (ids.length === 0) return [];

  const fields = 'System.Id,System.Title,System.WorkItemType,System.State,System.AssignedTo,System.AreaPath,System.IterationPath';
  const detailUrl = `${ORG_URL}/${PROJECT}/_apis/wit/workitems?ids=${ids.join(',')}&fields=${fields}&api-version=7.1`;
  const detailRes = await fetch(detailUrl, { headers: auth });

  if (!detailRes.ok) {
    console.error('[azure] searchWorkItems detail fetch failed:', detailRes.status);
    return [];
  }

  const detailData = await detailRes.json();
  return (detailData.value || []).map((item: Record<string, unknown>) => {
    const f = (item.fields || {}) as Record<string, string>;
    return {
      id: item.id as number,
      title: f['System.Title'] || '',
      type: f['System.WorkItemType'] || '',
      state: f['System.State'] || '',
      assignedTo: (f['System.AssignedTo'] as unknown as { displayName?: string })?.displayName || f['System.AssignedTo'] || undefined,
      areaPath: f['System.AreaPath'],
      iterationPath: f['System.IterationPath'],
    };
  });
}
