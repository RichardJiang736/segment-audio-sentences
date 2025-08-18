import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filename, contentType } = body

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Generate a client upload URL
    const blob = await put(filename, new Blob(), {
      access: 'public',
      contentType,
    })

    return NextResponse.json({
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      uploadUrl: blob.uploadUrl,
    })
  } catch (error) {
    console.error('Upload URL generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}