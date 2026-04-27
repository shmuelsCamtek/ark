import { type ReactNode } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Avatar } from '../ui/Avatar';
import { Ico } from '../ui/icons';
import { UiChangePreview } from './UiChangePreview';

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
  persona: string;
  want: string;
  benefit: string;
  criteria: Criterion[];
  docs: DocItem[];
  showUiChange: boolean;
  compact?: boolean;
}

export function WorkItemPreview({ title, background, persona, want, benefit, criteria, docs, showUiChange, compact }: WorkItemPreviewProps) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.55 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 11, color: ARK_TOKENS.inkSubtle, fontWeight: 500, letterSpacing: 0.3 }}>
        <span style={{ width: 10, height: 10, background: ARK_TOKENS.azure, borderRadius: 1 }} />
        <span>USER STORY · #4187 · NEW</span>
      </div>

      <h2 style={{ fontSize: 19, fontWeight: 600, margin: '0 0 16px', letterSpacing: -0.3, lineHeight: 1.3 }}>
        {title || <span style={{ color: ARK_TOKENS.inkSubtle, fontWeight: 400 }}>Untitled story</span>}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 20, fontSize: 12 }}>
        <PreviewMeta label="Assigned" value={<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar name="Unassigned" size={16} color="#a19f9d" /> Unassigned</div>} />
        <PreviewMeta label="State" value="New" />
        <PreviewMeta label="Area" value="Billing" />
        <PreviewMeta label="Iteration" value="Sprint 42" />
      </div>

      <div style={{ marginBottom: 20 }}>
        <SectionLabel>Background</SectionLabel>
        {background ? (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: ARK_TOKENS.ink, whiteSpace: 'pre-wrap' }}>{background}</p>
        ) : (
          <Placeholder w={260} />
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <SectionLabel>Description</SectionLabel>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: ARK_TOKENS.ink }}>
          <b>As a</b> {persona || <Placeholder w={80} />}
          <br /><b>I want to</b> {want || <Placeholder w={200} />}
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
                  fontSize: 12.5, lineHeight: 1.55,
                }}
              >
                <span style={{ color: ARK_TOKENS.inkSubtle, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0, fontSize: 11, marginTop: 2, width: 24 }}>
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
          <UiChangePreview enabled compact onToggle={() => {}} />
        </div>
      )}

      {docs && docs.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <SectionLabel>Attachments</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {docs.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: ARK_TOKENS.ink, padding: '4px 0' }}>
                <DocIcon kind={d.kind} />
                <span style={{ flex: 1 }}>{d.name}</span>
                <span style={{ color: ARK_TOKENS.inkSubtle, fontSize: 11 }}>{d.size}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!compact && (
        <div style={{ marginTop: 22, fontSize: 12, color: ARK_TOKENS.inkSubtle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ico.link size={11} />
          <span>Will link to <span style={{ color: ARK_TOKENS.azure, fontWeight: 500 }}>Feature #3994</span></span>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 600, color: ARK_TOKENS.inkSubtle, letterSpacing: 0.7, marginBottom: 8, textTransform: 'uppercase' }}>
      {children}
    </div>
  );
}

function PreviewMeta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: ARK_TOKENS.inkSubtle, fontWeight: 600, letterSpacing: 0.6, marginBottom: 3, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 12.5, color: ARK_TOKENS.ink }}>{value}</div>
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
