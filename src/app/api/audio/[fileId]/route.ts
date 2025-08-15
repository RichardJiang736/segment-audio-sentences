import { NextRequest, NextResponse } from 'next/server'
import { readFile, access, readdir, stat } from 'fs/promises'
import { constants } from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'original'

    // Determine the file path based on type
    let filePath: string
    
    if (type === 'original') {
      // For original files, we need to find the original uploaded file
      // Since we process files and save them to output directory, we'll look there
      const outputDir = path.join(process.cwd(), 'output')
      
      // Try with the fileId directly (could be filename or file ID)
      const possiblePaths = [
        path.join(outputDir, fileId), // Direct filename
        path.join(outputDir, `${fileId}.wav`),
        path.join(outputDir, `${fileId}.mp3`),
        path.join(outputDir, `${fileId}.flac`),
        path.join(outputDir, `${fileId}.m4a`),
        path.join(outputDir, `${fileId}.aac`),
      ]

      let found = false;
      for (const possiblePath of possiblePaths) {
        try {
          await access(possiblePath, constants.R_OK)
          const stats = await stat(possiblePath)
          // Make sure it's a file, not a directory
          if (stats.isFile()) {
            filePath = possiblePath
            found = true
            break
          }
        } catch {
          continue
        }
      }

      if (!found) {
        // Try to find any file that contains the fileId in the output directory
        try {
          const outputFiles = await readdir(outputDir);
          const matchingFile = outputFiles.find(file => 
            file.includes(fileId) && 
            (file.endsWith('.wav') || file.endsWith('.mp3') || file.endsWith('.flac') || 
             file.endsWith('.m4a') || file.endsWith('.aac'))
          );
          if (matchingFile) {
            filePath = path.join(outputDir, matchingFile);
            found = true;
          }
        } catch (err) {
          console.error('Error reading output directory:', err);
        }
      }

      if (!found) {
        return NextResponse.json(
          { error: 'Original audio file not found' },
          { status: 404 }
        )
      }
    } else {
      // For segment files, the path includes the segment filename
      const segmentFile = searchParams.get('segment')
      if (!segmentFile) {
        return NextResponse.json(
          { error: 'Segment file parameter is required' },
          { status: 400 }
        )
      }

      // Use fileId as the directory name
      filePath = path.join(process.cwd(), 'output', fileId, segmentFile)
    }

    // Check if file exists
    try {
      await access(filePath, constants.R_OK)
      // Make sure it's a file
      const stats = await stat(filePath)
      if (!stats.isFile()) {
        throw new Error('Not a file')
      }
    } catch {
      return NextResponse.json(
        { error: 'Audio file not found' },
        { status: 404 }
      )
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
    console.error('Error serving audio file:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}