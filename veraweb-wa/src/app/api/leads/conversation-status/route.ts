import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(request: NextRequest) {
  try {
    const { leadId, status } = await request.json();

    if (!leadId || !['open', 'snoozed', 'done'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz parametreler' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('leads')
      .update({ conversation_status: status })
      .eq('id', leadId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Durum güncelleme hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Güncellenemedi' },
      { status: 500 }
    );
  }
}
