import { NextRequest, NextResponse } from 'next/server'
import { readFile, access } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'original'

    // Try different possible paths
    const possiblePaths = [
      join(process.cwd(), 'public', 'output', fileId),
      join(process.cwd(), 'public', 'output', `${fileId}.wav`),
      join(process.cwd(), 'public', 'output', `${fileId}.mp3`),
      join(process.cwd(), 'public', 'output', `${fileId}.flac`),
      join(process.cwd(), 'public', 'output', `${fileId}.m4a`),
      join(process.cwd(), 'public', 'output', `${fileId}.aac`),
    ]

    // If it's a segment file, also check in subdirectories
    if (type === 'segment') {
      possiblePaths.push(
        join(process.cwd(), 'public', 'output', fileId, `${fileId}.wav`),
        join(process.cwd(), 'public', 'output', fileId, `${fileId}.mp3`),
        join(process.cwd(), 'public', 'output', fileId, `${fileId}.flac`),
        join(process.cwd(), 'public', 'output', fileId, `${fileId}.m4a`),
        join(process.cwd(), 'public', 'output', fileId, `${fileId}.aac`),
      )
    }

    let filePath = ''
    let fileExists = false

    for (const path of possiblePaths) {
      try {
        await access(path)
        // Check if it's a file, not a directory
        const stats = await import('fs').then(fs => fs.promises.stat(path))
        if (stats.isFile()) {
          filePath = path
          fileExists = true
          break
        }
      } catch {
        // File doesn't exist or is not accessible
      }
    }

    if (!fileExists) {
      return NextResponse.json({ error: '音频文件未找到' }, { status: 404 })
    }

    const fileBuffer = await readFile(filePath)
    
    // Determine content type based on file extension
    const ext = filePath.toLowerCase()
    let contentType = 'audio/wav'
    if (ext.endsWith('.mp3')) contentType = 'audio/mpeg'
    else if (ext.endsWith('.flac')) contentType = 'audio/flac'
    else if (ext.endsWith('.m4a')) contentType = 'audio/mp4'
    else if (ext.endsWith('.aac')) contentType = 'audio/aac'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Audio file error:', error)
    return NextResponse.json({ error: '获取音频文件时发生错误' }, { status: 500 })
  }
}