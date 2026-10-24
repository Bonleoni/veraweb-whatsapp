import { connection, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp-bot';

// 🛡️ SPAM KORUMA AYARLARI
const RATE_LIMIT_SECONDS = 45; // Mesajlar arası minimum 45 saniye
const DAILY_LIMIT = 25; // Günde maksimum 25 mesaj
const TEST_MODE = true; // true ise sadece test numarasına gönder
const TEST_PHONE_NUMBER = '905426133850';

function normalizePhone(phone: string) {
  return phone.replace(/[^0-9]/g, '');
}

type LeadJoin = {
  phone?: string | null;
  business_name?: string | null;
};

export async function POST(request: Request) {
  try {
    await connection();
    const { leadIds, message } = await request.json();

    if (!leadIds || !message || !Array.isArray(leadIds)) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz parametreler' },
        { status: 400 }
      );
    }

    // Günlük limit kontrolü
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: todayCount } = await supabase
      .from('lead_messages')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', today.toISOString());

    if (todayCount && todayCount >= DAILY_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: `Günlük limit doldu (${DAILY_LIMIT}/${DAILY_LIMIT}). Yarın tekrar deneyin.`,
        },
        { status: 429 }
      );
    }

    const remaining = DAILY_LIMIT - (todayCount || 0);
    if (leadIds.length > remaining) {
      return NextResponse.json(
        {
          success: false,
          error: `Günlük kalan limit ${remaining}. En fazla ${remaining} aday seçebilirsiniz.`,
        },
        { status: 429 }
      );
    }

    // Mesajları kuyruğa ekle
    const messagesToQueue = leadIds.map((leadId: string) => ({
      lead_id: leadId,
      content: message,
      status: 'pending',
      scheduled_at: new Date().toISOString(),
    }));

    const { data: queuedMessages, error: queueError } = await supabase
      .from('lead_messages')
      .insert(messagesToQueue)
      .select();

    if (queueError) throw queueError;

    return NextResponse.json({
      success: true,
      message: `${queuedMessages.length} mesaj kuyruğa eklendi`,
      count: queuedMessages.length,
      remainingDailyLimit: remaining - queuedMessages.length,
      rateLimitSeconds: RATE_LIMIT_SECONDS,
    });
  } catch (error) {
    console.error('Kuyruk hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Kuyruk oluşturulamadı' },
      { status: 500 }
    );
  }
}

// Kuyruktaki mesajları gönder (manuel tetiklenir — tek seferde 1)
export async function GET() {
  try {
    await connection();

    const { data: pendingMessages, error } = await supabase
      .from('lead_messages')
      .select(
        `
        id,
        lead_id,
        content,
        leads (phone, business_name)
      `
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) throw error;
    if (!pendingMessages || pendingMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Kuyruk boş',
        sent: 0,
      });
    }

    const message = pendingMessages[0] as {
      id: string;
      lead_id: string;
      content: string;
      leads: LeadJoin | LeadJoin[] | null;
    };

    const lead = Array.isArray(message.leads)
      ? message.leads[0]
      : message.leads;

    if (!lead?.phone) {
      await supabase
        .from('lead_messages')
        .update({
          status: 'failed',
          error_message: 'Telefon numarası yok',
        })
        .eq('id', message.id);

      return NextResponse.json(
        { success: false, error: 'Telefon numarası yok', sent: 0, failed: 1 },
        { status: 400 }
      );
    }

    const phone = normalizePhone(lead.phone);
    const businessName = lead.business_name || 'Aday';

    // Test modu: test numarası değilse WhatsApp göndermeden işaretle
    if (TEST_MODE && phone !== TEST_PHONE_NUMBER) {
      await supabase
        .from('lead_messages')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: 'skipped_test',
        })
        .eq('id', message.id);

      await supabase
        .from('leads')
        .update({
          status: 'contacted',
          last_contact_at: new Date().toISOString(),
        })
        .eq('id', message.lead_id);

      return NextResponse.json({
        success: true,
        message: `Test modu: ${businessName} atlandı`,
        sent: 1,
        skipped: 1,
      });
    }

    const sent = await sendWhatsAppMessage(lead.phone, message.content);

    if (sent) {
      await supabase
        .from('lead_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', message.id);

      await supabase
        .from('leads')
        .update({
          status: 'contacted',
          last_contact_at: new Date().toISOString(),
        })
        .eq('id', message.lead_id);

      return NextResponse.json({
        success: true,
        message: `${businessName} gönderildi`,
        sent: 1,
      });
    }

    await supabase
      .from('lead_messages')
      .update({
        status: 'failed',
        error_message: 'WhatsApp gönderim başarısız',
      })
      .eq('id', message.id);

    return NextResponse.json(
      { success: false, error: 'Gönderim başarısız', sent: 0, failed: 1 },
      { status: 500 }
    );
  } catch (error) {
    console.error('Gönderim hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Gönderim başarısız' },
      { status: 500 }
    );
  }
}
