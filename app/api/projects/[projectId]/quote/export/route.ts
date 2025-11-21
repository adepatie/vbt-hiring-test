import { NextRequest, NextResponse } from "next/server";
import { estimatesService } from "@/lib/services/estimatesService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "csv";

  try {
    const exportData = await estimatesService.getQuoteForExport(projectId);

    if (format === "csv") {
      const csvRows: string[] = [];
      csvRows.push("Project Quote Export");
      csvRows.push(`Project: ${exportData.projectName}`);
      if (exportData.clientName) {
        csvRows.push(`Client: ${exportData.clientName}`);
      }
      csvRows.push("");
      csvRows.push("WBS Items");
      csvRows.push("Task,Role,Rate,Hours,Line Total");
      for (const item of exportData.wbsItems) {
        csvRows.push(
          `"${item.task.replace(/"/g, '""')}",${item.roleName},${item.roleRate},${item.hours},${item.lineTotal}`,
        );
      }
      csvRows.push("");
      csvRows.push(`Subtotal,${exportData.subtotal}`);
      csvRows.push(`Overhead Fee,${exportData.overheadFee}`);
      csvRows.push(`Total,${exportData.total}`);
      csvRows.push("");
      if (exportData.paymentTerms) {
        csvRows.push("Payment Terms");
        csvRows.push(`"${exportData.paymentTerms.replace(/"/g, '""')}"`);
        csvRows.push("");
      }
      if (exportData.timeline) {
        csvRows.push("Timeline");
        csvRows.push(`"${exportData.timeline.replace(/"/g, '""')}"`);
      }

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="quote-${projectId}.csv"`,
        },
      });
    } else {
      const textLines: string[] = [];
      textLines.push("QUOTE");
      textLines.push("=".repeat(50));
      textLines.push(`Project: ${exportData.projectName}`);
      if (exportData.clientName) {
        textLines.push(`Client: ${exportData.clientName}`);
      }
      textLines.push("");
      textLines.push("WBS ITEMS");
      textLines.push("-".repeat(50));
      for (const item of exportData.wbsItems) {
        textLines.push(
          `${item.task} | ${item.roleName} | ${item.hours}h @ $${item.roleRate}/hr = $${item.lineTotal.toLocaleString()}`,
        );
      }
      textLines.push("");
      textLines.push("PRICING");
      textLines.push("-".repeat(50));
      textLines.push(`Subtotal: $${exportData.subtotal.toLocaleString()}`);
      textLines.push(`Overhead Fee: $${exportData.overheadFee.toLocaleString()}`);
      textLines.push(`Total: $${exportData.total.toLocaleString()}`);
      textLines.push("");
      if (exportData.paymentTerms) {
        textLines.push("PAYMENT TERMS");
        textLines.push("-".repeat(50));
        textLines.push(exportData.paymentTerms);
        textLines.push("");
      }
      if (exportData.timeline) {
        textLines.push("TIMELINE");
        textLines.push("-".repeat(50));
        textLines.push(exportData.timeline);
      }
      if (exportData.delivered) {
        textLines.push("");
        textLines.push("Status: DELIVERED");
      }

      return new NextResponse(textLines.join("\n"), {
        headers: {
          "Content-Type": "text/plain",
        },
      });
    }
  } catch (error) {
    console.error("Quote export error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to export quote",
      },
      { status: 500 },
    );
  }
}

