import type { CoachMessage, DraftMockup } from '../types';

export interface ManualStatus {
  loaded: boolean;
  chunks: number;
  pages: number;
}

// A picture or document the coach should see, as a base64 content block.
export interface CoachAttachment {
  name: string;
  mimeType: string;
  data: string;            // base64 payload, no "data:" prefix
  kind: 'image' | 'pdf';
}

export interface AiService {
  chat(messages: CoachMessage[], draftContext: string, attachments?: CoachAttachment[]): Promise<CoachMessage>;
  suggestField(field: string, currentValue: string, draftContext: string): Promise<CoachMessage>;
  generateMockup(draftId: string): Promise<DraftMockup>;
  getManualStatus(): Promise<ManualStatus>;
}
