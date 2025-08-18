import { NextRequest, NextResponse } from 'next/server'
import { upload } from '@vercel/blob/client'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, contentType } = body

    if (!url || !contentType) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Generate a unique filename
    const filename = `audio-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`

    // Create a new upload URL
    const blob = await upload(filename, new Blob(), {
      access: 'public',
      handleUploadUrl: '/api/upload',
      contentType,
    })

    return NextResponse.json({
      url: blob.url,
      downloadUrl: blob.downloadUrl,
    })
  } catch (error) {
    console.error('Upload URL generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}