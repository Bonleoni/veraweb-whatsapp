import { supabase } from "./supabase"
import { SCENARIOS, type ScenarioType } from "./scenarios"

export interface GeneratedMessage {
  customer_id: string
  scenario_type: ScenarioType
  message_content: string
  status: "pending" | "approved" | "rejected" | "sent"
}

// Senaryo kontrolü ve mesaj üretimi
export async function generateMessages() {
  // 1. Ders Hatırlatma: Yarın dersi olan müşteriler
  // TODO: Gerçek lesson tablosu bağlanınca burası güncellenecek
  await supabase.from("customers").select("*")

  // 2. İlk Ders Takip: Bugün ilk dersini alan müşteriler
  // TODO: Gerçek lesson tablosu bağlanınca burası güncellenecek

  // 3. Devamsızlık: 1 haftadır gelmeyen müşteriler
  // TODO: Gerçek lesson tablosu bağlanınca burası güncellenecek

  // Şimdilik dummy mesaj üret (test için)
  const dummyMessages: GeneratedMessage[] = [
    {
      customer_id: "dummy-1",
      scenario_type: "REMINDER",
      message_content: SCENARIOS.REMINDER.template("Ayşe Yılmaz", "14:00"),
      status: "pending",
    },
    {
      customer_id: "dummy-2",
      scenario_type: "FOLLOW_UP",
      message_content: SCENARIOS.FOLLOW_UP.template("Mehmet Demir"),
      status: "pending",
    },
    {
      customer_id: "dummy-3",
      scenario_type: "ABSENCE",
      message_content: SCENARIOS.ABSENCE.template("Canan Yıldız"),
      status: "pending",
    },
  ]

  // Mesajları kuyruğa ekle
  for (const msg of dummyMessages) {
    const { error } = await supabase.from("message_queue").insert([
      {
        customer_id: msg.customer_id,
        scenario_type: msg.scenario_type,
        message_content: msg.message_content,
        status: msg.status,
      },
    ])

    if (error) console.error("Mesaj eklenemedi:", error)
  }

  return dummyMessages
}
