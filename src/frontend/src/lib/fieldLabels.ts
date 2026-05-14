const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  background: 'Background',
  scenario: 'The Scenario',
  persona: 'Persona',
  want: 'Desire',
  benefit: 'Benefit',
  criteria: 'Acceptance criteria',
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}
