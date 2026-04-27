import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export interface ScanResult {
  summary: string;
  acceptanceCriteria: string[];
  edgeCases: string[];
}

export async function scanDocument(
  content: string,
  mimeType: string,
): Promise<ScanResult> {
  const isImage = mimeType.startsWith('image/');

  const messages: Anthropic.MessageParam[] = isImage
    ? [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType as Anthropic.Base64ImageSource['media_type'], data: content },
            },
            {
              type: 'text',
              text: 'Analyze this image for a user story. Extract likely acceptance criteria and edge cases. Return JSON: { "summary": "...", "acceptanceCriteria": ["..."], "edgeCases": ["..."] }',
            },
          ],
        },
      ]
    : [
        {
          role: 'user',
          content: `Analyze this document for a user story. Extract likely acceptance criteria and edge cases.\n\nDocument content:\n${content}\n\nReturn JSON: { "summary": "...", "acceptanceCriteria": ["..."], "edgeCases": ["..."] }`,
        },
      ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: 'You are a document analyzer for user story writing. Extract testable acceptance criteria and edge cases from documents. Always return valid JSON.',
    messages,
  });

  const block = response.content[0];
  if (block.type === 'text') {
    try {
      return JSON.parse(block.text);
    } catch {
      return { summary: block.text, acceptanceCriteria: [], edgeCases: [] };
    }
  }
  return { summary: '', acceptanceCriteria: [], edgeCases: [] };
}
