import type { CoachMessage, AcceptanceCriterion } from '../types';

export interface AiService {
  chat(messages: CoachMessage[], draftContext: string): Promise<CoachMessage>;
  suggestField(field: string, currentValue: string, draftContext: string): Promise<CoachMessage>;
}

let nextId = 1;
function msgId() {
  return `ai-${nextId++}`;
}

const PERSONA_SUGGESTIONS = [
  'Operations Manager who oversees daily pipeline throughput',
  'Support Lead triaging incoming customer tickets',
  'Product Manager planning next quarter\'s roadmap',
  'QA Engineer validating regression test suites',
  'DevOps Engineer monitoring deployment pipelines',
  'Data Analyst building executive dashboards',
];

const AC_SUGGESTIONS: AcceptanceCriterion[] = [
  { id: 'ac-s1', text: 'Given the user is logged in, when they click "Submit", then the form data is saved', source: 'ai' },
  { id: 'ac-s2', text: 'Given invalid input, when the user submits, then an error message is displayed', source: 'ai' },
  { id: 'ac-s3', text: 'Given the operation succeeds, when the user returns to the list, then the new item appears', source: 'ai' },
];

export class MockAiService implements AiService {
  async chat(_messages: CoachMessage[], _draftContext: string): Promise<CoachMessage> {
    await delay(800 + Math.random() * 600);
    const responses = [
      'That sounds like a solid approach. Have you considered edge cases around error handling?',
      'Great start! I\'d suggest adding acceptance criteria around the unhappy path — what happens when things go wrong?',
      'This narrative is clear. One thing to consider: who else is affected by this change besides the primary persona?',
      'I can help refine that. Try being more specific about the measurable outcome in your "so that" clause.',
    ];
    return {
      id: msgId(),
      type: 'ai',
      text: responses[Math.floor(Math.random() * responses.length)],
      timestamp: new Date().toISOString(),
    };
  }

  async suggestField(field: string, _currentValue: string, _draftContext: string): Promise<CoachMessage> {
    await delay(600 + Math.random() * 400);

    if (field === 'persona') {
      const persona = PERSONA_SUGGESTIONS[Math.floor(Math.random() * PERSONA_SUGGESTIONS.length)];
      return {
        id: msgId(),
        type: 'suggestion',
        text: `How about: "${persona}"?`,
        field: 'persona',
        value: persona,
        timestamp: new Date().toISOString(),
      };
    }

    if (field === 'acceptanceCriteria') {
      return {
        id: msgId(),
        type: 'criteria-bundle',
        text: 'Here are some acceptance criteria I\'d suggest:',
        criteria: AC_SUGGESTIONS,
        timestamp: new Date().toISOString(),
      };
    }

    if (field === 'title') {
      return {
        id: msgId(),
        type: 'suggestion',
        text: 'Consider a title that starts with an action verb, like "Enable batch export for monthly reports"',
        field: 'title',
        value: 'Enable batch export for monthly reports',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      id: msgId(),
      type: 'ai',
      text: `I can help with the ${field} section. Could you tell me more about what you\'re trying to achieve?`,
      timestamp: new Date().toISOString(),
    };
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
