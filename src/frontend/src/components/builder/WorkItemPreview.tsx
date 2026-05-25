import { type ReactNode } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Ico } from '../ui/icons';
import { UiChangePreview } from './UiChangePreview';
import { FlowPreview } from './FlowPreview';

interface Criterion {
  id: string | number;
  text: string;
}

interface DocItem {
  id: string;
  name: string;
  size: string;
  kind: 'pdf' | 'image' | 'file';
}

interface WorkItemPreviewProps {
  title: string;
  background: string;
  scenario?: string;
  flow?: string;
  persona: string;
  want: string;
  benefit: string;
  criteria: Criterion[];
  docs: DocItem[];
  showUiChange: boolean;
  compact?: boolean;
  hideHeader?: boolean;
  workItemType?: string;
  workItemId?: string;
  uiBeforeUrl?: string;
  uiAfterUrl?: string;
}

interface WorkItemHeaderProps {
  title: string;
  workItemType?: string;
  workItemId?: string;
}

export function WorkItemHeader({ title, workItemType, workItemId }: WorkItemHeaderProps) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: ARK_TOKENS.type.micro, color: ARK_TOKENS.inkSubtle, fontWeight: ARK_TOKENS.weight.semibold, letterSpacing: 0.3 }}>
        <span style={{ width: 10, height: 10, background: ARK_TOKENS.azure, borderRadius: 1 }} />
        <span>
          {(workItemType || 'User Story').toUpperCase()}
          {workItemId ? ` · #${workItemId}` : ''}
        </span>
      </div>

      <h2 style={{ fontSize: ARK_TOKENS.type.h1, fontWeight: ARK_TOKENS.weight.semibold, margin: '0 0 12px', letterSpacing: -0.3, lineHeight: ARK_TOKENS.leading.tight }}>
        {title || <span style={{ color: ARK_TOKENS.inkSubtle, fontWeight: ARK_TOKENS.weight.regular }}>Untitled story</span>}
      </h2>
    </>
  );
}

export function WorkItemPreview({ title, background, scenario, flow, persona, want, benefit, criteria, docs, showUiChange, compact, hideHeader, workItemType, workItemId, uiBeforeUrl, uiAfterUrl }: WorkItemPreviewProps) {
  return (
    <div style={{ fontSize: ARK_TOKENS.type.body, lineHeight: ARK_TOKENS.leading.normal }}>
      {!hideHeader && (
        <WorkItemHeader title={title} workItemType={workItemType} workItemId={workItemId} />
      )}

      <div style={{ marginBottom: 20 }}>
        <SectionLabel>Background</SectionLabel>
        {background ? (
          <p style={{ margin: 0, fontSize: ARK_TOKENS.type.body, lineHeight: 1.6, color: ARK_TOKENS.ink, whiteSpace: 'pre-wrap' }}>{background}</p>
        ) : (
          <Placeholder w={260} />
        )}
      </div>

      {scenario?.trim() && (
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Scenario</SectionLabel>
          <p style={{ margin: 0, fontSize: ARK_TOKENS.type.body, lineHeight: 1.6, color: ARK_TOKENS.ink, whiteSpace: 'pre-wrap' }}>{scenario}</p>
        </div>
      )}

      {flow?.trim() && (
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Flow</SectionLabel>
          <FlowPreview value={flow} />
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <SectionLabel>Description</SectionLabel>
        <p style={{ margin: 0, fontSize: ARK_TOKENS.type.body, lineHeight: 1.6, color: ARK_TOKENS.ink }}>
          <b>As a</b> {persona || <Placeholder w={80} />}
          <br /><b>I want</b> {want || <Placeholder w={200} />}
          <br /><b>So that</b> {benefit || <Placeholder w={180} />}.
        </p>
      </div>

      <div>
        <SectionLabel>Acceptance criteria</SectionLabel>
        {criteria.length === 0 ? (
          <Placeholder w={240} />
        ) : (
          <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {criteria.map((c, i) => (
              <li
                key={c.id}
                style={{
                  display: 'flex', gap: 12, padding: '8px 0',
                  borderTop: i === 0 ? 'none' : `1px solid ${ARK_TOKENS.border}`,
                  fontSize: ARK_TOKENS.type.body, lineHeight: ARK_TOKENS.leading.normal,
                }}
              >
                <span style={{ color: ARK_TOKENS.inkSubtle, fontWeight: ARK_TOKENS.weight.semibold, fontVariantNumeric: 'tabular-nums', flexShrink: 0, fontSize: ARK_TOKENS.type.micro, marginTop: 2, width: 24 }}>
                  AC{i + 1}
                </span>
                <span style={{ flex: 1 }}>{c.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {showUiChange && (
        <div style={{ marginTop: 22 }}>
          <SectionLabel>UI change · Before → After</SectionLabel>
          <UiChangePreview enabled compact onToggle={() => {}} before={uiBeforeUrl} after={uiAfterUrl} />
        </div>
      )}

      {docs && docs.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <SectionLabel>Attachments</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {docs.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.ink, padding: '4px 0' }}>
                <DocIcon kind={d.kind} />
                <span style={{ flex: 1 }}>{d.name}</span>
                <span style={{ color: ARK_TOKENS.inkSubtle, fontSize: ARK_TOKENS.type.micro }}>{d.size}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!compact && (
        <div style={{ marginTop: 22, fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.inkSubtle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ico.link size={11} />
          <span>Will link to <span style={{ color: ARK_TOKENS.azure, fontWeight: ARK_TOKENS.weight.medium }}>Feature #3994</span></span>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: ARK_TOKENS.type.micro, fontWeight: ARK_TOKENS.weight.semibold, color: ARK_TOKENS.ink, letterSpacing: 0.7, marginBottom: 8, textTransform: 'uppercase' }}>
      {children}
    </div>
  );
}

function Placeholder({ w = 140 }: { w?: number }) {
  return (
    <span
      style={{
        display: 'inline-block', width: w, height: 10,
        background: 'linear-gradient(90deg, #eee 0%, #f8f8f8 50%, #eee 100%)',
        backgroundSize: '200% 100%',
        animation: 'ark-shimmer 1.6s linear infinite',
        borderRadius: 2, verticalAlign: 'middle',
      }}
    />
  );
}

function DocIcon({ kind }: { kind: string }) {
  const color = kind === 'image' ? '#7E57C2' : kind === 'pdf' ? '#E11A22' : ARK_TOKENS.inkMuted;
  return (
    <div
      style={{
        width: 22, height: 22, borderRadius: 4,
        background: ARK_TOKENS.surfaceAlt,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, flexShrink: 0,
      }}
    >
      {kind === 'image' ? <Ico.image size={14} /> : <Ico.file size={14} />}
    </div>
  );
}
