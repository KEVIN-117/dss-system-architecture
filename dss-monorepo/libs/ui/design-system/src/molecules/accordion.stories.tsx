import type { Meta, StoryObj } from '@storybook/react-vite';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './accordion';
import { Badge } from '../atoms/badge';
import { Terminal, Shield, Cpu, Database, Network, FolderGit2 } from 'lucide-react';

const meta: Meta<typeof Accordion> = {
  title: 'Molecules/Accordion',
  component: Accordion,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Accordion>;

export const Default: Story = {
  render: () => (
    <Accordion type="single" collapsible defaultValue="item-1" className="w-full max-w-lg">
      <AccordionItem value="item-1">
        <AccordionTrigger>What is the Academic Decision Support System?</AccordionTrigger>
        <AccordionContent>
          The DSS integrates heterogeneous university databases into a PostgreSQL Star Schema (HEFESTO v2) and Neo4j knowledge graph to predict student retention and academic performance.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>How does the predictive ML model handle class imbalance?</AccordionTrigger>
        <AccordionContent>
          We employ SMOTE (Synthetic Minority Over-sampling Technique) in our CRISP-DM workflow to balance under-represented academic dropout cases before training XGBoost and Random Forest classifiers.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>How is data security segregated across faculties?</AccordionTrigger>
        <AccordionContent>
          Role-Based Access Control (RBAC) combined with PostgreSQL Row-Level Security guarantees that Deans and Directors only access telemetry and student data strictly belonging to their department.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const CyberpunkTerminal: Story = {
  render: () => (
    <div className="p-6 bg-black/95 rounded-xl border border-primary/30 shadow-[0_0_25px_rgba(0,255,200,0.08)] max-w-2xl font-mono">
      <div className="flex items-center justify-between border-b border-primary/20 pb-3 mb-4">
        <div className="flex items-center gap-2 text-primary">
          <Terminal className="size-4 animate-pulse" />
          <span className="text-xs uppercase font-bold tracking-widest">
            MAINFRAME_SUBSYSTEM_REGISTRY // ROOT_V2
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/40">
          ALL_SERVICES_NOMINAL
        </Badge>
      </div>

      <Accordion type="single" collapsible defaultValue="subsystem-1" className="w-full space-y-2">
        <AccordionItem value="subsystem-1" className="rounded-md border border-primary/20 bg-black/50">
          <AccordionTrigger className="text-xs font-mono hover:text-primary">
            <div className="flex items-center gap-2 text-left">
              <Database className="size-3.5 text-amber-400 shrink-0" />
              <span>// SUBSYSTEM_01: HEFESTO_DATA_WAREHOUSE</span>
            </div>
            <Badge variant="default" className="mr-2 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              PORT 5432 [ONLINE]
            </Badge>
          </AccordionTrigger>
          <AccordionContent className="font-mono text-xs text-muted-foreground space-y-1.5 pt-2">
            <p className="text-primary">&gt; STAR_SCHEMA: Academic_Performance_Fact_Table</p>
            <p>&gt; DIMENSIONS: Dim_Estudiante, Dim_Materia, Dim_Docente, Dim_Tiempo</p>
            <p>&gt; INGESTION_PIPELINE: Go Load Manager (ETL Concurrency: 8 Goroutines)</p>
            <p className="text-emerald-400">&gt; INTEGRITY: 1,482,910 records verified | Checksum: 0x8FA4</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="subsystem-2" className="rounded-md border border-primary/20 bg-black/50">
          <AccordionTrigger className="text-xs font-mono hover:text-primary">
            <div className="flex items-center gap-2 text-left">
              <Cpu className="size-3.5 text-cyan-400 shrink-0" />
              <span>// SUBSYSTEM_02: PREDICTIVE_ML_ENGINE</span>
            </div>
            <Badge variant="default" className="mr-2 text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              XGBOOST [READY]
            </Badge>
          </AccordionTrigger>
          <AccordionContent className="font-mono text-xs text-muted-foreground space-y-1.5 pt-2">
            <p className="text-cyan-400">&gt; METHODOLOGY: CRISP-DM Machine Learning Pipeline</p>
            <p>&gt; IMBALANCE_STRATEGY: SMOTE (k_neighbors=5, sampling_strategy=auto)</p>
            <p>&gt; SHAP_EXPLAINER: TreeExplainer enabled (Feature vectors cached)</p>
            <p className="text-emerald-400">&gt; METRICS: Precision: 92.4% | Recall: 91.8% | ROC-AUC: 0.962</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="subsystem-3" className="rounded-md border border-primary/20 bg-black/50">
          <AccordionTrigger className="text-xs font-mono hover:text-primary">
            <div className="flex items-center gap-2 text-left">
              <Network className="size-3.5 text-purple-400 shrink-0" />
              <span>// SUBSYSTEM_03: NEO4J_KNOWLEDGE_GRAPH</span>
            </div>
            <Badge variant="default" className="mr-2 text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
              BOLT [LINKED]
            </Badge>
          </AccordionTrigger>
          <AccordionContent className="font-mono text-xs text-muted-foreground space-y-1.5 pt-2">
            <p className="text-purple-400">&gt; GRAPH_TOPOLOGY: Academic Prerequisite & Cohort Network</p>
            <p>&gt; GRAPH_NODES: 12,450 (:Student, :Course, :Professor)</p>
            <p>&gt; RELATIONSHIPS: 48,200 (:ENROLLED_IN, :PREREQUISITE_FOR)</p>
            <p className="text-emerald-400">&gt; CYPHER_QUERY_LATENCY: 3.2ms average traverse time</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="subsystem-4" className="rounded-md border border-primary/20 bg-black/50">
          <AccordionTrigger className="text-xs font-mono hover:text-primary">
            <div className="flex items-center gap-2 text-left">
              <Shield className="size-3.5 text-emerald-400 shrink-0" />
              <span>// SUBSYSTEM_04: SECURITY_RBAC_GATEWAY</span>
            </div>
            <Badge variant="outline" className="mr-2 text-[10px] text-emerald-400 border-emerald-500/40">
              ENFORCING
            </Badge>
          </AccordionTrigger>
          <AccordionContent className="font-mono text-xs text-muted-foreground space-y-1.5 pt-2">
            <p className="text-emerald-400">&gt; AUTH: RS256 Bearer Tokens with Zero-Trust Revocation</p>
            <p>&gt; SEGREGATION: Carrera-level row filtering on Fact and Dimension tables</p>
            <p>&gt; RATE_LIMITING: Token bucket algorithm (100 req/min per faculty node)</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const MultipleExpanded: Story = {
  render: () => (
    <Accordion type="multiple" defaultValue={["item-1", "item-2"]} className="w-full max-w-lg">
      <AccordionItem value="item-1">
        <AccordionTrigger>Faculty of Engineering Architecture</AccordionTrigger>
        <AccordionContent>
          Active departments: Civil Engineering, Systems Engineering, Electrical Engineering. Ingestion pipeline currently active with 3,450 enrolled students.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Faculty of Pure Sciences</AccordionTrigger>
        <AccordionContent>
          Active departments: Computer Science, Mathematics, Physics, Chemistry. 2,120 student profiles synchronized into Neo4j graph for prerequisite tracking.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>Faculty of Economic Sciences</AccordionTrigger>
        <AccordionContent>
          Active departments: Financial Engineering, Business Administration. Initial historical data migration completed up to semester 2025-II.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const ProjectMilestones: Story = {
  render: () => (
    <div className="w-full max-w-lg p-4 rounded-lg border border-primary/20 bg-background/50">
      <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3 font-semibold flex items-center gap-2">
        <FolderGit2 className="size-4 text-primary" />
        Sprint Backlog & Work In Progress (WIP)
      </h4>
      <Accordion type="single" collapsible defaultValue="phase-1">
        <AccordionItem value="phase-1" className="border-b border-primary/10">
          <AccordionTrigger className="text-sm">
            Phase 1: HEFESTO Star Schema & PostgreSQL DDL
          </AccordionTrigger>
          <AccordionContent>
            Creation of fact and dimension tables, indexing on surrogate keys, and initial population scripts using Pentaho PDI and Go Load Manager.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="phase-2" className="border-b border-primary/10">
          <AccordionTrigger className="text-sm">
            Phase 2: Predictive Modeling (SMOTE + XGBoost)
          </AccordionTrigger>
          <AccordionContent>
            Feature engineering on student semester logs, hyperparameter tuning via Optuna, and validation with stratified k-fold cross-validation.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="phase-3" className="border-b-0">
          <AccordionTrigger className="text-sm">
            Phase 3: Superset Dashboard Customization & RLS
          </AccordionTrigger>
          <AccordionContent>
            Decanal views customization with faculty-based row-level filters and dark cyberpunk theme alignment.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};
