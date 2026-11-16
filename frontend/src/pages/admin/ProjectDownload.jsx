import { useState } from "react";
import { PackageOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApi, errMsg } from "@/lib/api";

export default function ProjectDownload() {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const blob = await api("get", "/admin/project-zip", { responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "police-performance-dashboard.zip";
      a.click();
      toast.success("Project downloaded", { description: "Open README.md inside the zip to run it locally" });
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <Button variant="outline" className="rounded-sm" onClick={download} disabled={busy} data-testid="project-zip-download">
      {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <PackageOpen className="h-4 w-4 mr-1.5" />}Download project (.zip)
    </Button>
  );
}
