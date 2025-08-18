import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filename, contentType } = body

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: 'Missing filename or contentType' },
        { status: 400 }
      )
    }

    // Generate a unique pathname for the blob
    const pathname = `uploads/${Date.now()}-${filename}`

    // Create upload URL using Vercel Blob
    const blobResponse = await fetch('https://blob.vercel-storage.com/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pathname,
        contentType,
        addRandomSuffix: false,
      }),
    })

    if (!blobResponse.ok) {
      const errorText = await blobResponse.text()
      console.error('Blob upload URL generation failed:', errorText)
      return NextResponse.json(
        { error: 'Failed to generate upload URL' },
        { status: 500 }
      )
    }

    const blobData = await blobResponse.json()
    
    return NextResponse.json({
      uploadUrl: blobData.url,
      pathname: blobData.pathname,
      downloadUrl: blobData.downloadUrl,
    })
  } catch (error) {
    console.error('Generate upload URL error:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}