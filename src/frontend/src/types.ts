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
  summary?: string;
  acceptanceCriteria?: string[];
  edgeCases?: string[];
}

export interface UiChange {
  id: string;
  description: string;
  hasBefore: boolean;
  hasAfter: boolean;
  beforeUrl?: string;
  afterUrl?: string;
}

export interface StoryDraft {
  id: string;
  title: string;
  background?: string;
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
  workItemState?: string;
  workItemAssignedTo?: string;
  workItemDescription?: string;
  workItemReproSteps?: string;
  workItemTechnicalDescription?: string;
  workItemDiscussion?: WorkItemComment[];
  linkedWorkItems?: WorkItemInfo[];
  createdAt: string;
  updatedAt: string;
  completionPct: number;
}

export type CoachMessageType = 'user' | 'ai' | 'suggestion' | 'criteria-bundle' | 'ack' | 'quiz';

export interface CoachMessage {
  id: string;
  type: CoachMessageType;
  text: string;
  field?: string;
  value?: string;
  criteria?: AcceptanceCriterion[];
  quiz?: { question: string; options: string[] };
  used?: boolean;
  timestamp: string;
}

export type PushStage = 'review' | 'pushing' | 'done';

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

export type WorkItemLinkType = 'Parent' | 'Child' | 'Related' | 'Predecessor' | 'Successor';

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
