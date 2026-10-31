import { NextRequest, NextResponse } from 'next/server'

function isAllowedImageUrl(raw: string) {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    return (
      host === 'instagram.com' ||
      host.endsWith('.instagram.com') ||
      host.includes('cdninstagram.com') ||
      host.includes('fbcdn.net') ||
      host.endsWith('.supabase.co')
    )
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL gerekli' }, { status: 400 })
  }

  if (!isAllowedImageUrl(url)) {
    return NextResponse.json({ error: 'Geçersiz URL' }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: 'https://www.instagram.com/',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      // Next fetch cache — CDN URL'leri kısa ömürlü olabilir ama 1 gün yeterli
      next: { revalidate: 86400 },
    })

    if (!response.ok) {
      console.error('Instagram image upstream:', response.status, url.slice(0, 80))
      return NextResponse.json(
        { error: 'Resim çekilemedi', status: response.status },
        { status: 502 }
      )
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Geçersiz içerik tipi' },
        { status: 502 }
      )
    }

    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Proxy image hatası:', error)
    return NextResponse.json({ error: 'Resim yüklenemedi' }, { status: 500 })
  }
}
