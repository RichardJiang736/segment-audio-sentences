import { NextRequest, NextResponse } from 'next/server'
import { readFile, access } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string; segmentFile: string } }
) {
  try {
    const { fileId, segmentFile } = params

    // Try different possible paths for segment files
    const possiblePaths = [
      join(process.cwd(), 'public', 'output', fileId, segmentFile),
      join(process.cwd(), 'public', 'output', fileId, `${segmentFile}.wav`),
      join(process.cwd(), 'public', 'output', fileId, `${segmentFile}.mp3`),
    ]

    let filePath = ''
    let fileExists = false

    for (const path of possiblePaths) {
      try {
        await access(path)
        filePath = path
        fileExists = true
        break
      } catch {
        // File doesn't exist at this path
      }
    }

    if (!fileExists) {
      return NextResponse.json({ error: '分段音频文件未找到' }, { status: 404 })
    }

    const fileBuffer = await readFile(filePath)
    
    // Determine content type based on file extension
    const ext = filePath.toLowerCase()
    let contentType = 'audio/wav'
    if (ext.endsWith('.mp3')) contentType = 'audio/mpeg'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Segment audio file error:', error)
    return NextResponse.json({ error: '获取分段音频文件时发生错误' }, { status: 500 })
  }
}