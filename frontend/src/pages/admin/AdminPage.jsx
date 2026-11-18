import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/lib/api";
import DataTab from "./DataTab";
import PolicyTab from "./PolicyTab";
import UsersTab from "./UsersTab";
import AuditTab from "./AuditTab";
import SourcesTab from "./SourcesTab";
import ProjectDownload from "./ProjectDownload";

const TABS = [
  ["data", "Data & uploads", DataTab],
  ["policy", "Scoring rules", PolicyTab],
  ["users", "Users & roles", UsersTab],
  ["sources", "API sources", SourcesTab],
  ["audit", "Audit log", AuditTab],
];

export default function AdminPage() {
  const { me } = useMe();
  if (me.role !== "admin") return <div className="text-sm text-rose-700 mt-10" data-testid="admin-forbidden">Admins only.</div>;
  return (
    <div data-testid="admin-page">
      <div className="text-[11px] uppercase tracking-[0.2em] text-teal-700 font-semibold">Administration</div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">Control room</h1>
        <ProjectDownload />
      </div>
      <Tabs defaultValue="data">
        <TabsList className="rounded-sm bg-white border h-auto p-1 flex-wrap justify-start">
          {TABS.map(([v, l]) => <TabsTrigger key={v} value={v} className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white" data-testid={`admin-tab-${v}`}>{l}</TabsTrigger>)}
        </TabsList>
        {TABS.map(([v, , C]) => <TabsContent key={v} value={v} className="mt-5"><C /></TabsContent>)}
      </Tabs>
    </div>
  );
}
