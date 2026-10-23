import { ScenarioStatCards } from "@/components/dashboard/scenario-stat-cards";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { dashboardSummary } from "@/lib/dummy-dashboard";

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Üç senaryonun özeti — şu an örnek (dummy) veri gösteriliyor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {dashboardSummary.totalPending} onay bekliyor
          </Badge>
          <Badge variant="outline">
            Bugün {dashboardSummary.totalSentToday} gönderildi
          </Badge>
        </div>
      </div>

      <ScenarioStatCards />

      <Card className="shadow-none">
        <CardHeader className="border-b">
          <CardTitle>Sistem durumu</CardTitle>
          <CardDescription>
            Bot bağlantısı ve kuyruk özeti (dummy)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">WhatsApp bot</p>
            <p className="text-sm font-medium">
              {dashboardSummary.connectedBot ? "Bağlı" : "Bağlı değil"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Onay kuyruğu</p>
            <p className="text-sm font-medium tabular-nums">
              {dashboardSummary.totalPending} mesaj
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Bugün gönderilen</p>
            <p className="text-sm font-medium tabular-nums">
              {dashboardSummary.totalSentToday} mesaj
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
