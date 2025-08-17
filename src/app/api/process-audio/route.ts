import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFiles = formData.getAll('audioFiles') as File[]
    const outputFolder = formData.get('outputFolder') as string || './output'

    if (!audioFiles || audioFiles.length === 0) {
      return NextResponse.json({ error: '没有选择音频文件' }, { status: 400 })
    }

    // Create output directory if it doesn't exist
    const outputPath = join(process.cwd(), 'public', outputFolder)
    try {
      await mkdir(outputPath, { recursive: true })
    } catch (error) {
      // Directory already exists
    }

    const results = []

    for (const audioFile of audioFiles) {
      const fileBuffer = Buffer.from(await audioFile.arrayBuffer())
      const fileName = audioFile.name
      const filePath = join(outputPath, fileName)

      // Save the audio file
      await writeFile(filePath, fileBuffer)

      // Process the audio file with Python script
      try {
        const pythonScriptPath = join(process.cwd(), 'main.py')
        const { stdout } = await execAsync(`python ${pythonScriptPath} "${outputPath}" "${outputPath}"`)
        
        // Parse the JSON output from Python script
        const pythonResult = JSON.parse(stdout)
        
        if (pythonResult.files && pythonResult.files.length > 0) {
          // Add all file results, not just the first one
          for (const fileResult of pythonResult.files) {
            results.push({
              id: fileResult.id || fileName.replace(/\.[^/.]+$/, ""),
              name: fileResult.name || fileName,
              segments: fileResult.segments || [],
              status: fileResult.status || 'Completed',
              progress: fileResult.progress || 100
            })
          }
        } else {
          // If no segments found, create a basic result
          results.push({
            id: fileName.replace(/\.[^/.]+$/, ""),
            name: fileName,
            segments: [],
            status: 'Completed',
            progress: 100
          })
        }
      } catch (pythonError) {
        console.error('Python script error:', pythonError)
        // Create a fallback result if Python script fails
        results.push({
          id: fileName.replace(/\.[^/.]+$/, ""),
          name: fileName,
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