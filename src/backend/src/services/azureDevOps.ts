const ORG_URL = process.env.AZURE_DEVOPS_ORG || 'https://dev.azure.com/AzCamtek';
const PROJECT = process.env.AZURE_DEVOPS_PROJECT || 'Falcon';

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function logFetchFailure(label: string, url: string, res: Response): Promise<void> {
  const contentType = res.headers.get('content-type') || '';
  const body = await res.text().catch(() => '');
  const snippet = body.replace(/\s+/g, ' ').slice(0, 200);
  console.error(`[azure] ${label} failed: ${res.status} ${res.statusText} | url=${url} | content-type=${contentType} | body=${snippet}`);
}

export interface FetchedAttachment {
  base64: string;
  mimeType: string;
}

export async function fetchAzureAttachment(url: string, token: string): Promise<FetchedAttachment | null> {
  if (!url.startsWith(ORG_URL)) {
    throw new Error('Attachment URL is outside the configured Azure DevOps organization');
  }
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    console.error('[azure] fetchAzureAttachment failed:', res.status, await res.text().catch(() => ''));
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
  return { base64: buf.toString('base64'), mimeType: contentType || 'application/octet-stream' };
}

export interface WorkItemAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
}

export interface WorkItemComment {
  author: string;
  createdDate: string;
  text: string;
}

export type LinkRelation = 'Parent' | 'Child' | 'Related' | 'Predecessor' | 'Successor';

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
  technicalDescription?: string;
  attachments?: WorkItemAttachment[];
}

export interface WorkItemNode extends WorkItemResult {
  discussion?: WorkItemComment[];
  linkedWorkItems?: WorkItemNode[];
  linkType?: LinkRelation;
}

const TECH_DESC_FIELD_CANDIDATES = [
  'Microsoft.VSTS.TCM.SystemInfo',
  'Microsoft.VSTS.CMMI.SystemInfo',
  'Custom.TechnicalDescription',
];

const LINK_TYPE_MAP: Record<string, LinkRelation> = {
  'System.LinkTypes.Hierarchy-Reverse': 'Parent',
  'System.LinkTypes.Hierarchy-Forward': 'Child',
  'System.LinkTypes.Related': 'Related',
  'System.LinkTypes.Dependency-Reverse': 'Predecessor',
  'System.LinkTypes.Dependency-Forward': 'Successor',
};

const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_MAX_NODES = 50;

type RawWorkItem = {
  id: number;
  fields?: Record<string, unknown>;
  relations?: Array<{ rel?: string; url?: string; attributes?: Record<string, unknown> }>;
};

function parseWorkItem(data: RawWorkItem): WorkItemResult {
  const fields = (data.fields || {}) as Record<string, unknown>;

  const attachments: WorkItemAttachment[] = [];
  for (const rel of data.relations || []) {
    if (rel.rel === 'AttachedFile') {
      const attrs = (rel.attributes || {}) as Record<string, unknown>;
      attachments.push({
        id: String(attrs.id || rel.url?.split('/').pop() || Date.now()),
        name: (attrs.name as string) || 'attachment',
        url: rel.url || '',
        size: (attrs.resourceSize as number) || 0,
      });
    }
  }

  let technicalDescription: string | undefined;
  for (const fieldName of TECH_DESC_FIELD_CANDIDATES) {
    const v = fields[fieldName];
    if (typeof v === 'string' && v.length > 0) {
      technicalDescription = v;
      break;
    }
  }

  const assignedToField = fields['System.AssignedTo'] as { displayName?: string } | string | undefined;
  const assignedTo =
    typeof assignedToField === 'string'
      ? assignedToField
      : assignedToField?.displayName || undefined;

  return {
    id: data.id,
    title: (fields['System.Title'] as string) || '',
    type: (fields['System.WorkItemType'] as string) || '',
    state: (fields['System.State'] as string) || '',
    assignedTo,
    areaPath: fields['System.AreaPath'] as string | undefined,
    iterationPath: fields['System.IterationPath'] as string | undefined,
    description: (fields['System.Description'] as string) || undefined,
    reproSteps: (fields['Microsoft.VSTS.TCM.ReproSteps'] as string) || undefined,
    technicalDescription,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

function extractWorkItemId(url: string | undefined): number | null {
  if (!url) return null;
  const m = url.match(/\/workItems\/(\d+)/i);
  return m ? Number(m[1]) : null;
}

async function fetchWorkItemRaw(id: number, token: string): Promise<RawWorkItem | null> {
  // Try project-scoped first (works when item is in PROJECT), then fall back to org-level.
  const projectUrl = `${ORG_URL}/${PROJECT}/_apis/wit/workitems/${id}?$expand=relations&api-version=7.1`;
  let res = await fetch(projectUrl, { headers: authHeaders(token) });
  if (res.ok) return (await res.json()) as RawWorkItem;
  if (res.status !== 404) {
    await logFetchFailure(`fetchWorkItemRaw ${id} (project)`, projectUrl, res);
    return null;
  }

  const orgUrl = `${ORG_URL}/_apis/wit/workitems/${id}?$expand=relations&api-version=7.1`;
  res = await fetch(orgUrl, { headers: authHeaders(token) });
  if (res.ok) return (await res.json()) as RawWorkItem;
  await logFetchFailure(`fetchWorkItemRaw ${id} (org)`, orgUrl, res);
  return null;
}

async function fetchComments(id: number, token: string): Promise<WorkItemComment[]> {
  const url = `${ORG_URL}/_apis/wit/workItems/${id}/comments?api-version=7.1-preview.4&$top=50&order=desc`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    await logFetchFailure(`fetchComments ${id}`, url, res);
    return [];
  }
  const data = (await res.json()) as {
    comments?: Array<{
      createdBy?: { displayName?: string };
      createdDate?: string;
      text?: string;
    }>;
  };
  return (data.comments || []).map((c) => ({
    author: c.createdBy?.displayName || '',
    createdDate: c.createdDate || '',
    text: c.text || '',
  }));
}

export async function getWorkItem(id: string, token: string): Promise<WorkItemResult | null> {
  const data = await fetchWorkItemRaw(Number(id), token);
  return data ? parseWorkItem(data) : null;
}

export async function getWorkItemGraph(
  rootId: string,
  token: string,
  opts: { maxDepth?: number; maxNodes?: number } = {},
): Promise<WorkItemNode | null> {
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxNodes = opts.maxNodes ?? DEFAULT_MAX_NODES;

  const visited = new Set<number>();
  const nodes = new Map<number, WorkItemNode>();
  const childrenOf = new Map<number, number[]>();

  type QueueItem = { id: number; depth: number; linkType?: LinkRelation };
  const rootIdNum = Number(rootId);
  if (!Number.isFinite(rootIdNum)) return null;

  let currentLevel: QueueItem[] = [{ id: rootIdNum, depth: 0 }];

  while (currentLevel.length > 0 && visited.size < maxNodes) {
    const remaining = maxNodes - visited.size;
    const toProcess: QueueItem[] = [];
    for (const item of currentLevel) {
      if (visited.has(item.id)) continue;
      if (toProcess.length >= remaining) break;
      visited.add(item.id);
      toProcess.push(item);
    }
    if (toProcess.length === 0) break;

    const fetched = await Promise.all(
      toProcess.map(async (item) => {
        const [raw, comments] = await Promise.all([
          fetchWorkItemRaw(item.id, token),
          fetchComments(item.id, token),
        ]);
        return { item, raw, comments };
      }),
    );

    const nextLevel: QueueItem[] = [];
    const enqueued = new Set<number>();
    for (const { item, raw, comments } of fetched) {
      if (!raw) continue;
      const node: WorkItemNode = {
        ...parseWorkItem(raw),
        discussion: comments.length > 0 ? comments : undefined,
        linkType: item.linkType,
      };
      nodes.set(item.id, node);

      if (item.depth >= maxDepth) continue;

      for (const rel of raw.relations || []) {
        const mapped = rel.rel ? LINK_TYPE_MAP[rel.rel] : undefined;
        if (!mapped) continue;
        const linkedId = extractWorkItemId(rel.url);
        if (linkedId == null || visited.has(linkedId)) continue;

        const adj = childrenOf.get(item.id) ?? [];
        if (!adj.includes(linkedId)) {
          adj.push(linkedId);
          childrenOf.set(item.id, adj);
        }
        if (!enqueued.has(linkedId)) {
          enqueued.add(linkedId);
          nextLevel.push({ id: linkedId, depth: item.depth + 1, linkType: mapped });
        }
      }
    }
    currentLevel = nextLevel;
  }

  const rootNode = nodes.get(rootIdNum);
  if (!rootNode) return null;

  const built = new Set<number>();
  function attach(node: WorkItemNode): void {
    if (built.has(node.id)) return;
    built.add(node.id);
    const childIds = childrenOf.get(node.id) ?? [];
    const children: WorkItemNode[] = [];
    for (const cid of childIds) {
      const child = nodes.get(cid);
      if (!child) continue;
      attach(child);
      children.push(child);
    }
    if (children.length > 0) {
      node.linkedWorkItems = children;
    }
  }
  attach(rootNode);

  return rootNode;
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
