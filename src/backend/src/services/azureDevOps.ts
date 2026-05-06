const ORG_URL = process.env.AZURE_DEVOPS_ORG || 'https://dev.azure.com/AzCamtek';
const PROJECT = process.env.AZURE_DEVOPS_PROJECT || 'Falcon';

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
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
  description?: string;
  reproSteps?: string;
  attachments?: WorkItemAttachment[];
}

export async function getWorkItem(id: string, token: string): Promise<WorkItemResult | null> {
  const url = `${ORG_URL}/${PROJECT}/_apis/wit/workitems/${id}?$expand=relations&api-version=7.1`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) return null;

  const data = await res.json();
  const fields = data.fields || {};

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
    description: fields['System.Description'] || undefined,
    reproSteps: fields['Microsoft.VSTS.TCM.ReproSteps'] || undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

export async function createWorkItem(
  params: {
    title: string;
    description: string;
    type: string;
    acceptanceCriteria: string;
    parentId?: string;
  },
  token: string,
): Promise<{ id: number; url: string }> {
  const patchDoc = [
    { op: 'add', path: '/fields/System.Title', value: params.title },
    { op: 'add', path: '/fields/System.Description', value: params.description },
    { op: 'add', path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria', value: params.acceptanceCriteria },
  ];

  const url = `${ORG_URL}/${PROJECT}/_apis/wit/workitems/$${params.type}?api-version=7.1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json-patch+json' },
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

export async function searchWorkItems(query: string, token: string, top = 15): Promise<WorkItemResult[]> {
  const escaped = query.replace(/'/g, "''");
  const isNumeric = /^\d+$/.test(query);

  let whereClause = `[System.TeamProject] = '${PROJECT}' AND [System.Title] CONTAINS '${escaped}'`;
  if (isNumeric) {
    whereClause = `[System.TeamProject] = '${PROJECT}' AND ([System.Title] CONTAINS '${escaped}' OR [System.Id] = ${query})`;
  }

  const wiql = `SELECT [System.Id] FROM WorkItems WHERE ${whereClause}`;

  const wiqlUrl = `${ORG_URL}/${PROJECT}/_apis/wit/wiql?api-version=7.1&$top=${top}`;
  const wiqlRes = await fetch(wiqlUrl, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
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
  const detailRes = await fetch(detailUrl, { headers: authHeaders(token) });

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
