declare module 'mammoth' {
  export interface ExtractRawTextResult {
    value: string;
    messages: { type: string; message: string }[];
  }
  export function extractRawText(
    input: { buffer: Buffer } | { path: string },
  ): Promise<ExtractRawTextResult>;
  const _default: { extractRawText: typeof extractRawText };
  export default _default;
}
