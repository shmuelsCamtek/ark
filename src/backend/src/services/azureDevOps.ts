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
    return {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/json-patch+json',
    };
  }

  const token = await getCredential().getToken(AZURE_DEVOPS_SCOPE);
  if (!token) throw new Error('Failed to acquire Azure AD token');
  return {
    Authorization: `Bearer ${token.token}`,
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

  const url = `${ORG_URL}/${PROJECT}/_apis/wit/workitems/${id}?api-version=7.1`;
  const headers = await authHeaders();
  const res = await fetch(url, { headers });
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
  const headers = await authHeaders();
  const res = await fetch(url, {
    method: 'POST',
    headers,
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
