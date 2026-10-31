import { connection, NextRequest, NextResponse } from 'next/server'

const ALLOWED_HOST_RE =
  /(^|\.)(cdninstagram\.com|fbcdn\.net|instagram\.com)$/i

function isAllowedImageUrl(raw: string) {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    return ALLOWED_HOST_RE.test(url.hostname)
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    await connection()
    const raw = request.nextUrl.searchParams.get('url')
    if (!raw || !isAllowedImageUrl(raw)) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz görsel URL' },
        { status: 400 }
      )
    }

    const upstream = await fetch(raw, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: 'https://www.instagram.com/',
      },
      next: { revalidate: 60 * 60 * 6 },
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: `Upstream ${upstream.status}` },
        { status: 502 }
      )
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg'
    const buffer = await upstream.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=21600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Image proxy hatası:', error)
    return NextResponse.json(
      { success: false, error: 'Görsel alınamadı' },
      { status: 500 }
    )
  }
}
