import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

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

    try {
      // Use the Vercel Blob SDK to generate an upload URL
      const blob = await put(pathname, new Blob(), {
        access: 'public',
        contentType,
        addRandomSuffix: false,
      })

      return NextResponse.json({
        uploadUrl: blob.url,
        pathname: blob.pathname,
        downloadUrl: blob.downloadUrl,
      })
    } catch (blobError) {
      console.error('Vercel Blob SDK error:', blobError)
      
      // Fallback: Try using the REST API
      try {
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
          console.error('Blob REST API failed:', errorText)
          return NextResponse.json(
            { error: 'Failed to generate upload URL using both SDK and REST API' },
            { status: 500 }
          )
        }

        const blobData = await blobResponse.json()
        
        return NextResponse.json({
          uploadUrl: blobData.url,
          pathname: blobData.pathname,
          downloadUrl: blobData.downloadUrl,
        })
      } catch (restError) {
        console.error('REST API fallback failed:', restError)
        return NextResponse.json(
          { error: 'Both SDK and REST API methods failed' },
          { status: 500 }
        )
      }
    }
  } catch (error) {
    console.error('Generate upload URL error:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}