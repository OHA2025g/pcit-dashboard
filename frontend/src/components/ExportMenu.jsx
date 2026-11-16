import { Download, FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportData } from "@/lib/exports";
import { useApi } from "@/lib/api";

export default function ExportMenu({ title, view, columns, rows, context, notes, testId = "export-menu" }) {
  const api = useApi();
  const run = async (format) => {
    try {
      exportData(format, { title, columns, rows, context, notes });
      await api("post", "/audit/export", { data: { format, view, context, rows: rows.length } });
      toast.success(`${format.toUpperCase()} export ready`, { description: `${rows.length} rows with filters and definitions` });
    } catch (e) {
      toast.error("Export failed", { description: e.message });
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-sm gap-2" data-testid={testId}><Download className="h-4 w-4" />Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => run("csv")} data-testid={`${testId}-csv`}><FileDown className="h-4 w-4 mr-2" />CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("xlsx")} data-testid={`${testId}-xlsx`}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("pdf")} data-testid={`${testId}-pdf`}><FileText className="h-4 w-4 mr-2" />PDF report</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
