import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileName, contentType, size } = body

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: 'Missing fileName or contentType' },
        { status: 400 }
      )
    }

    // Check if BLOB_READ_WRITE_TOKEN is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN not found in environment variables')
      return NextResponse.json(
        { 
          error: 'Vercel Blob token not found. Please ensure BLOB_READ_WRITE_TOKEN is configured in your Vercel environment variables, or use Traditional Upload method.',
          recommendation: 'Use Traditional Upload method for reliable file uploads in all environments.'
        },
        { status: 500 }
      )
    }

    // Validate file size - recommend Traditional upload for files under 500MB
    if (size && size < 500 * 1024 * 1024) {
      return NextResponse.json(
        { 
          error: 'File size is under 500MB. For better reliability with smaller files, please use Traditional Upload method.',
          recommendation: 'Use Vercel Blob upload only for files over 500MB.'
        },
        { status: 400 }
      )
    }

    // Generate a unique pathname for the blob
    const pathname = `uploads/${Date.now()}-${fileName}`

    try {
      // Use the Vercel Blob SDK to generate an upload URL
      const blob = await put(pathname, new Blob(), {
        access: 'public',
        contentType,
        addRandomSuffix: false,
      })

      return NextResponse.json({
        uploadUrl: blob.url,
        publicUrl: blob.downloadUrl,
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
          
          // Provide more helpful error message based on the error
          let helpfulMessage = 'Failed to generate upload URL using both SDK and REST API'
          if (errorText.includes('Unauthorized') || errorText.includes('Invalid token')) {
            helpfulMessage = 'Vercel Blob authentication failed. Please ensure BLOB_READ_WRITE_TOKEN is properly configured, or use Traditional Upload method.'
          }
          
          return NextResponse.json(
            { 
              error: helpfulMessage,
              recommendation: 'Use Traditional Upload method for reliable file uploads in all environments.'
            },
            { status: 500 }
          )
        }

        const blobData = await blobResponse.json()
        
        return NextResponse.json({
          uploadUrl: blobData.url,
          publicUrl: blobData.downloadUrl,
          pathname: blobData.pathname,
          downloadUrl: blobData.downloadUrl,
        })
      } catch (restError) {
        console.error('REST API fallback failed:', restError)
        return NextResponse.json(
          { 
            error: 'Vercel Blob authentication failed. This is a known issue in some Vercel environments. Please use Traditional Upload method instead.',
            recommendation: 'Use Traditional Upload method for reliable file uploads in all environments.'
          },
          { status: 500 }
        )
      }
    }
  } catch (error) {
    console.error('Generate upload URL error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate upload URL. Please use Traditional Upload method.',
        recommendation: 'Use Traditional Upload method for reliable file uploads in all environments.'
      },
      { status: 500 }
    )
  }
}