import {
  BellRing,
  HeartHandshake,
  UserX,
  TrendingUp,
  Minus,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  scenarioStats,
  type ScenarioStat,
  type ScenarioType,
} from "@/lib/dummy-dashboard";
import { cn } from "@/lib/utils";

const scenarioIcons: Record<ScenarioType, LucideIcon> = {
  reminder: BellRing,
  first_class: HeartHandshake,
  absence: UserX,
};

const scenarioIconStyles: Record<ScenarioType, string> = {
  reminder: "bg-emerald-500/15 text-emerald-700",
  first_class: "bg-sky-500/15 text-sky-700",
  absence: "bg-amber-500/15 text-amber-700",
};

function ScenarioStatCard({ stat }: { stat: ScenarioStat }) {
  const Icon = scenarioIcons[stat.type];

  return (
    <Card className="shadow-none">
      <CardHeader className="border-b">
        <div
          className={cn(
            "mb-3 flex size-9 items-center justify-center rounded-lg",
            scenarioIconStyles[stat.type]
          )}
        >
          <Icon className="size-4" />
        </div>
        <CardTitle>{stat.title}</CardTitle>
        <CardDescription>{stat.description}</CardDescription>
        <CardAction>
          <Badge variant={stat.pendingCount > 0 ? "default" : "secondary"}>
            Onay bekliyor
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {stat.pendingCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              kuyruktaki mesaj
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            {stat.trendUp ? (
              <TrendingUp className="size-3.5 text-primary" />
            ) : (
              <Minus className="size-3.5" />
            )}
            <span className={stat.trendUp ? "text-primary" : undefined}>
              {stat.trendLabel}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="justify-between text-xs text-muted-foreground">
        <span>Bugün gönderilen</span>
        <span className="font-medium text-foreground tabular-nums">
          {stat.sentToday}
        </span>
      </CardFooter>
    </Card>
  );
}

export function ScenarioStatCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {scenarioStats.map((stat) => (
        <ScenarioStatCard key={stat.type} stat={stat} />
      ))}
    </div>
  );
}
