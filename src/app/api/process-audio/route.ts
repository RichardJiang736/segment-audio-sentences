import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { put } from '@vercel/blob'

const execAsync = promisify(exec)

export const maxDuration = 300;
export const config = {
  maxBodySize: 524288000,
  api: {
    bodyParser: {
      sizeLimit: '500mb'
    }
  }
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFiles = formData.getAll('audioFiles') as File[]
    const outputFolder = formData.get('outputFolder') as string || './output'

    if (!audioFiles || audioFiles.length === 0) {
      return NextResponse.json({ error: '没有选择音频文件' }, { status: 400 })
    }

    // For Vercel deployment, use blob storage
    const results = []

    for (const audioFile of audioFiles) {
      // Upload to Vercel Blob
      const blob = await put(audioFile.name, audioFile, {
        access: 'public',
      });
      
      // Now process the file from the blob URL
      // You'll need to modify your Python script to handle URLs instead of local files
      const fileUrl = blob.url
      
      // Create output directory if it doesn't exist
      const outputPath = join(process.cwd(), 'public', outputFolder)
      try {
        await mkdir(outputPath, { recursive: true })
      } catch (error) {
        // Directory already exists
      }

      // Process the audio file with Python script
      try {
        const pythonScriptPath = join(process.cwd(), 'main.py')
        // Pass the URL instead of local file path
        const { stdout } = await execAsync(`python ${pythonScriptPath} "${fileUrl}" "${outputPath}"`)
        
        // Parse the JSON output from Python script
        const pythonResult = JSON.parse(stdout)
        
        if (pythonResult.files && pythonResult.files.length > 0) {
          // Add all file results, not just the first one
          for (const fileResult of pythonResult.files) {
            results.push({
              id: fileResult.id || audioFile.name.replace(/\.[^/.]+$/, ""),
              name: fileResult.name || audioFile.name,
              segments: fileResult.segments || [],
              status: fileResult.status || 'Completed',
              progress: fileResult.progress || 100
            })
          }
        } else {
          // If no segments found, create a basic result
          results.push({
            id: audioFile.name.replace(/\.[^/.]+$/, ""),
            name: audioFile.name,
            segments: [],
            status: 'Completed',
            progress: 100
          })
        }
      } catch (pythonError) {
        console.error('Python script error:', pythonError)
        // Create a fallback result if Python script fails
        results.push({
          id: audioFile.name.replace(/\.[^/.]+$/, ""),
          name: audioFile.name,
          segments: [],
          status: 'Error',
          progress: 0
        })
      }
    }

    return NextResponse.json({
      files: results,
      totalSegments: results.reduce((total, file) => total + (file.segments?.length || 0), 0),
      targetDir: outputFolder
    })
  } catch (error) {
    console.error('Processing error:', error)
    return NextResponse.json({ error: '处理音频文件时发生错误' }, { status: 500 })
  }
}