import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select(
        `
        *,
        instagram_username,
        instagram_profile_pic_url,
        instagram_followers,
        instagram_post_count,
        instagram_bio,
        photo_urls,
        conversation_status
      `
      )
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Adaylar alınamadı:', error);
    return NextResponse.json(
      { success: false, error: 'Adaylar alınamadı' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from('leads')
      .insert([body])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Aday eklenemedi' },
      { status: 500 }
    );
  }
}
