import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readdir } from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { execSync } from 'child_process'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFiles = formData.getAll('audioFiles') as File[]
    const outputFolder = formData.get('outputFolder') as string || './output'

    if (audioFiles.length === 0) {
      return NextResponse.json(
        { error: 'No audio files provided' },
        { status: 400 }
      )
    }

    // Create temp directory for uploaded files
    const tempDir = path.join(process.cwd(), 'temp')
    await mkdir(tempDir, { recursive: true })

    // Create output directory
    const outputDir = path.join(process.cwd(), outputFolder)
    await mkdir(outputDir, { recursive: true })

    // Save uploaded files
    const savedFiles = []
    for (const audioFile of audioFiles) {
      const fileName = audioFile.name
      const filePath = path.join(tempDir, fileName)
      const buffer = Buffer.from(await audioFile.arrayBuffer())
      await writeFile(filePath, buffer)
      const baseFileName = path.basename(fileName, path.extname(fileName))
      savedFiles.push({
        id: baseFileName, // Use the base filename as ID to match Python script
        name: fileName,
        path: filePath
      })
    }

    // Check if Python script exists
    const pythonScriptPath = path.join(process.cwd(), 'main.py')
    try {
      await readdir(path.dirname(pythonScriptPath))
    } catch (error) {
      return NextResponse.json(
        { error: 'Python backend script not found' },
        { status: 500 }
      )
    }

    // Run Python script for each file
    const results = []
    for (const file of savedFiles) {
      try {
        const command = `python3 "${pythonScriptPath}" "${tempDir}" "${outputDir}"`
        const { stdout, stderr } = await execAsync(command)
        
        if (stderr) {
          console.error(`Python stderr for ${file.name}:`, stderr)
        }

        // Parse the JSON output from Python script
        // The Python script now prints only JSON to stdout, so we can parse the entire stdout
        let pythonResult;
        try {
          pythonResult = JSON.parse(stdout.trim())
        } catch (parseError) {
          console.error(`Error parsing JSON from Python for ${file.name}:`, parseError)
          console.error(`Raw stdout:`, stdout)
          
          // If there's a pipeline loading error, provide a more specific error message
          if (stdout.includes("Failed to load pipeline")) {
            results.push({
              id: file.id,
              name: file.name,
              segments: [],
              status: 'error',
              progress: 0,
              error: 'Failed to load speaker diarization pipeline. Please check your Hugging Face token and internet connection.'
            })
            continue;
          }
          
          throw new Error(`Failed to parse JSON from Python script: ${parseError.message}`)
        }

        // Find the processed file in the Python result
        const processedFile = pythonResult.files.find((f: any) => 
          f.name === path.basename(file.name, path.extname(file.name))
        )

        if (processedFile) {
          // Update the audio URLs to use the correct API endpoints
          // For segments, we use the original filename as the fileId
          const baseFileName = path.basename(file.name, path.extname(file.name));
          const updatedSegments = processedFile.segments.map((segment: any) => ({
            ...segment,
            audioUrl: `/api/audio/${baseFileName}/${encodeURIComponent(segment.audioUrl.split('/').pop())}`
          }))
          
          results.push({
            ...processedFile,
            id: file.id,
            name: file.name,
            segments: updatedSegments
          })
        } else {
          results.push({
            id: file.id,
            name: file.name,
            segments: [],
            status: 'Completed', // Changed from 'error' to 'Completed' to show results even if no segments
            progress: 100
          })
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error)
        results.push({
          id: file.id,
          name: file.name,
          segments: [],
          status: 'Error',
          progress: 0,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        })
      }
    }

    // Clean up temp files
    try {
      execSync(`rm -rf "${tempDir}"`)
    } catch (error) {
      console.error('Error cleaning up temp files:', error)
    }

    return NextResponse.json({
      files: results,
      totalSegments: results.reduce((sum, file) => sum + (file.segments?.length || 0), 0),
      targetDir: outputFolder
    })

  } catch (error) {
    console.error('Error in process-audio API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}