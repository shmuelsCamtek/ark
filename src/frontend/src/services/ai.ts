import type { CoachMessage } from '../types';

export interface AiService {
  chat(messages: CoachMessage[], draftContext: string): Promise<CoachMessage>;
  suggestField(field: string, currentValue: string, draftContext: string): Promise<CoachMessage>;
}
