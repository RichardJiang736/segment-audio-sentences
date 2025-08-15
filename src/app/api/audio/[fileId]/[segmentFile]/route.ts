import { NextRequest, NextResponse } from 'next/server'
import { readFile, access, stat } from 'fs/promises'
import { constants } from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string; segmentFile: string }> }
) {
  try {
    const { fileId, segmentFile } = await params
    
    // Construct the file path
    // The segmentFile might be URL encoded, so we need to decode it
    const decodedSegmentFile = decodeURIComponent(segmentFile);
    let filePath = path.join(process.cwd(), 'output', fileId, decodedSegmentFile)
    
    // Check if file exists
    try {
      await access(filePath, constants.R_OK)
      // Make sure it's a file
      const stats = await stat(filePath)
      if (!stats.isFile()) {
        throw new Error('Not a file')
      }
    } catch {
      // Try without decoding if the first attempt fails
      try {
        await access(path.join(process.cwd(), 'output', fileId, segmentFile), constants.R_OK)
        // If this works, use the non-decoded path
        filePath = path.join(process.cwd(), 'output', fileId, segmentFile)
        // Make sure it's a file
        const stats = await stat(filePath)
        if (!stats.isFile()) {
          throw new Error('Not a file')
        }
      } catch {
        return NextResponse.json(
          { error: 'Audio segment file not found' },
          { status: 404 }
        )
      }
    }

    // Read the file
    const fileBuffer = await readFile(filePath)
    
    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase()
    let contentType = 'audio/wav'
    
    switch (ext) {
      case '.mp3':
        contentType = 'audio/mpeg'
        break
      case '.flac':
        contentType = 'audio/flac'
        break
      case '.m4a':
        contentType = 'audio/mp4'
        break
      case '.aac':
        contentType = 'audio/aac'
        break
    }

    // Return the audio file
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Content-Length': fileBuffer.length.toString(),
      },
    })

  } catch (error) {
    console.error('Error serving audio segment file:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}