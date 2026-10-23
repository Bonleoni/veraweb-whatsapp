export type ScenarioType = "reminder" | "first_class" | "absence";

export type ScenarioStat = {
  type: ScenarioType;
  title: string;
  description: string;
  pendingCount: number;
  sentToday: number;
  trendLabel: string;
  trendUp: boolean;
};

export const scenarioStats: ScenarioStat[] = [
  {
    type: "reminder",
    title: "Ders Hatırlatması",
    description: "Yarınki ders için hazırlanan mesajlar",
    pendingCount: 12,
    sentToday: 8,
    trendLabel: "+3 bugün",
    trendUp: true,
  },
  {
    type: "first_class",
    title: "İlk Ders Sonrası",
    description: "İlk dersi biten müşterilere takip",
    pendingCount: 5,
    sentToday: 2,
    trendLabel: "+1 bugün",
    trendUp: true,
  },
  {
    type: "absence",
    title: "Devamsızlık Uyarısı",
    description: "1 haftadır gelmeyen müşteriler",
    pendingCount: 3,
    sentToday: 1,
    trendLabel: "stabil",
    trendUp: false,
  },
];

export const dashboardSummary = {
  totalPending: 20,
  totalSentToday: 11,
  connectedBot: false,
};
