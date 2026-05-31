export interface AcceptanceCriterion {
  id: string;
  text: string;
  source: 'manual' | 'ai' | 'scan';
}

export interface SupportingDoc {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'other';
  scanned: boolean;
  url?: string;
  mimeType?: string;
  dataUrl?: string;        // base64 data URL of the original file (images/PDFs only) — lets the coach see the actual file, not just its scanned text
  summary?: string;
  problemContext?: string;
  stakeholders?: string[];
  goals?: string[];
  acceptanceCriteria?: string[];
  edgeCases?: string[];
}

// A picture attached to the story (UI screenshot or any reference image).
// Replaces the former Before/After model; legacy drafts are migrated by
// `draftPictures()` in lib/pictures.ts.
export interface UiChange {
  id: string;
  dataUrl: string;        // data:image/...;base64,…
  caption?: string;       // optional free-text label (was the Before/After tag)
  addedAt?: string;
}

export interface DraftMockup {
  status: 'ok' | 'insufficient';
  html?: string;
  insufficientReason?: string;
  generatedAt: string;
}

// 'uiBefore' / 'uiAfter' are retained only so logs saved before the move to a
// flat picture list still render; new picture entries use 'picture'.
export type ContextLogKind = 'doc' | 'workItem' | 'linkedWorkItem' | 'picture' | 'uiBefore' | 'uiAfter' | 'fieldEdit' | 'manual';

export interface ContextLogEntry {
  id: string;
  kind: ContextLogKind;
  label: string;
  summary?: string;
  addedAt: string;
}

export interface StoryDraft {
  id: string;
  title: string;
  background?: string;
  scenario?: string;
  flow?: string;
  persona: string;
  narrative: {
    asA: string;
    iWantTo: string;
    soThat: string;
  };
  acceptanceCriteria: AcceptanceCriterion[];
  supportingDocs: SupportingDoc[];
  uiChanges: UiChange[];
  epicId?: string;
  epicName?: string;
  workItemId?: string;
  workItemType?: string;
  workItemTitle?: string;
  workItemState?: string;
  workItemAssignedTo?: string;
  workItemDescription?: string;
  workItemReproSteps?: string;
  workItemTechnicalDescription?: string;
  workItemDiscussion?: WorkItemComment[];
  linkedWorkItems?: WorkItemInfo[];
  contextLog?: ContextLogEntry[];
  mockup?: DraftMockup;
  createdAt: string;
  updatedAt: string;
  completionPct: number;
}

// Persisted shape of a coach-chat message as rendered in the UI.
// Mirrored on the backend in draftStore.ts (ChatMessage).
export interface SuggestMessage {
  role: 'user' | 'ai';
  text?: string;
  kind?: 'suggestions' | 'criteria-bundle' | 'ack' | 'quiz';
  intro?: string;
  field?: string;
  options?: string[];
  quizQuestion?: string;
  quizAnswered?: boolean;
  quizAnswer?: string;
  bundleResolved?: boolean;
  appliedOptionIndices?: number[];
  // Single-option prompts (one real choice) are silently captured during chat
  // and revealed in a batch when the AC handoff happens.
  autoCaptured?: boolean;
  autoCapturedValue?: string;
  // Marked on the first criteria-bundle once its handoff batch-apply has fired,
  // so reloads don't refire the batch.
  handoffApplied?: boolean;
  // Client-only "control" quizzes whose answers trigger JS directly (no AI
  // round-trip) — used to gate interactive-GUI generation on adding pictures.
  gate?: 'mockup-choose' | 'mockup-ready';
}

export interface CoachMessage {
  id: string;
  type: 'user' | 'ai' | 'suggestion' | 'criteria-bundle' | 'ack' | 'quiz';
  text: string;
  field?: string;
  value?: string;
  criteria?: AcceptanceCriterion[];
  quiz?: { question: string; options: string[] };
  used?: boolean;
  timestamp: string;
  autoCaptured?: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
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

export type WorkItemLinkType = 'Parent' | 'Child' | 'Related' | 'Predecessor' | 'Successor' | 'Duplicate';

export interface WorkItemInfo {
  id: string;
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
  discussion?: WorkItemComment[];
  linkedWorkItems?: WorkItemInfo[];
  linkType?: WorkItemLinkType;
}
