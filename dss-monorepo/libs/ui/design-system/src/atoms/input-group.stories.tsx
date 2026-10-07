import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from './input-group';
import {
  SearchIcon,
  CopyIcon,
  CheckIcon,
  SendIcon,
  TerminalIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  GlobeIcon,
  CornerDownLeftIcon,
  AlertCircleIcon,
} from 'lucide-react';

const meta: Meta<typeof InputGroup> = {
  title: 'Atoms/InputGroup',
  component: InputGroup,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof InputGroup>;

export const Default: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <SearchIcon className="size-4 text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search students, courses, or metrics..." />
        <InputGroupAddon align="inline-end">
          <InputGroupText>
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border">
              ⌘K
            </kbd>
          </InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};

function WithButtonsRender() {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="w-96">
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <GlobeIcon className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">https://</span>
        </InputGroupAddon>
        <InputGroupInput defaultValue="dss.uatf.edu.bo/analytics/dashboard" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            title="Copy URL"
            onClick={handleCopy}
          >
            {copied ? (
              <CheckIcon className="size-3.5 text-success" />
            ) : (
              <CopyIcon className="size-3.5" />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

export const WithButtons: Story = {
  render: () => <WithButtonsRender />,
};

function PasswordToggleRender() {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="w-80">
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <LockIcon className="size-4 text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput
          type={showPassword ? 'text' : 'password'}
          placeholder="Enter secure master key..."
          defaultValue="SecretMatrixToken123"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            onClick={() => setShowPassword(!showPassword)}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOffIcon className="size-3.5 text-muted-foreground" />
            ) : (
              <EyeIcon className="size-3.5 text-muted-foreground" />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

export const PasswordToggle: Story = {
  render: () => <PasswordToggleRender />,
};

export const WithTextarea: Story = {
  render: () => (
    <div className="w-96">
      <InputGroup className="min-h-24">
        <InputGroupTextarea placeholder="Escribe observaciones académicas o notas del estudiante..." />
        <InputGroupAddon align="block-end" className="border-t justify-between">
          <InputGroupText>
            <span className="text-[11px] text-muted-foreground">
              0 / 250 caracteres
            </span>
          </InputGroupText>
          <InputGroupButton size="xs" variant="default">
            <span>Enviar</span>
            <SendIcon className="size-3" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};

export const Variations: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <div>
        <span className="text-xs text-muted-foreground mb-1 block">
          Disabled State
        </span>
        <InputGroup aria-disabled>
          <InputGroupAddon align="inline-start">
            <SearchIcon className="size-4" />
          </InputGroupAddon>
          <InputGroupInput placeholder="Read only input..." aria-disabled />
        </InputGroup>
      </div>

      <div>
        <span className="text-xs text-muted-foreground mb-1 block">
          Invalid / Error State
        </span>
        <InputGroup aria-invalid="true">
          <InputGroupAddon align="inline-start">
            <AlertCircleIcon className="size-4 text-destructive" />
          </InputGroupAddon>
          <InputGroupInput
            defaultValue="invalid_student_id_format"
            aria-invalid="true"
          />
        </InputGroup>
      </div>
    </div>
  ),
};

export const Cyberpunk: Story = {
  render: () => (
    <div className="p-6 bg-background rounded-lg border border-primary/40 font-mono w-96 space-y-4 shadow-md">
      <div className="flex items-center justify-between border-b border-primary/20 pb-2">
        <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
          <TerminalIcon className="size-4" />
          <span>DECANAL_ROOT_TERMINAL</span>
        </div>
        <span className="text-[10px] text-success">TTY_1</span>
      </div>

      <div className="space-y-1">
        <div className="text-[10px] text-primary/70 tracking-wider">
          EXECUTE RAW CYPHER / SQL
        </div>
        <InputGroup className="border-primary/50 bg-card/40 focus-within:border-primary focus-within:ring-primary/30">
          <InputGroupAddon align="inline-start">
            <span className="text-success font-bold text-xs">{'>'}</span>
          </InputGroupAddon>
          <InputGroupInput
            defaultValue="MATCH (s:Estudiante)-[r:MATRICULADO]->(m) RETURN s, count(r)"
            className="text-foreground text-xs font-mono"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="xs"
              variant="default"
              className="bg-primary/80 hover:bg-primary text-primary-foreground font-mono text-[10px]"
            >
              RUN
              <CornerDownLeftIcon className="size-3 ml-0.5" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  ),
};
