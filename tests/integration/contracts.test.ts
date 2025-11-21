import { contractsService } from "@/lib/services/contractsService";
import { estimatesService } from "@/lib/services/estimatesService";
import { validateAgreementAgainstEstimate } from "@/lib/services/validationService";
import { prisma } from "@/lib/db";

// Mock Prisma to avoid actual DB calls during unit tests if preferred,
// but for integration tests we usually want a real DB or a test DB.
// Assuming we are running against a test DB environment.

describe("Contracts Workflow Integration", () => {
  let projectId: string;
  let agreementId: string;
  let roleId: string;

  beforeAll(async () => {
    // Cleanup - Order matters due to FK constraints
    await prisma.agreementVersion.deleteMany();
    await prisma.agreement.deleteMany();
    
    // Clean up project related tables
    await prisma.wBSItem.deleteMany();
    await prisma.quote.deleteMany();
    await prisma.artifact.deleteMany();
    await prisma.businessCase.deleteMany();
    await prisma.requirements.deleteMany();
    await prisma.solutionArchitecture.deleteMany();
    await prisma.stageTransition.deleteMany();
    
    await prisma.project.deleteMany();
    await prisma.policyRule.deleteMany();
    await prisma.role.deleteMany();

    // Setup Policy
    await contractsService.createPolicy({
      description: "Payment terms must be Net 30",
    });

    // Setup Role
    const role = await estimatesService.createRole({
      name: "Senior Engineer",
      rate: 150,
    });
    roleId = role.id;
  });

  test("1. Create Estimate Project", async () => {
    const project = await estimatesService.createProject({
      name: "Integration Test Project",
      clientName: "Test Client",
    });
    projectId = project.id;
    expect(project.id).toBeDefined();
  });

  test("2. Create Agreement linked to Project", async () => {
    const agreement = await contractsService.createAgreement({
      type: "SOW",
      counterparty: "Test Client",
      projectId: projectId,
    });
    agreementId = agreement.id;
    expect(agreement.id).toBeDefined();
    expect(agreement.projectId).toBe(projectId);
    expect(agreement.status).toBe("APPROVED");
  });

  test("3. Versioning - Initial State", async () => {
    const agreement = await contractsService.getAgreement(agreementId);
    expect(agreement?.versions).toHaveLength(1);
    expect(agreement?.versions[0].versionNumber).toBe(1);
    expect(agreement?.versions[0].content).toBe("");
  });

  test("4. Create New Version", async () => {
    const v2 = await contractsService.createVersion({
      agreementId,
      content: "Draft content v2",
      changeNote: "Manual update",
    });
    expect(v2.versionNumber).toBe(2);

    const agreement = await contractsService.getAgreement(agreementId);
    expect(agreement?.versions).toHaveLength(2);
    expect(agreement?.versions[0].versionNumber).toBe(2); // Latest first
  });

  test("5. Validation Logic (Empty Estimate)", async () => {
    const result = await validateAgreementAgainstEstimate(agreementId);
    // Should be valid because estimate has no data yet
    expect(result.valid).toBe(true);
  });

  test("6. Validation Logic (With Estimate Data)", async () => {
    // Add Quote data to project
    await prisma.quote.create({
      data: {
        projectId,
        total: 10000,
        paymentTerms: "Net 30",
        timeline: "2 weeks",
      },
    });

    // Add WBS Item with valid Role
    await prisma.wBSItem.create({
      data: {
        projectId,
        task: "Backend Dev",
        roleName: "Senior Engineer",
        roleId: roleId,
        hours: 10,
      },
    });

    // Validate against current agreement content "Draft content v2"
    // Should fail because it doesn't contain "$10,000" or "Net 30"
    const result = await validateAgreementAgainstEstimate(agreementId);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]).toContain("Total cost");
  });

  test("7. Validation Logic (Success Case)", async () => {
    // Update agreement to match estimate
    await contractsService.createVersion({
      agreementId,
      content: "Total Cost: $10,000. Payment Terms: Net 30. Role: Senior Engineer.",
      changeNote: "Fix validation issues",
    });

    const result = await validateAgreementAgainstEstimate(agreementId);
    expect(result.valid).toBe(true);
  });

  test("8. Enforces sequential agreement status transitions", async () => {
    const review = await contractsService.updateAgreementStatus({
      id: agreementId,
      status: "REVIEW",
    });
    expect(review.status).toBe("REVIEW");

    const approved = await contractsService.updateAgreementStatus({
      id: agreementId,
      status: "APPROVED",
    });
    expect(approved.status).toBe("APPROVED");
  });

  test("9. Blocks contract edits after approval", async () => {
    await expect(
      contractsService.createVersion({
        agreementId,
        content: "Post-approval change",
      }),
    ).rejects.toThrow("Agreement");

    await expect(
      contractsService.updateAgreementNotes(agreementId, "Should not persist"),
    ).rejects.toThrow("Agreement");
  });
});
