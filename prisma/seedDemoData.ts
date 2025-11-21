import {
  PrismaClient,
  Prisma,
  EstimateStage,
  AgreementType,
  AgreementStatus,
} from "@prisma/client";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

type DemoArtifact = {
  type: string;
  originalName: string;
  content: string;
};

type DemoProjectConfig = {
  key: string;
  name: string;
  clientName: string;
  stage: EstimateStage;
  archetypeKey: "webApp" | "dataPlatform" | "mobileApp" | "internalTools";
  artifacts: DemoArtifact[];
};

type DemoProjectsFile = {
  projects: DemoProjectConfig[];
};

function loadDemoProjects(): DemoProjectsFile {
  const filePath = path.join(process.cwd(), "prisma", "demoProjects.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as DemoProjectsFile;
}

type AgreementContext = DemoProjectConfig;

type AgreementFallback = {
  name?: string;
  clientName?: string | null;
  stage?: EstimateStage;
  archetypeKey?: DemoProjectConfig["archetypeKey"];
};

const PROVIDER_NAME = "VBT Consulting";

const PAYMENT_TERMS_TEXT =
  "Payment Terms. Unless otherwise noted, invoices are due Net 30 days from invoice date, with a 1.5% monthly finance charge on undisputed overdue balances.";
const IP_OWNERSHIP_TEXT =
  "Intellectual Property. VBT Consulting retains ownership of all background IP and accelerators, while the Client receives a perpetual, irrevocable, worldwide license to use project-specific deliverables upon full payment.";
const LIABILITY_CAP_TEXT =
  "Limitation of Liability. Except for indemnification obligations or cases of gross negligence or willful misconduct, each party's aggregate liability under this Agreement is capped at the greater of the fees paid in the preceding twelve (12) months or $250,000.";
const DATA_RESIDENCY_TEXT =
  "Data Residency. Sensitive customer and financial data will be processed and stored only in regions that align with the Client's residency, sovereignty, and privacy commitments, with encryption enforced in transit and at rest.";
const CHANGE_CONTROL_TEXT =
  "Change Control. Material changes to scope, timeline, staffing, or commercial terms will be documented via a written change request that includes impact analysis and requires mutual approval before execution.";
const EXPENSE_TEXT =
  "Expense Reimbursement. Pre-approved travel or tooling expenses will be invoiced at cost in alignment with Client procurement policy.";

const AGREEMENT_TITLES: Record<AgreementType, string> = {
  [AgreementType.MSA]: "MASTER SERVICES AGREEMENT",
  [AgreementType.NDA]: "NON-DISCLOSURE AGREEMENT",
  [AgreementType.SOW]: "STATEMENT OF WORK",
};

const stageObjectives: Record<EstimateStage, string> = {
  [EstimateStage.ARTIFACTS]:
    "The engagement is in the Artifacts stage, focusing on curating foundational research, current-state references, and baseline constraints before major estimates are produced.",
  [EstimateStage.BUSINESS_CASE]:
    "The engagement is in the Business Case stage, quantifying value hypotheses, ROI, and investment guardrails for executive approval.",
  [EstimateStage.REQUIREMENTS]:
    "The engagement is in the Requirements stage, translating approved strategy into traceable functional and non-functional requirements.",
  [EstimateStage.SOLUTION]:
    "The engagement is in the Solution stage, defining the reference architecture, integration patterns, and delivery approach.",
  [EstimateStage.EFFORT]:
    "The engagement is in the Effort stage, converting solution blueprints into detailed work breakdown structures, staffing plans, and delivery calendars.",
  [EstimateStage.QUOTE]:
    "The engagement is in the Quote stage, finalizing commercial language, contractual terms, and readiness for kickoff.",
};

const stageCadence: Record<EstimateStage, string> = {
  [EstimateStage.ARTIFACTS]: "twice per week",
  [EstimateStage.BUSINESS_CASE]: "weekly",
  [EstimateStage.REQUIREMENTS]: "twice per week",
  [EstimateStage.SOLUTION]: "weekly",
  [EstimateStage.EFFORT]: "three times per week",
  [EstimateStage.QUOTE]: "weekly until signature",
};

const stageScopeBullets: Record<EstimateStage, string[]> = {
  [EstimateStage.ARTIFACTS]: [
    "Catalog legacy documentation, stakeholder interviews, and operational metrics into a versioned repository.",
    "Normalize qualitative findings into structured problem statements, personas, and current-state workflows.",
  ],
  [EstimateStage.BUSINESS_CASE]: [
    "Facilitate workshops with finance and strategy to align benefit hypotheses and investment guardrails.",
    "Model addressable value pools, ramp assumptions, and sensitivity scenarios supporting executive approval.",
  ],
  [EstimateStage.REQUIREMENTS]: [
    "Elicit functional and non-functional requirements, acceptance criteria, and regulatory constraints.",
    "Trace requirements back to approved artifacts to preserve auditability and intent.",
  ],
  [EstimateStage.SOLUTION]: [
    "Produce reference architectures, integration patterns, and technology selections with documented rationale.",
    "Define environment strategy, deployment topologies, and observability hooks for the target solution.",
  ],
  [EstimateStage.EFFORT]: [
    "Translate solution components into estimable work packages with resource assumptions and dependencies.",
    "Sequence workstreams with critical path visibility and staffing mix recommendations.",
  ],
  [EstimateStage.QUOTE]: [
    "Finalize commercial scope, deliverables, and staffing plan derived from validated estimates.",
    "Align legal, procurement, and executive stakeholders on signature-ready contractual language.",
  ],
};

const stageDeliverableBullets: Record<EstimateStage, string[]> = {
  [EstimateStage.ARTIFACTS]: [
    "Curated artifact inventory with metadata regarding owner, freshness, and linkage to requirements.",
    "Executive-ready discovery readout summarizing themes, risks, and open questions.",
    "Initial assumption log capturing scope boundaries, integrations, and technical constraints.",
  ],
  [EstimateStage.BUSINESS_CASE]: [
    "Financial model with scenarios, cash-flow views, and sensitivity toggles.",
    "Benefits narrative tied to KPIs, operating model impacts, and dependency map.",
    "Decision packet highlighting risks, mitigations, and recommendation for investment approval.",
  ],
  [EstimateStage.REQUIREMENTS]: [
    "Prioritized backlog with epics, features, and acceptance criteria.",
    "User journey maps or service blueprints annotated with system interactions and ownership.",
    "Traceability matrix linking requirements to source artifacts, tests, and compliance checkpoints.",
  ],
  [EstimateStage.SOLUTION]: [
    "Architecture decision records and high-level design diagrams with rationale.",
    "Integration catalog covering interfaces, authentication patterns, and SLAs.",
    "Delivery roadmap showing environments, release increments, and cutover plan.",
  ],
  [EstimateStage.EFFORT]: [
    "Detailed WBS with hours by role, estimation notes, and dependency references.",
    "Staffing plan showing ramp schedules, handoffs, and required skill sets.",
    "Program calendar with milestone reviews, demos, and readiness gates.",
  ],
  [EstimateStage.QUOTE]: [
    "Formal quote or SOW draft including scope, exclusions, and commercial model.",
    "Validation memo demonstrating alignment between estimate, quote, and underlying assumptions.",
    "Negotiation tracker capturing outstanding comments, approvals, and decision owners.",
  ],
};

const stageServiceBullets: Record<EstimateStage, string[]> = {
  [EstimateStage.ARTIFACTS]: [
    "Respond to clarification requests within one (1) business day during discovery windows.",
    "Maintain a research repository with access controls and change history.",
  ],
  [EstimateStage.BUSINESS_CASE]: [
    "Provide refreshed financial models within two (2) business days of receiving new inputs.",
    "Facilitate rapid decision checkpoints with documented trade-offs and recommendations.",
  ],
  [EstimateStage.REQUIREMENTS]: [
    "Host daily or twice-weekly refinement sessions while critical stories are drafted.",
    "Turn around requirement clarifications within one (1) business day when feasible.",
  ],
  [EstimateStage.SOLUTION]: [
    "Update design documents within two (2) business days of decision outcomes.",
    "Support architecture reviews with annotated diagrams and decision logs.",
  ],
  [EstimateStage.EFFORT]: [
    "Keep cumulative estimate deltas within +/-5% unless new scope is approved.",
    "Publish weekly burn-up/down views of estimating progress and open questions.",
  ],
  [EstimateStage.QUOTE]: [
    "Provide redline responses within two (2) business days for commercial or legal comments.",
    "Maintain readiness checklist covering insurance, compliance, and onboarding artifacts.",
  ],
};

const stageChangeBullets: Record<EstimateStage, string[]> = {
  [EstimateStage.ARTIFACTS]: [
    "Changes to discovery scope or research targets require steering committee acknowledgement.",
    "New assumptions will be baselined only after joint validation sessions.",
  ],
  [EstimateStage.BUSINESS_CASE]: [
    "Financial guardrails documented in the investment brief trigger change review if exceeded.",
    "Benefit hypotheses adjusted post-workshop must be signed off by finance sponsors.",
  ],
  [EstimateStage.REQUIREMENTS]: [
    "Requirement additions or reprioritizations flow through backlog governance with impact notes.",
    "Regulatory or compliance updates trigger immediate review of affected stories.",
  ],
  [EstimateStage.SOLUTION]: [
    "Architecture shifts require updated ADRs and approval from the joint design authority.",
    "Integration scope changes include dependency analysis for downstream teams.",
  ],
  [EstimateStage.EFFORT]: [
    "Estimate adjustments will cite drivers (scope, complexity, staffing) before adoption.",
    "Cost impacts greater than three percent (3%) prompt executive escalation.",
  ],
  [EstimateStage.QUOTE]: [
    "Any alteration to approved commercial language must be tracked in the negotiation log.",
    "Timeline changes are reflected in both the SOW and program plan before execution.",
  ],
};

const stageSuccessBullets: Record<EstimateStage, string[]> = {
  [EstimateStage.ARTIFACTS]: [
    "Stakeholders confirm that at least ninety-five percent (95%) of known source material is captured and traceable.",
    "Discovery readout accepted with no critical open issues remaining.",
  ],
  [EstimateStage.BUSINESS_CASE]: [
    "Investment committee approves the recommended option with documented ROI.",
    "Sensitivity analysis demonstrates resilience across best, base, and downside scenarios.",
  ],
  [EstimateStage.REQUIREMENTS]: [
    "Priority backlog items include testable acceptance criteria and owner sign-off.",
    "Regulatory and security teams certify requirement coverage against applicable controls.",
  ],
  [EstimateStage.SOLUTION]: [
    "Reference architecture endorsed by enterprise architecture and security stakeholders.",
    "Integration sequencing agreed upon by upstream and downstream system owners.",
  ],
  [EstimateStage.EFFORT]: [
    "WBS totals reconcile to within two percent (2%) of benchmark metrics or prior estimates.",
    "Program calendar approved by delivery leadership with clear gating criteria.",
  ],
  [EstimateStage.QUOTE]: [
    "Client issues commercial approval with fewer than three outstanding comments.",
    "Execution teams confirm readiness to start on the agreed kickoff date.",
  ],
};

const archetypeFocus: Record<
  DemoProjectConfig["archetypeKey"],
  {
    narrative: string;
    scope: string[];
    deliverables: string[];
    service: string[];
    security: string[];
    success: string[];
  }
> = {
  webApp: {
    narrative:
      "The work modernizes a cloud-native web experience that unifies customer, partner, and internal workflows across devices.",
    scope: [
      "Define experience strategy, personas, and prioritized user journeys for the digital product.",
      "Design modular frontend architecture with component library, state management, and accessibility compliance.",
      "Implement API-first backend services that encapsulate ordering, entitlements, or workflow logic.",
      "Instrument telemetry, logging, and experimentation hooks to support data-driven iteration.",
    ],
    deliverables: [
      "Journey maps, wireframes, and high-fidelity UI comps annotated with accessibility and localization notes.",
      "Service contracts, domain models, and API specifications for critical flows.",
      "Infrastructure-as-code blueprints, CI/CD pipelines, and release runbooks.",
    ],
    service: [
      "Adhere to performance budgets (TTFB under 300ms for critical APIs) with automated regression coverage.",
      "Provide proactive monitoring dashboards covering frontend metrics, APIs, and dependencies.",
      "Document incident response procedures with on-call rotations and escalation paths.",
    ],
    security: [
      "Enforce single sign-on with granular authorization tied to roles and attributes.",
      "Apply OWASP ASVS controls, secure coding checklists, and automated dependency scanning.",
      "Record auditable events for authentication, approvals, and financial actions.",
    ],
    success: [
      "Improve conversion, quote cycle time, or adoption metrics relative to baseline.",
      "Enable product teams to release enhancements without vendor lead time.",
      "Reduce manual workarounds by consolidating legacy systems behind the new portal.",
    ],
  },
  dataPlatform: {
    narrative:
      "The work establishes a governed data platform that normalizes ingestion, curation, and analytics for enterprise decision-making.",
    scope: [
      "Ingest and normalize batch and streaming data from POS, ERP, CRM, or IoT systems.",
      "Model curated semantic layers with governed KPI definitions and lineage.",
      "Deliver analytics workbench experiences, dashboards, and data access APIs.",
      "Implement automated data quality, lineage, and observability controls.",
    ],
    deliverables: [
      "Source-to-target mappings, pipeline specifications, and orchestration playbooks.",
      "Dimensional models, metric definitions, and semantic layer documentation.",
      "BI dashboards, notebooks, or APIs with governed access controls and usage tracking.",
    ],
    service: [
      "Maintain data freshness SLAs (for example, hourly updates for operational dashboards).",
      "Provide automated anomaly detection and notification for failed loads.",
      "Offer self-service tools for data stewards to monitor health and certify datasets.",
    ],
    security: [
      "Implement fine-grained access policies down to column or row level where required.",
      "Tokenize or mask sensitive data according to regulatory zones and retention policies.",
      "Maintain lineage metadata for audit and impact analysis across data products.",
    ],
    success: [
      "Stakeholders adopt dashboards weekly with measurable operational changes.",
      "Data quality thresholds (completeness, timeliness, accuracy) stay above agreed baselines.",
      "New data products can be onboarded with minimal engineering lift thanks to reusable pipelines.",
    ],
  },
  mobileApp: {
    narrative:
      "The work delivers a native-quality mobile experience that extends the brand into personalized, location-aware journeys.",
    scope: [
      "Design cross-platform flows for enrollment, ordering, loyalty, and push engagement.",
      "Implement offline-first data synchronization, notifications, and device capability integrations.",
      "Integrate with POS, ordering, and identity providers through secure APIs and event streams.",
      "Define release pipeline covering beta distribution, telemetry, and app-store compliance.",
    ],
    deliverables: [
      "Mobile UX patterns, component guidelines, and motion references for key journeys.",
      "Mobile API contracts, data sync schemas, and caching strategies.",
      "Device test matrices, rollout checklists, and launch communications toolkit.",
    ],
    service: [
      "Maintain crash-free sessions above 99.5% with proactive monitoring and alerting.",
      "Respond to P1 mobile incidents within thirty (30) minutes and provide root cause within twenty-four (24) hours.",
      "Operate beta feedback loops and feature-flag toggles for safe rollout.",
    ],
    security: [
      "Enforce secure storage, certificate pinning, and jailbreak/root detection.",
      "Protect tokens and PII through platform-specific secure enclaves or keychains.",
      "Comply with app-store privacy disclosures and consent requirements for analytics.",
    ],
    success: [
      "Increase mobile adoption, order volume, or engagement minutes quarter over quarter.",
      "Achieve target app-store ratings and retention metrics defined in the business case.",
      "Enable marketing or operations teams to launch campaigns rapidly via CMS or feature toggles.",
    ],
  },
  internalTools: {
    narrative:
      "The work modernizes internal tooling and workflow automation so employees and partners can resolve cases faster with greater context.",
    scope: [
      "Map business processes, personas, and compliance checkpoints across current systems.",
      "Design unified agent or partner workstation experiences that minimize context switching.",
      "Implement workflow orchestration, case management, and collaborative notes.",
      "Integrate with ERP, CRM, HRIS, billing, or network monitoring platforms via secure adapters.",
    ],
    deliverables: [
      "Process blueprints, swim lanes, and RACI models for critical workflows.",
      "Component libraries and UX guidelines tuned for productivity use cases.",
      "Integration specifications, queue definitions, and automation runbooks.",
    ],
    service: [
      "Maintain internal SLAs for request triage, escalation routing, and tooling uptime.",
      "Provide admin tooling for feature flags, routing rules, and knowledge updates.",
      "Bake observability into workflows so supervisors can coach agents in near real time.",
    ],
    security: [
      "Support RBAC/ABAC, field-level security, and audit trails for sensitive actions.",
      "Comply with HR, financial, or telecom regulations depending on the process footprint.",
      "Harden access through MFA, device posture checks, and privileged session monitoring.",
    ],
    success: [
      "Reduce handle time, rework, or manual escalations for targeted workflows.",
      "Improve agent or employee satisfaction scores as captured in quarterly VOC surveys.",
      "Enable faster policy updates without code releases by empowering business admins.",
    ],
  },
};

const ARTIFACT_UPLOAD_ROOT = path.join(process.cwd(), "uploads", "artifacts");

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const ESTIMATE_STAGE_SEQUENCE: EstimateStage[] = [
  EstimateStage.ARTIFACTS,
  EstimateStage.BUSINESS_CASE,
  EstimateStage.REQUIREMENTS,
  EstimateStage.SOLUTION,
  EstimateStage.EFFORT,
  EstimateStage.QUOTE,
];

const stageIndexByStage = new Map(
  ESTIMATE_STAGE_SEQUENCE.map((stage, index) => [stage, index]),
);

function hasReachedStage(
  currentStage: EstimateStage,
  targetStage: EstimateStage,
): boolean {
  const currentIndex = stageIndexByStage.get(currentStage);
  const targetIndex = stageIndexByStage.get(targetStage);

  if (currentIndex === undefined || targetIndex === undefined) {
    return false;
  }

  return currentIndex >= targetIndex;
}

type SeededWbsItem = {
  task: string;
  role: string;
  hours: number;
};

type SeededProjectRecord = {
  project: {
    id: string;
    name: string;
    clientName: string | null;
    stage: EstimateStage;
  };
  config: DemoProjectConfig;
  hasQuote: boolean;
  quoteTotal?: number | null;
  paymentTerms?: string | null;
  timeline?: string | null;
  wbsItems?: SeededWbsItem[];
};

function formatBulletList(rawItems: string[]): string {
  const seen = new Set<string>();
  const items = rawItems
    .map((item) => item?.trim())
    .filter((item): item is string => {
      if (!item) {
        return false;
      }
      if (seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });

  if (items.length === 0) {
    return "  (1) Details to be defined jointly.";
  }

  return items
    .map((item, idx) => {
      const lines = item.split("\n").map((line) => line.trim());
      const [first, ...rest] = lines;
      const bullet = `  (${idx + 1}) ${first}`;
      const continuation = rest.map((line) => `      ${line}`).join("\n");
      return continuation ? `${bullet}\n${continuation}` : bullet;
    })
    .join("\n");
}

function slugify(value: string, fallback = "artifact") {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || fallback
  );
}

function ensureArtifactText(content?: string) {
  const normalized = content?.trim();
  if (normalized?.length) {
    return normalized;
  }
  return "Demo artifact generated for Project Apollo seed.";
}

function getStageIndex(stage: EstimateStage) {
  return stageIndexByStage.get(stage) ?? 0;
}

function stageReached(current: EstimateStage, target: EstimateStage) {
  return getStageIndex(current) >= getStageIndex(target);
}

function stageApproved(current: EstimateStage, target: EstimateStage) {
  return getStageIndex(current) > getStageIndex(target);
}

async function writeArtifactFile(
  projectId: string,
  artifact: DemoArtifact,
  seedKey: string,
) {
  const originalName = artifact.originalName ?? `${artifact.type}.txt`;
  const extension = (path.extname(originalName) || ".txt").toLowerCase();
  const normalizedExtension =
    MIME_TYPE_BY_EXTENSION[extension] ? extension : ".txt";
  const fileName = `${slugify(seedKey)}${normalizedExtension}`;
  const storedFile = path.posix.join(projectId, fileName);
  const absolutePath = path.join(ARTIFACT_UPLOAD_ROOT, projectId, fileName);

  await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(ensureArtifactText(artifact.content), "utf-8");
  await fsPromises.writeFile(absolutePath, buffer);

  return {
    storedFile,
    sizeBytes: buffer.byteLength,
    mimeType:
      MIME_TYPE_BY_EXTENSION[normalizedExtension] ?? "application/octet-stream",
    originalName,
  };
}

async function seedArtifactsForProject(
  projectId: string,
  artifacts: DemoArtifact[],
  seedKey: string,
) {
  if (artifacts.length === 0) {
    return;
  }

  for (const [index, artifact] of artifacts.entries()) {
    const fileMetadata = await writeArtifactFile(
      projectId,
      artifact,
      `${seedKey}-${index + 1}`,
    );

    await prisma.artifact.create({
      data: {
        projectId,
        type: artifact.type,
        originalName: fileMetadata.originalName,
        content: ensureArtifactText(artifact.content),
        storedFile: fileMetadata.storedFile,
        mimeType: fileMetadata.mimeType,
        sizeBytes: fileMetadata.sizeBytes,
      },
    });
  }
}

function collectDiscoveryNotes(config: DemoProjectConfig) {
  return config.artifacts
    .slice(0, 2)
    .map(
      (artifact, index) =>
        `### Discovery Insight ${index + 1}\n${ensureArtifactText(artifact.content)}`,
    )
    .join("\n\n");
}

function buildBusinessCaseDraft(config: DemoProjectConfig) {
  const focus = archetypeFocus[config.archetypeKey];
  const discoverySummary = collectDiscoveryNotes(config);

  return [
    `# ${config.name} Business Case`,
    `Client: ${config.clientName}`,
    `## Engagement Narrative`,
    focus.narrative,
    stageObjectives[EstimateStage.BUSINESS_CASE],
    discoverySummary,
    "## Scope & Priorities",
    formatBulletList([
      ...focus.scope.slice(0, 3),
      ...stageScopeBullets[EstimateStage.BUSINESS_CASE],
    ]),
    "## Expected Deliverables",
    formatBulletList(stageDeliverableBullets[EstimateStage.BUSINESS_CASE]),
    "## Success Criteria",
    formatBulletList(stageSuccessBullets[EstimateStage.BUSINESS_CASE]),
  ].join("\n\n");
}

function buildRequirementsDraft(config: DemoProjectConfig) {
  const focus = archetypeFocus[config.archetypeKey];
  return [
    `# ${config.name} Requirements`,
    `Client: ${config.clientName}`,
    "## User Journeys & Personas",
    formatBulletList(focus.scope),
    "## Functional Requirements",
    formatBulletList(stageDeliverableBullets[EstimateStage.REQUIREMENTS]),
    "## Non-Functional Requirements",
    formatBulletList([
      ...focus.security.slice(0, 3),
      ...stageServiceBullets[EstimateStage.REQUIREMENTS],
    ]),
    "## Success Measurements",
    formatBulletList(stageSuccessBullets[EstimateStage.REQUIREMENTS]),
  ].join("\n\n");
}

function buildSolutionDraft(config: DemoProjectConfig) {
  const focus = archetypeFocus[config.archetypeKey];
  return [
    `# ${config.name} Solution Architecture`,
    `Client: ${config.clientName}`,
    "## Architecture Overview",
    focus.narrative,
    stageObjectives[EstimateStage.SOLUTION],
    "## System Components",
    formatBulletList(stageDeliverableBullets[EstimateStage.SOLUTION]),
    "## Integration & Operations",
    formatBulletList(stageServiceBullets[EstimateStage.SOLUTION]),
    "## Change & Success Guardrails",
    formatBulletList([
      ...stageChangeBullets[EstimateStage.SOLUTION],
      ...stageSuccessBullets[EstimateStage.SOLUTION],
    ]),
  ].join("\n\n");
}

async function seedBusinessCaseNarrative(
  projectId: string,
  config: DemoProjectConfig,
  currentStage: EstimateStage,
) {
  if (!stageReached(currentStage, EstimateStage.BUSINESS_CASE)) {
    return;
  }

  const approved = stageApproved(currentStage, EstimateStage.BUSINESS_CASE);
  const existing = await prisma.businessCase.findUnique({
    where: { projectId },
  });
  const content = buildBusinessCaseDraft(config);

  if (!existing) {
    await prisma.businessCase.create({
      data: { projectId, content, approved },
    });
    return;
  }

  const updates: { content?: string; approved?: boolean } = {};
  if (!existing.content?.trim()) {
    updates.content = content;
  }
  if (approved && !existing.approved) {
    updates.approved = true;
  }

  if (Object.keys(updates).length > 0) {
    await prisma.businessCase.update({
      where: { projectId },
      data: updates,
    });
  }
}

async function seedRequirementsNarrative(
  projectId: string,
  config: DemoProjectConfig,
  currentStage: EstimateStage,
) {
  if (!stageReached(currentStage, EstimateStage.REQUIREMENTS)) {
    return;
  }

  const approved = stageApproved(currentStage, EstimateStage.REQUIREMENTS);
  const existing = await prisma.requirements.findUnique({
    where: { projectId },
  });
  const content = buildRequirementsDraft(config);

  if (!existing) {
    await prisma.requirements.create({
      data: { projectId, content, approved },
    });
    return;
  }

  const updates: { content?: string; approved?: boolean } = {};
  if (!existing.content?.trim()) {
    updates.content = content;
  }
  if (approved && !existing.approved) {
    updates.approved = true;
  }

  if (Object.keys(updates).length > 0) {
    await prisma.requirements.update({
      where: { projectId },
      data: updates,
    });
  }
}

async function seedSolutionNarrative(
  projectId: string,
  config: DemoProjectConfig,
  currentStage: EstimateStage,
) {
  if (!stageReached(currentStage, EstimateStage.SOLUTION)) {
    return;
  }

  const approved = stageApproved(currentStage, EstimateStage.SOLUTION);
  const existing = await prisma.solutionArchitecture.findUnique({
    where: { projectId },
  });
  const content = buildSolutionDraft(config);

  if (!existing) {
    await prisma.solutionArchitecture.create({
      data: { projectId, content, approved },
    });
    return;
  }

  const updates: { content?: string; approved?: boolean } = {};
  if (!existing.content?.trim()) {
    updates.content = content;
  }
  if (approved && !existing.approved) {
    updates.approved = true;
  }

  if (Object.keys(updates).length > 0) {
    await prisma.solutionArchitecture.update({
      where: { projectId },
      data: updates,
    });
  }
}

async function seedNarrativesForProject(
  projectId: string,
  config: DemoProjectConfig,
  currentStage: EstimateStage,
) {
  await seedBusinessCaseNarrative(projectId, config, currentStage);
  await seedRequirementsNarrative(projectId, config, currentStage);
  await seedSolutionNarrative(projectId, config, currentStage);
}

async function seedStageTransitions(
  projectId: string,
  currentStage: EstimateStage,
) {
  const targetIndex = getStageIndex(currentStage);
  await prisma.stageTransition.deleteMany({ where: { projectId } });
  if (targetIndex === 0) {
    return;
  }

  const transitions = [];
  const now = Date.now();

  for (let index = 0; index < targetIndex; index += 1) {
    const from = ESTIMATE_STAGE_SEQUENCE[index];
    const to = ESTIMATE_STAGE_SEQUENCE[index + 1];
    transitions.push({
      projectId,
      from,
      to,
      timestamp: new Date(
        now - (targetIndex - index) * 24 * 60 * 60 * 1000 + index * 60 * 60 * 1000,
      ),
    });
  }

  await prisma.stageTransition.createMany({ data: transitions });
}

async function createAgreementWithVersion({
  projectId,
  type,
  status,
  counterparty,
  content,
  reviewData,
  changeNote,
}: {
  projectId?: string | null;
  type: AgreementType;
  status: AgreementStatus;
  counterparty: string;
  content: string;
  reviewData?: Prisma.JsonValue;
  changeNote: string;
}) {
  const agreement = await prisma.agreement.create({
    data: {
      projectId: projectId ?? undefined,
      type,
      counterparty,
      status,
      reviewData: reviewData ?? undefined,
    },
  });

  await prisma.agreementVersion.create({
    data: {
      agreementId: agreement.id,
      versionNumber: 1,
      content,
      changeNote,
    },
  });
}

async function seedAgreementsForProjects(projects: SeededProjectRecord[]) {
  for (const [projectIndex, entry] of projects.entries()) {
    const { project, config, hasQuote, quoteTotal } = entry;
    const existingAgreements = await prisma.agreement.findMany({
      where: { projectId: project.id },
      select: { id: true },
    });

    if (existingAgreements.length > 0) {
      const ids = existingAgreements.map((a) => a.id);
      await prisma.agreementVersion.deleteMany({
        where: { agreementId: { in: ids } },
      });
      await prisma.agreement.deleteMany({ where: { id: { in: ids } } });
    }

    const agreementContext = ensureAgreementContext(config, {
      name: project.name,
      clientName: project.clientName ?? undefined,
      stage: project.stage,
    });
    const counterparty =
      agreementContext.clientName ?? `${project.name} Counterparty`;
    const stageIsAtLeast = (targetStage: EstimateStage) =>
      hasReachedStage(project.stage, targetStage);
    const msaStatus = stageIsAtLeast(EstimateStage.SOLUTION)
      ? AgreementStatus.APPROVED
      : AgreementStatus.REVIEW;
    const msaReviewData =
      msaStatus === AgreementStatus.REVIEW
        ? {
            proposals: buildStandardProposals(),
          }
        : undefined;
    const msaChangeNote =
      msaStatus === AgreementStatus.REVIEW
        ? "Incoming 1"
        : "Baseline MSA executed";

    await createAgreementWithVersion({
      projectId: null,
      type: AgreementType.MSA,
      status: msaStatus,
      counterparty,
      content: generateAgreementContent(agreementContext, AgreementType.MSA),
      reviewData: msaReviewData,
      changeNote: msaChangeNote,
    });

    if (hasQuote) {
      const estimateReviewData = buildEstimateReviewData({
        projectName: project.name,
        quoteTotal,
        paymentTerms: entry.paymentTerms,
        timeline: entry.timeline,
        wbsItems: entry.wbsItems,
      });

      const sowLinkedToEstimate =
        estimateReviewData && projectIndex % 2 === 0;
      const sowStatus =
        estimateReviewData && !stageIsAtLeast(EstimateStage.QUOTE)
          ? AgreementStatus.REVIEW
          : AgreementStatus.APPROVED;
      const sowReviewData =
        sowStatus === AgreementStatus.REVIEW ? estimateReviewData ?? undefined : undefined;
      const sowChangeNote =
        sowStatus === AgreementStatus.REVIEW
          ? sowLinkedToEstimate
            ? "Estimate-aligned draft pending review"
            : "Awaiting estimate linkage"
          : "Approved SOW aligned with signed quote";

      await createAgreementWithVersion({
        projectId: sowLinkedToEstimate ? project.id : null,
        type: AgreementType.SOW,
        status: sowStatus,
        counterparty,
        content: generateAgreementContent(agreementContext, AgreementType.SOW),
        reviewData: sowReviewData,
        changeNote: sowChangeNote,
      });
    }
  }
}

function ensureAgreementContext(
  config: DemoProjectConfig | undefined,
  fallback?: AgreementFallback,
): AgreementContext {
  if (config) {
    return {
      ...config,
      artifacts: [...(config.artifacts ?? [])],
    };
  }

  const fallbackName = fallback?.name ?? "Seed Project";
  const key = fallbackName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return {
    key,
    name: fallbackName,
    clientName: fallback?.clientName ?? "Seed Client",
    stage: fallback?.stage ?? EstimateStage.QUOTE,
    archetypeKey: fallback?.archetypeKey ?? "webApp",
    artifacts: [],
  };
}

function generateAgreementContent(
  context: AgreementContext,
  type: AgreementType,
): string {
  const header = AGREEMENT_TITLES[type] ?? "MASTER SERVICES AGREEMENT";
  const scopeItems = [
    ...archetypeFocus[context.archetypeKey].scope,
    ...stageScopeBullets[context.stage],
  ];
  const deliverableItems = [
    ...archetypeFocus[context.archetypeKey].deliverables,
    ...stageDeliverableBullets[context.stage],
  ];
  const serviceItems = [
    ...archetypeFocus[context.archetypeKey].service,
    ...stageServiceBullets[context.stage],
  ];
  const successItems = [
    ...archetypeFocus[context.archetypeKey].success,
    ...stageSuccessBullets[context.stage],
  ];
  const changeSection = [
    formatBulletList(stageChangeBullets[context.stage]),
    CHANGE_CONTROL_TEXT,
  ]
    .filter(Boolean)
    .join("\n");
  const securitySection = [
    formatBulletList(archetypeFocus[context.archetypeKey].security),
    DATA_RESIDENCY_TEXT,
  ]
    .filter(Boolean)
    .join("\n");

  const discoveryNarrative = [
    context.artifacts[0]?.content?.trim(),
    context.artifacts[1]?.content?.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  const exhibitContent =
    context.artifacts.length > 0
      ? context.artifacts
          .map(
            (artifact, idx) =>
              `A.${idx + 1} ${artifact.originalName}\n${artifact.content.trim()}`,
          )
          .join("\n\n")
      : "Artifacts and discovery notes will be appended once available. Parties agree to treat future exhibits as incorporated herein.";

  return [
    header,
    "",
    `This ${header} ("Agreement") is entered into as of the Effective Date between ${PROVIDER_NAME} ("Provider") and ${context.clientName} ("Client") for the ${context.name} engagement.`,
    "",
    "1. BACKGROUND AND OBJECTIVES",
    [
      `${PROVIDER_NAME} will partner with ${context.clientName} to deliver the ${context.name} initiative.`,
      archetypeFocus[context.archetypeKey].narrative,
      stageObjectives[context.stage],
    ]
      .filter(Boolean)
      .join(" "),
    "",
    "2. DISCOVERY INSIGHTS",
    discoveryNarrative ||
      "Stakeholder discovery is ongoing and will be summarized within Exhibit A once compiled.",
    "",
    "3. SCOPE OF SERVICES",
    formatBulletList(scopeItems),
    "",
    "4. DELIVERABLES AND MILESTONES",
    formatBulletList(deliverableItems),
    "",
    "5. GOVERNANCE AND COLLABORATION",
    formatBulletList([
      `Provider and Client will hold standing status reviews ${stageCadence[context.stage]} covering schedule, risks, decisions, and dependencies.`,
      "Each workshop or interview will produce written notes within twenty-four (24) hours and be archived in the shared knowledge base.",
      "The joint steering committee will review RAID logs, staffing, and budget deltas at least bi-weekly.",
    ]),
    "",
    "6. SERVICE LEVELS AND OPERATIONS",
    formatBulletList(serviceItems),
    "",
    "7. CHANGE MANAGEMENT AND ASSUMPTIONS",
    changeSection,
    "",
    "8. SECURITY, PRIVACY, AND COMPLIANCE",
    securitySection,
    "",
    "9. PAYMENT AND COMMERCIAL TERMS",
    `${PAYMENT_TERMS_TEXT}\n${EXPENSE_TEXT}`,
    "",
    "10. INTELLECTUAL PROPERTY AND DATA RIGHTS",
    IP_OWNERSHIP_TEXT,
    "",
    "11. LIMITATION OF LIABILITY",
    LIABILITY_CAP_TEXT,
    "",
    "12. SUCCESS METRICS",
    formatBulletList(successItems),
    "",
    "13. EXHIBIT A – DISCOVERY REFERENCES",
    exhibitContent,
  ]
    .filter((section) => section !== undefined)
    .join("\n\n")
    .trim();
}

function buildStandardProposals() {
  return [
    {
      originalText: PAYMENT_TERMS_TEXT,
      proposedText:
        "Payment Terms. Unless otherwise noted, invoices are due Net 45 days from invoice date, with a 1.0% monthly finance charge on undisputed overdue balances.",
      rationale: "Client accounting policy requires forty-five day terms.",
    },
    {
      originalText: IP_OWNERSHIP_TEXT,
      proposedText:
        "Intellectual Property. Client shall receive a perpetual, worldwide, royalty-free, and transferable license to both background IP and project-specific deliverables upon payment.",
      rationale: "Client seeks broader usage rights for internal frameworks and derivatives.",
    },
    {
      originalText: DATA_RESIDENCY_TEXT,
      proposedText:
        "Data Residency. All production workloads and backups associated with this engagement must remain within EU sovereign regions, with no replication to jurisdictions outside the EEA.",
      rationale: "Client is subject to EU data-sovereignty regulations.",
    },
  ];
}

type EstimateReviewDataInput = {
  projectName: string;
  quoteTotal?: number | null;
  paymentTerms?: string | null;
  timeline?: string | null;
  wbsItems?: SeededWbsItem[];
};

function buildEstimateReviewData(
  input: EstimateReviewDataInput,
): Prisma.JsonValue | null {
  if (!input.quoteTotal) {
    return null;
  }

  const formattedTotal = `$${Number(input.quoteTotal).toLocaleString()}`;
  const highlightedTasks = (input.wbsItems ?? [])
    .slice(0, 3)
    .map(
      (item) =>
        `${item.task} (${item.role}${item.hours ? `, ${item.hours}h` : ""})`,
    )
    .join("; ");

  const scopeSentence = highlightedTasks
    ? `Baseline scope includes ${highlightedTasks}.`
    : "Baseline scope references the linked estimate work packages.";

  const paymentTerms = input.paymentTerms ?? "Net 30";
  const timeline = input.timeline ?? "the planned delivery window";

  return {
    source: "estimate_auto_review",
    summary: `Auto-generated proposals to align the ${input.projectName} SOW with the linked estimate (${formattedTotal}).`,
    proposals: [
      {
        originalText: PAYMENT_TERMS_TEXT,
        proposedText: `Payment Terms. The fixed fee for this engagement is ${formattedTotal}, invoiced at milestone acceptance and due ${paymentTerms} with a 1.0% monthly finance charge on undisputed overdue balances.`,
        rationale:
          "Keep payment language in sync with the approved quote total and cadence.",
      },
      {
        originalText: CHANGE_CONTROL_TEXT,
        proposedText: `${scopeSentence} Change requests that alter WBS packages, staffing, or ${timeline} will include cost deltas and dependency impacts before approval.`,
        rationale:
          "Tie change-control language back to the estimate baseline so scope shifts highlight impact to cost and schedule.",
      },
    ],
  };
}

export async function seedDemoData() {
  console.log("Seeding Project Apollo Demo Data...");

  const demoProjects = loadDemoProjects();
  const seededProjects: SeededProjectRecord[] = [];

  // 1. Ensure Roles Exist
  const roles = [
    { name: "Backend Engineer", rate: 150.0 },
    { name: "Frontend Engineer", rate: 130.0 },
    { name: "Project Manager", rate: 110.0 },
    { name: "Designer", rate: 120.0 },
    { name: "QA Engineer", rate: 100.0 },
  ];

  const roleMap: Record<string, string> = {};

  for (const r of roles) {
    // Upsert to avoid duplicates
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { rate: r.rate },
      create: { name: r.name, rate: r.rate },
    });
    roleMap[r.name] = role.id;
  }

  // 2. Create Project Apollo (driven by JSON config)
  const apolloConfig = demoProjects.projects.find(
    (p) => p.key === "apollo",
  );
  if (!apolloConfig) {
    throw new Error("Apollo demo project configuration not found in demoProjects.json");
  }

  // Check if exists first to prevent duplicates on re-runs
  let project = await prisma.project.findFirst({
    where: { name: apolloConfig.name },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: apolloConfig.name,
        clientName: apolloConfig.clientName,
        stage: apolloConfig.stage,
      },
    });
  } else if (project.stage !== apolloConfig.stage) {
    project = await prisma.project.update({
      where: { id: project.id },
      data: { stage: apolloConfig.stage },
    });
  }

  await seedStageTransitions(project.id, apolloConfig.stage);

  // 3. Create Artifacts (from JSON content)
  await prisma.artifact.deleteMany({ where: { projectId: project.id } });
  await seedArtifactsForProject(project.id, apolloConfig.artifacts, apolloConfig.key);
  await seedNarrativesForProject(project.id, apolloConfig, apolloConfig.stage);

  // 4. Create WBS Items
  // Clear existing WBS to ensure clean state for totals
  await prisma.wBSItem.deleteMany({ where: { projectId: project.id } });

  const wbsItems = [
    { task: "Setup CI/CD Pipeline", role: "Backend Engineer", hours: 8 },
    { task: "Database Schema Design", role: "Backend Engineer", hours: 16 },
    { task: "API Implementation (Auth, Orders)", role: "Backend Engineer", hours: 40 },
    { task: "Frontend Shell & Navigation", role: "Frontend Engineer", hours: 24 },
    { task: "Order Dashboard UI", role: "Frontend Engineer", hours: 32 },
    { task: "Mobile Responsiveness", role: "Designer", hours: 16 },
    { task: "Project Management & Sprint Planning", role: "Project Manager", hours: 20 },
  ];

  for (const item of wbsItems) {
    await prisma.wBSItem.create({
      data: {
        projectId: project.id,
        task: item.task,
        hours: item.hours,
        roleId: roleMap[item.role],
        roleName: item.role,
      },
    });
  }

  // 5. Create Quote (Calculated)
  let total = 0;
  const rates: Record<string, number> = {};

  for (const item of wbsItems) {
    const r = roles.find((r) => r.name === item.role);
    if (r) {
      const cost = item.hours * r.rate;
      total += cost;
      rates[item.role] = (rates[item.role] || 0) + cost;
    }
  }

  // Upsert Quote
  const existingQuote = await prisma.quote.findUnique({ where: { projectId: project.id } });
  if (existingQuote) {
    await prisma.quote.update({
      where: { id: existingQuote.id },
      data: {
        total,
        rates,
        paymentTerms: "Net 30",
        timeline: "6 weeks",
      },
    });
  } else {
    await prisma.quote.create({
      data: {
        projectId: project.id,
        total,
        rates,
        paymentTerms: "Net 30",
        timeline: "6 weeks",
      },
    });
  }

  seededProjects.push({
    project,
    config: apolloConfig,
    hasQuote: true,
    quoteTotal: total,
    paymentTerms: "Net 30",
    timeline: "6 weeks",
    wbsItems: wbsItems.map((item) => ({
      task: item.task,
      role: item.role,
      hours: item.hours,
    })),
  });

  // 6. Seed additional Estimates in different stages with varied contexts
  console.log("Seeding additional demo estimates and contracts...");

  const estimateStages: EstimateStage[] = [
    EstimateStage.ARTIFACTS,
    EstimateStage.BUSINESS_CASE,
    EstimateStage.REQUIREMENTS,
    EstimateStage.SOLUTION,
    EstimateStage.EFFORT,
    EstimateStage.QUOTE,
  ];

  const wbsTemplates: Record<
    string,
    { task: string; role: string; hours: number }[]
  > = {
    webApp: [
      { task: "Discovery & technical spike", role: "Project Manager", hours: 12 },
      { task: "Auth & identity integration", role: "Backend Engineer", hours: 32 },
      { task: "Order management APIs", role: "Backend Engineer", hours: 40 },
      { task: "Responsive shell & layout", role: "Frontend Engineer", hours: 28 },
      { task: "Design system & components", role: "Designer", hours: 24 },
      { task: "End-to-end regression pass", role: "QA Engineer", hours: 24 },
    ],
    dataPlatform: [
      { task: "Ingestion pipeline design", role: "Backend Engineer", hours: 32 },
      { task: "Warehouse schema modeling", role: "Backend Engineer", hours: 24 },
      { task: "Dashboard & reporting views", role: "Frontend Engineer", hours: 32 },
      { task: "Data quality test harness", role: "QA Engineer", hours: 20 },
      { task: "Stakeholder workshops", role: "Project Manager", hours: 16 },
    ],
    mobileApp: [
      { task: "Offline data sync design", role: "Backend Engineer", hours: 28 },
      { task: "Mobile app shell & navigation", role: "Frontend Engineer", hours: 32 },
      { task: "Job detail & checklist screens", role: "Frontend Engineer", hours: 24 },
      { task: "Visual design for mobile", role: "Designer", hours: 20 },
      { task: "Device compatibility testing", role: "QA Engineer", hours: 24 },
      { task: "Rollout planning", role: "Project Manager", hours: 12 },
    ],
    internalTools: [
      { task: "Workflow mapping workshops", role: "Project Manager", hours: 16 },
      { task: "Admin UI for case management", role: "Frontend Engineer", hours: 32 },
      { task: "Integrations with core systems", role: "Backend Engineer", hours: 36 },
      { task: "UX polish & usability testing", role: "Designer", hours: 20 },
      { task: "Smoke & regression tests", role: "QA Engineer", hours: 20 },
    ],
  };

  // Role lookups for WBS/Quote generation
  const existingRoles = await prisma.role.findMany();
  const roleIdByName: Record<string, string> = {};
  const roleRateByName: Record<string, number> = {};
  for (const r of existingRoles) {
    roleIdByName[r.name] = r.id;
    // Prisma Decimal -> number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    roleRateByName[r.name] = Number((r as any).rate ?? 0);
  }

  // Create additional projects based on JSON configuration (excluding Apollo)
  const additionalProjectsConfig = demoProjects.projects.filter(
    (p) => p.key !== "apollo",
  );

  for (const config of additionalProjectsConfig) {
    let extraProject = await prisma.project.findFirst({
      where: { name: config.name },
    });
    if (!extraProject) {
      extraProject = await prisma.project.create({
        data: {
          name: config.name,
          clientName: config.clientName,
          stage: config.stage,
        },
      });
    } else if (extraProject.stage !== config.stage) {
      extraProject = await prisma.project.update({
        where: { id: extraProject.id },
        data: { stage: config.stage },
      });
    }

    await seedStageTransitions(extraProject.id, config.stage);
    await prisma.artifact.deleteMany({ where: { projectId: extraProject.id } });
    await seedArtifactsForProject(extraProject.id, config.artifacts, config.key);
    await seedNarrativesForProject(extraProject.id, config, config.stage);

    let hasQuote = false;
    let latestQuoteTotal: number | null = null;
    let paymentTerms: string | null = null;
    let timeline: string | null = null;
    let insertedWbs: SeededWbsItem[] = [];

    // For later-stage estimates, seed WBS + Quote so SOWs can be validated against them
    if (
      config.stage === EstimateStage.EFFORT ||
      config.stage === EstimateStage.QUOTE
    ) {
      const template = wbsTemplates[config.archetypeKey];
      if (template && template.length > 0) {
        await prisma.wBSItem.deleteMany({ where: { projectId: extraProject.id } });
        insertedWbs = [];

        let total = 0;
        const roleTotals: Record<string, number> = {};
        // Vary project size slightly using a deterministic multiplier based on name hash
        const hash =
          config.name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
          4;
        const sizeMultiplier = 0.75 + hash * 0.25; // 0.75, 1.0, 1.25, 1.5

        for (const base of template) {
          const roleId = roleIdByName[base.role];
          const rate = roleRateByName[base.role] ?? 0;
          if (!roleId || !rate) continue;

          const hours = Math.round(base.hours * sizeMultiplier * 10) / 10;

          await prisma.wBSItem.create({
            data: {
              projectId: extraProject.id,
              task: base.task,
              hours,
              roleId,
              roleName: base.role,
            },
          });
          insertedWbs.push({ task: base.task, role: base.role, hours });

          const cost = hours * rate;
          total += cost;
          roleTotals[base.role] = (roleTotals[base.role] || 0) + cost;
        }

        const existingQuoteForProject = await prisma.quote.findUnique({
          where: { projectId: extraProject.id },
        });

        const quoteData = {
          total,
          rates: roleTotals,
          paymentTerms: "Net 30",
          timeline:
            config.stage === EstimateStage.EFFORT ? "6-8 weeks" : "4-6 weeks",
        };

        if (existingQuoteForProject) {
          await prisma.quote.update({
            where: { id: existingQuoteForProject.id },
            data: quoteData,
          });
        } else {
          await prisma.quote.create({
            data: {
              projectId: extraProject.id,
              ...quoteData,
            },
          });
        }

        hasQuote = true;
        latestQuoteTotal = total;
        paymentTerms = quoteData.paymentTerms;
        timeline = quoteData.timeline;
      }
    }
    seededProjects.push({
      project: extraProject,
      config,
      hasQuote,
      quoteTotal: latestQuoteTotal,
      paymentTerms,
      timeline,
      wbsItems: insertedWbs.length > 0 ? insertedWbs : undefined,
    });
  }

  await seedAgreementsForProjects(seededProjects);

  console.log("✅ Project Apollo Demo Data Seeded.");
}

// If run directly
if (require.main === module) {
  seedDemoData()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}

