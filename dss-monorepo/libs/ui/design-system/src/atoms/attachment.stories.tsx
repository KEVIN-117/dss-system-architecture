import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
} from './attachment';
import {
  FileTextIcon,
  Trash2Icon,
  DownloadIcon,
  FileCode2Icon,
  DatabaseIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  HardDriveIcon,
} from 'lucide-react';

const meta: Meta<typeof Attachment> = {
  title: 'Atoms/Attachment',
  component: Attachment,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['default', 'sm', 'xs'],
      description: 'The size variant of the attachment container.',
    },
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'The layout direction of the attachment card.',
    },
    state: {
      control: 'select',
      options: ['idle', 'uploading', 'processing', 'error', 'done'],
      description: 'The current status state of the attachment.',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Attachment>;

export const Default: Story = {
  render: (args) => (
    <Attachment {...args}>
      <AttachmentMedia>
        <FileTextIcon className="size-5 text-primary" />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>kardex_academico_2026.pdf</AttachmentTitle>
        <AttachmentDescription>2.4 MB • PDF Document</AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction title="Download">
          <DownloadIcon className="size-3.5" />
        </AttachmentAction>
        <AttachmentAction
          title="Delete"
          className="text-destructive hover:text-destructive"
        >
          <Trash2Icon className="size-3.5" />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  ),
  args: {
    size: 'default',
    orientation: 'horizontal',
    state: 'done',
  },
};

export const Variations: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">
          States (Horizontal)
        </h4>
        <div className="flex flex-wrap gap-4">
          <Attachment state="done">
            <AttachmentMedia>
              <FileCode2Icon className="size-5 text-success" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>etl_pipeline_config.json</AttachmentTitle>
              <AttachmentDescription>Uploaded • 18 KB</AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction>
                <DownloadIcon className="size-3.5" />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>

          <Attachment state="uploading">
            <AttachmentMedia>
              <RefreshCwIcon className="size-5 animate-spin text-primary" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>student_enrollment_batch.csv</AttachmentTitle>
              <AttachmentDescription>Uploading 64%...</AttachmentDescription>
            </AttachmentContent>
          </Attachment>

          <Attachment state="processing">
            <AttachmentMedia>
              <DatabaseIcon className="size-5 text-warning animate-pulse" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>dw_star_schema_dump.sql</AttachmentTitle>
              <AttachmentDescription>
                Transforming data...
              </AttachmentDescription>
            </AttachmentContent>
          </Attachment>

          <Attachment state="error">
            <AttachmentMedia>
              <AlertTriangleIcon className="size-5 text-destructive" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>corrupted_matriculas.parquet</AttachmentTitle>
              <AttachmentDescription>
                CRC32 Checksum failure
              </AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction title="Retry">
                <RefreshCwIcon className="size-3.5" />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>

          <Attachment state="idle">
            <AttachmentMedia>
              <HardDriveIcon className="size-5 text-muted-foreground" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>drop_zone_archive.zip</AttachmentTitle>
              <AttachmentDescription>Ready to upload</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        </div>
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">
          Sizes
        </h4>
        <div className="flex flex-wrap items-center gap-4">
          <Attachment size="default">
            <AttachmentMedia>
              <FileTextIcon className="size-5" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>report_size_default.docx</AttachmentTitle>
              <AttachmentDescription>Size: default</AttachmentDescription>
            </AttachmentContent>
          </Attachment>

          <Attachment size="sm">
            <AttachmentMedia>
              <FileTextIcon className="size-4" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>report_size_sm.docx</AttachmentTitle>
              <AttachmentDescription>Size: sm</AttachmentDescription>
            </AttachmentContent>
          </Attachment>

          <Attachment size="xs">
            <AttachmentMedia>
              <FileTextIcon className="size-3.5" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>report_size_xs.docx</AttachmentTitle>
              <AttachmentDescription>Size: xs</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        </div>
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">
          Vertical Group
        </h4>
        <AttachmentGroup>
          <Attachment orientation="vertical" size="default">
            <AttachmentMedia>
              <FileCode2Icon className="size-6 text-primary" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>schema_v1.ts</AttachmentTitle>
              <AttachmentDescription>12 KB</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
          <Attachment orientation="vertical" size="default">
            <AttachmentMedia>
              <FileCode2Icon className="size-6 text-primary" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>schema_v2.ts</AttachmentTitle>
              <AttachmentDescription>14 KB</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
          <Attachment orientation="vertical" size="default" state="processing">
            <AttachmentMedia>
              <RefreshCwIcon className="size-6 text-warning animate-spin" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>schema_v3.ts</AttachmentTitle>
              <AttachmentDescription>Compiling...</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        </AttachmentGroup>
      </div>
    </div>
  ),
};

export const Cyberpunk: Story = {
  render: () => (
    <div className="p-6 bg-background rounded-lg border border-primary/30 font-mono space-y-4">
      <div className="text-xs text-primary/70 tracking-widest flex items-center justify-between">
        <span> NEURAL_PAYLOAD_MANIFEST</span>
        <span className="text-success">STATUS: SECURE</span>
      </div>

      <div className="flex flex-wrap gap-4">
        <Attachment
          state="done"
          className="border-primary/40 bg-card/40 backdrop-blur-sm shadow-md"
        >
          <AttachmentMedia className="bg-primary/10 border border-primary/30">
            <DatabaseIcon className="size-5 text-primary" />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle className="text-primary font-mono">
              weights_v2_academic_risk.safetensors
            </AttachmentTitle>
            <AttachmentDescription className="text-muted-foreground font-mono text-xs">
              SHA256: 9e3f...a41c • 1.2 GB
            </AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction
              title="Download Artifact"
              className="text-primary hover:text-foreground hover:bg-primary/20"
            >
              <DownloadIcon className="size-3.5" />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>

        <Attachment
          state="uploading"
          className="border-warning/40 bg-card/40 backdrop-blur-sm shadow-md"
        >
          <AttachmentMedia className="bg-warning/10 border border-warning/30">
            <RefreshCwIcon className="size-5 text-warning animate-spin" />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle className="text-warning font-mono">
              telemetry_quantum_stream.bin
            </AttachmentTitle>
            <AttachmentDescription className="text-warning/70 font-mono text-xs">
              STREAMING // 842.1 MB / 1.0 GB
            </AttachmentDescription>
          </AttachmentContent>
        </Attachment>
      </div>
    </div>
  ),
};
