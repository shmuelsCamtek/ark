import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function chatWithCoach(
  messages: ChatMessage[],
  draftContext: string,
): Promise<string> {
  const systemPrompt = `You are Ark Coach, an AI assistant that helps non-technical professionals write well-formed Azure DevOps user stories.

You are knowledgeable about:
- INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable)
- User story best practices (persona, narrative, acceptance criteria)
- Azure DevOps work item structure

Your tone is helpful, concise, and encouraging. You suggest improvements without being prescriptive.

Current draft context:
${draftContext}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const block = response.content[0];
  if (block.type === 'text') return block.text;
  return '';
}

export async function suggestForField(
  field: string,
  currentValue: string,
  draftContext: string,
): Promise<{ text: string; suggestions?: string[] }> {
  const systemPrompt = `You are Ark Coach. The user is writing a user story and needs help with the "${field}" field.

Current value: "${currentValue}"
Draft context: ${draftContext}

Provide 2-3 concrete suggestions. Return JSON: { "text": "brief intro", "suggestions": ["option1", "option2", "option3"] }`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Suggest improvements for the ${field} field.` }],
  });

  const block = response.content[0];
  if (block.type === 'text') {
    try {
      return JSON.parse(block.text);
    } catch {
      return { text: block.text };
    }
  }
  return { text: 'No suggestions available.' };
}
