import { supabase } from "./supabase"

export async function approveMessage(messageId: string) {
  const { data, error } = await supabase
    .from("message_queue")
    .update({
      status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function rejectMessage(messageId: string) {
  const { data, error } = await supabase
    .from("message_queue")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .select()
    .single()

  if (error) throw error
  return data
}
