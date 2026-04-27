import { useState } from 'react';
import { Btn, Badge, TextInput, TextArea, Avatar, StateDot, TopBar, AzureMark, Ico } from '../components/ui';

export function DevPage() {
  const [text, setText] = useState('');
  const [area, setArea] = useState('');

  return (
    <div style={{ minHeight: '100vh', background: '#F1F4F9' }}>
      <TopBar breadcrumbs={['Dev', 'Component Gallery']} />

      <div style={{ padding: 32, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Buttons */}
        <Section title="Buttons">
          <Row>
            <Btn variant="primary">Primary</Btn>
            <Btn variant="default">Default</Btn>
            <Btn variant="ghost">Ghost</Btn>
            <Btn variant="ai" icon={<Ico.sparkle size={12} />}>AI</Btn>
            <Btn variant="danger">Danger</Btn>
          </Row>
          <Row>
            <Btn variant="primary" size="sm">Small</Btn>
            <Btn variant="primary" size="md">Medium</Btn>
            <Btn variant="primary" size="lg">Large</Btn>
          </Row>
          <Row>
            <Btn variant="primary" disabled>Disabled</Btn>
            <Btn variant="primary" icon={<Ico.plus size={12} />}>With Icon</Btn>
            <Btn variant="primary" fullWidth>Full Width</Btn>
          </Row>
        </Section>

        {/* Badges */}
        <Section title="Badges">
          <Row>
            <Badge>Default</Badge>
            <Badge tone="azure">Azure</Badge>
            <Badge tone="success" icon={<Ico.check size={10} />}>Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
            <Badge tone="ai" icon={<Ico.sparkle size={10} />}>AI</Badge>
          </Row>
        </Section>

        {/* Inputs */}
        <Section title="TextInput">
          <TextInput value={text} onChange={setText} placeholder="Type something..." label="Label" hint="This is a hint" />
          <TextInput value="" onChange={() => {}} placeholder="With icon" icon={<Ico.search size={14} />} />
          <TextInput value="" onChange={() => {}} placeholder="Error state" error="This field is required" />
        </Section>

        {/* TextArea */}
        <Section title="TextArea">
          <TextArea value={area} onChange={setArea} placeholder="Write something longer..." rows={3} />
        </Section>

        {/* Avatar */}
        <Section title="Avatar">
          <Row>
            <Avatar name="Maya Kowalski" />
            <Avatar name="John Doe" size={36} />
            <Avatar name="Alice" size={24} />
            <Avatar name="Bob Smith" size={40} color="#7E57C2" />
          </Row>
        </Section>

        {/* StateDot */}
        <Section title="StateDot">
          <Row>
            <LabeledItem label="Pending"><StateDot state="pending" /></LabeledItem>
            <LabeledItem label="Active"><StateDot state="active" /></LabeledItem>
            <LabeledItem label="Done"><StateDot state="done" /></LabeledItem>
            <LabeledItem label="Warn"><StateDot state="warn" /></LabeledItem>
          </Row>
        </Section>

        {/* AzureMark */}
        <Section title="AzureMark">
          <Row>
            <AzureMark size={20} />
            <AzureMark size={32} />
          </Row>
        </Section>

        {/* Icons */}
        <Section title="Icons (25)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {Object.entries(Ico).map(([name, Icon]) => (
              <LabeledItem key={name} label={name}>
                <Icon size={18} />
              </LabeledItem>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#212332' }}>{title}</h2>
      <div style={{ background: '#fff', borderRadius: 6, padding: 20, border: '1px solid #E3E6ED', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>{children}</div>;
}

function LabeledItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {children}
      <span style={{ fontSize: 10, color: '#9AA0AC' }}>{label}</span>
    </div>
  );
}
