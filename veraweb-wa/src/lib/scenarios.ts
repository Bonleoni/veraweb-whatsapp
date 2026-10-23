// 3 Senaryo Tanımı
export const SCENARIOS = {
  REMINDER: {
    id: "reminder",
    name: "Ders Hatırlatma",
    description: "1 gün önceki dersler için otomatik hatırlatma",
    trigger: "1_day_before",
    template: (customerName: string, lessonTime: string) =>
      `Merhaba ${customerName}! Yarın saat ${lessonTime}'deki pilates dersinizi hatırlatmak istedik. Sizi stüdyoda görmek için sabırsızlanıyoruz!`,
  },
  FOLLOW_UP: {
    id: "follow_up",
    name: "İlk Ders Sonrası Takip",
    description: "İlk dersten ~2 saat sonra memnuniyet takibi",
    trigger: "2_hours_after",
    template: (customerName: string) =>
      `Merhaba ${customerName}! Bugünkü ilk pilates dersinizi umarız beğendiniz. Herhangi bir sorunuz veya geri bildiriminiz varsa buradayız. Bir sonraki dersiniz için sabırsızlanıyoruz!`,
  },
  ABSENCE: {
    id: "absence",
    name: "Devamsızlık Uyarısı",
    description: "1 haftadır gelmeyen müşterilere nazik hatırlatma",
    trigger: "1_week_absent",
    template: (customerName: string) =>
      `Merhaba ${customerName}! Sizi özledik! Uzun süredir stüdyomuzda göremedik. Kendinize zaman ayırıp tekrar aramıza katılmanızı çok isteriz. Size özel bir indirim sunabiliriz!`,
  },
} as const

export type ScenarioType = keyof typeof SCENARIOS
