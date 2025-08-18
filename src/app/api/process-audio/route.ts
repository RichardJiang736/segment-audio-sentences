import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { https } from 'follow-redirects'
import { createWriteStream } from 'fs'

const execAsync = promisify(exec)

// Function to download file from URL
async function downloadFile(url: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const fileStream = createWriteStream(filePath)
    https.get(url, (response) => {
      response.pipe(fileStream)
      fileStream.on('finish', () => {
        fileStream.close()
        resolve()
      })
    }).on('error', (error) => {
      reject(error)
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { audioFiles, outputFolder, uploadedFiles } = body

    // Handle client-uploaded files (from Vercel Blob)
    if (uploadedFiles && uploadedFiles.length > 0) {
      return await processUploadedFiles(uploadedFiles, outputFolder)
    }

    // Handle traditional file uploads (FormData)
    const formData = await request.formData()
    const files = formData.getAll('audioFiles') as File[]
    const folder = formData.get('outputFolder') as string || './output'

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '没有选择音频文件' }, { status: 400 })
    }

    return await processFormFiles(files, folder)
  } catch (error) {
    console.error('Processing error:', error)
    return NextResponse.json({ error: '处理音频文件时发生错误' }, { status: 500 })
  }
}

async function processUploadedFiles(uploadedFiles: any[], outputFolder: string = './output') {
  try {
    // Create output directory if it doesn't exist
    const outputPath = join(process.cwd(), 'public', outputFolder)
    try {
      await mkdir(outputPath, { recursive: true })
    } catch (error) {
      // Directory already exists
    }

    const results = []

    for (const uploadedFile of uploadedFiles) {
      const fileName = uploadedFile.name
      const fileUrl = uploadedFile.url
      const filePath = join(outputPath, fileName)

      try {
        // Download the file from Vercel Blob
        await downloadFile(fileUrl, filePath)

        // Process the audio file with Python script
        const pythonResult = await processWithPython(outputPath, outputPath, fileName)
        
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
      } catch (error) {
        console.error('Error processing uploaded file:', error)
        // Create a fallback result if processing fails
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
    console.error('Processing uploaded files error:', error)
    return NextResponse.json({ error: '处理上传的音频文件时发生错误' }, { status: 500 })
  }
}

async function processFormFiles(audioFiles: File[], outputFolder: string = './output') {
  try {
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

      try {
        // Process the audio file with Python script
        const pythonResult = await processWithPython(outputPath, outputPath, fileName)
        
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
    console.error('Processing form files error:', error)
    return NextResponse.json({ error: '处理音频文件时发生错误' }, { status: 500 })
  }
}

async function processWithPython(inputPath: string, outputPath: string, fileName: string) {
  const pythonScriptPath = join(process.cwd(), 'main.py')
  const { stdout } = await execAsync(`python ${pythonScriptPath} "${inputPath}" "${outputPath}"`)
  
  // Parse the JSON output from Python script
  return JSON.parse(stdout)
}