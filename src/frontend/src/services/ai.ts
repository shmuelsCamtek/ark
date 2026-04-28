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
  async chat(messages: CoachMessage[], _draftContext: string): Promise<CoachMessage> {
    await delay(800 + Math.random() * 600);
    const lastMsg = messages[messages.length - 1];
    const userText = lastMsg?.text?.toLowerCase() ?? '';

    // Contextual mock responses based on user message
    if (userText.includes('suggest more ac') || userText.includes('acceptance criteria')) {
      return {
        id: msgId(),
        type: 'criteria-bundle',
        text: 'Here are some additional acceptance criteria to consider:',
        criteria: AC_SUGGESTIONS,
        timestamp: new Date().toISOString(),
      };
    }

    if (userText.includes('tighten the benefit') || userText.includes('benefit')) {
      return {
        id: msgId(),
        type: 'suggestion',
        text: 'Here are some tighter benefit statements:',
        field: 'benefit',
        value: 'I can reduce manual triage from 2 hours to 15 minutes daily',
        timestamp: new Date().toISOString(),
      };
    }

    if (userText.includes('split')) {
      return {
        id: msgId(),
        type: 'ai',
        text: 'This story could be split into two: (1) the core retry logic and (2) the notification/alerting piece. That way each can be independently estimated and tested.',
        timestamp: new Date().toISOString(),
      };
    }

    const responses: CoachMessage[] = [
      {
        id: msgId(),
        type: 'quiz',
        text: 'I want to help you refine this story.',
        quiz: {
          question: 'What would you like to focus on first?',
          options: [
            'Sharpen the acceptance criteria for edge cases',
            'Clarify who the primary persona is',
            'Make the benefit more measurable',
            'Something else\u2026',
          ],
        },
        timestamp: new Date().toISOString(),
      },
      {
        id: msgId(),
        type: 'quiz',
        text: 'This narrative is clear, but I have a question.',
        quiz: {
          question: 'Who else is affected by this change besides the primary persona?',
          options: [
            'End users / customers',
            'Internal support team',
            'DevOps / infrastructure team',
            'Something else\u2026',
          ],
        },
        timestamp: new Date().toISOString(),
      },
      {
        id: msgId(),
        type: 'ai',
        text: 'Great start! I\'d suggest adding acceptance criteria around the unhappy path \u2014 what happens when things go wrong?',
        timestamp: new Date().toISOString(),
      },
    ];
    return responses[Math.floor(Math.random() * responses.length)];
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
