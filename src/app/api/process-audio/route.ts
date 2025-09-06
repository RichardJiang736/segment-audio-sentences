import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { https } from 'follow-redirects'
import { createWriteStream } from 'fs'

const execAsync = promisify(exec)

export const maxDuration = 300;

// Configure API route to handle large request bodies
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '500mb',
    },
  },
  // Also set the max body size for the route
  maxBodySize: '500mb',
};

// Function to download file from URL
async function downloadFile(url: string, filePath: string): Promise<void> {
  console.log('开始下载文件:', { url, filePath }); // Debug log
  return new Promise((resolve, reject) => {
    const fileStream = createWriteStream(filePath)
    https.get(url, (response) => {
      console.log('收到响应，状态码:', response.statusCode); // Debug log
      response.pipe(fileStream)
      fileStream.on('finish', () => {
        fileStream.close()
        console.log('文件下载完成:', filePath); // Debug log
        resolve()
      })
    }).on('error', (error) => {
      console.error('文件下载错误:', error); // Debug log
      reject(error)
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    console.log('收到处理音频请求'); // Debug log
    
    // Check content type to determine how to parse the request
    const contentType = request.headers.get('content-type') || '';
    console.log('请求内容类型:', contentType); // Debug log
    
    if (contentType.includes('application/json')) {
      const body = await request.json();
      console.log('JSON 请求体:', body); // Debug log
      
      const { audioFiles, outputFolder, uploadedFiles } = body;

      // Handle client-uploaded files (from Vercel Blob)
      if (uploadedFiles && uploadedFiles.length > 0) {
        console.log('处理上传的文件，数量:', uploadedFiles.length); // Debug log
        return await processUploadedFiles(uploadedFiles, outputFolder);
      }
      
      // Handle traditional audioFiles parameter
      if (audioFiles && audioFiles.length > 0) {
        console.log('处理传统音频文件，数量:', audioFiles.length); // Debug log
        // Convert to the format expected by processUploadedFiles
        return await processUploadedFiles(audioFiles, outputFolder);
      }
    } else {
      // Handle traditional file uploads (FormData)
      console.log('处理表单数据上传'); // Debug log
      const formData = await request.formData();
      const files = formData.getAll('audioFiles') as File[];
      const folder = formData.get('outputFolder') as string || './output';
      console.log('表单数据文件数:', files.length, '输出文件夹:', folder); // Debug log

      if (!files || files.length === 0) {
        return NextResponse.json({ error: '没有选择音频文件' }, { status: 400 });
      }

      return await processFormFiles(files, folder);
    }
    
    // If we get here, no files were provided
    console.log('未提供文件'); // Debug log
    return NextResponse.json({ error: '没有提供音频文件' }, { status: 400 });
  } catch (error) {
    console.error('Processing error:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      // Check for common error types
      if (error.message.includes('request entity too large') || 
          error.message.includes('PayloadTooLargeError') ||
          error.message.includes('413')) {
        return NextResponse.json({ 
          error: '文件太大，无法处理。请使用文件大小小于10MB的文件，或尝试使用Vercel Blob上传方法。',
          details: '文件大小超过了Vercel服务器less函数的10MB限制。请尝试使用Vercel Blob上传方法处理大文件。',
          recommendation: '在Vercel上部署时，对于大于10MB的文件请使用Vercel Blob上传。'
        }, { status: 413 });
      }
      
      if (error.message.includes('Invalid file type') || 
          error.message.includes('Unsupported media type')) {
        return NextResponse.json({ 
          error: '不支持的文件格式。请上传音频文件（如MP3、WAV、M4A等）。',
          details: '不支持的文件格式。请上传音频文件（MP3、WAV、M4A等）。'
        }, { status: 415 });
      }
    }
    
    return NextResponse.json({ 
      error: '处理音频文件时发生错误',
      details: error instanceof Error ? error.message : '发生未知错误'
    }, { status: 500 });
  }
}

async function processUploadedFiles(uploadedFiles: any[], outputFolder: string = './output') {
  try {
    console.log('开始处理上传的文件，数量:', uploadedFiles.length, '输出文件夹:', outputFolder); // Debug log
    
    // Create output directory if it doesn't exist
    let outputPath = join(process.cwd(), 'public', outputFolder)
    console.log('输出路径:', outputPath); // Debug log
    
    try {
      // Ensure parent directories exist
      const parentDir = join(process.cwd(), 'public')
      await mkdir(parentDir, { recursive: true })
      await mkdir(outputPath, { recursive: true })
    } catch (error) {
      console.log('输出目录创建失败:', error); // Debug log
      // Try alternative path for Vercel
      const alternativePath = join('/tmp', outputFolder)
      console.log('尝试替代路径:', alternativePath); // Debug log
      try {
        await mkdir(alternativePath, { recursive: true })
        // If successful, use alternative path
        const newPath = join(alternativePath, 'output')
        await mkdir(newPath, { recursive: true })
        // Update outputPath to use alternative
        outputPath = newPath
        console.log('使用替代路径:', outputPath); // Debug log
      } catch (altError) {
        console.error('替代路径也失败:', altError); // Debug log
        throw error
      }
    }

    interface ProcessedFileResult {
      id: string
      name: string
      segments: any[]
      status: string
      progress: number
      error?: string
    }
    const results: ProcessedFileResult[] = []

    for (const uploadedFile of uploadedFiles) {
      const fileName = uploadedFile.name
      const fileUrl = uploadedFile.url
      const filePath = join(outputPath, fileName)
      
      console.log('处理文件:', { fileName, fileUrl, filePath }); // Debug log

      try {
        // Download the file from Vercel Blob
        console.log('开始下载文件:', fileUrl); // Debug log
        await downloadFile(fileUrl, filePath)
        console.log('文件下载完成:', filePath); // Debug log

        // Process the audio file with Python script
        console.log('开始处理Python脚本'); // Debug log
        const pythonResult = await processWithPython(outputPath, outputPath, fileName)
        console.log('Python脚本处理结果:', pythonResult); // Debug log
        
        // Check if Python script returned an error
        if (pythonResult.error) {
          throw new Error(`Python processing failed: ${pythonResult.error}`)
        }
        
        if (pythonResult.files && pythonResult.files.length > 0) {
          // Add all file results, not just the first one
          for (const fileResult of pythonResult.files) {
            // Handle the no_segments status
            let status = fileResult.status || 'Completed'
            let error: string | undefined = undefined
            
            if (status === 'no_segments') {
              status = 'Error'
              error = 'No speaker segments detected. The audio may be too short, contain no clear speech, or have quality issues.'
            }
            
            results.push({
              id: fileResult.id || fileName.replace(/\.[^/.]+$/, ""),
              name: fileResult.name || fileName,
              segments: fileResult.segments || [],
              status: status,
              progress: fileResult.progress || 100,
              error: error
            })
          }
        } else {
          // If no segments found, this indicates a processing issue
          console.warn('Python脚本未返回任何文件结果:', fileName); // Debug log
          throw new Error('Audio processing completed but no segments were generated. The audio file may be too short, corrupted, or in an unsupported format.')
        }
      } catch (error) {
        console.error('Error processing uploaded file:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown processing error'
        
        // Create a fallback result if processing fails
        results.push({
          id: fileName.replace(/\.[^/.]+$/, ""),
          name: fileName,
          segments: [],
          status: 'Error',
          progress: 0,
          error: errorMessage
        })
      }
    }

    console.log('处理完成，结果:', results); // Debug log
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
    let outputPath = join(process.cwd(), 'public', outputFolder)
    try {
      // Ensure parent directories exist
      const parentDir = join(process.cwd(), 'public')
      await mkdir(parentDir, { recursive: true })
      await mkdir(outputPath, { recursive: true })
    } catch (error) {
      console.log('输出目录创建失败:', error); // Debug log
      // Try alternative path for Vercel
      const alternativePath = join('/tmp', outputFolder)
      console.log('尝试替代路径:', alternativePath); // Debug log
      try {
        await mkdir(alternativePath, { recursive: true })
        // If successful, use alternative path
        const newPath = join(alternativePath, 'output')
        await mkdir(newPath, { recursive: true })
        outputPath = newPath
        console.log('使用替代路径:', outputPath); // Debug log
      } catch (altError) {
        console.error('替代路径也失败:', altError); // Debug log
        throw error
      }
    }

    interface ProcessedFileResult {
      id: string
      name: string
      segments: any[]
      status: string
      progress: number
      error?: string
    }
    const results: ProcessedFileResult[] = []

    for (const audioFile of audioFiles) {
      const fileBuffer = Buffer.from(await audioFile.arrayBuffer())
      const fileName = audioFile.name
      const filePath = join(outputPath, fileName)

      // Save the audio file
      await writeFile(filePath, fileBuffer)

      try {
        // Process the audio file with Python script
        const pythonResult = await processWithPython(outputPath, outputPath, fileName)
        
        // Check if Python script returned an error
        if (pythonResult.error) {
          throw new Error(`Python processing failed: ${pythonResult.error}`)
        }
        
        if (pythonResult.files && pythonResult.files.length > 0) {
          // Add all file results, not just the first one
          for (const fileResult of pythonResult.files) {
            // Handle the no_segments status
            let status = fileResult.status || 'Completed'
            let error: string | undefined = undefined
            
            if (status === 'no_segments') {
              status = 'Error'
              error = 'No speaker segments detected. The audio may be too short, contain no clear speech, or have quality issues.'
            }
            
            results.push({
              id: fileResult.id || fileName.replace(/\.[^/.]+$/, ""),
              name: fileResult.name || fileName,
              segments: fileResult.segments || [],
              status: status,
              progress: fileResult.progress || 100,
              error: error
            })
          }
        } else {
          // If no segments found, this indicates a processing issue
          console.warn('Python脚本未返回任何文件结果:', fileName); // Debug log
          throw new Error('Audio processing completed but no segments were generated. The audio file may be too short, corrupted, or in an unsupported format.')
        }
      } catch (pythonError) {
        console.error('Python script error:', pythonError)
        const errorMessage = pythonError instanceof Error ? pythonError.message : 'Unknown processing error'
        
        // Create a fallback result if Python script fails
        results.push({
          id: fileName.replace(/\.[^/.]+$/, ""),
          name: fileName,
          segments: [],
          status: 'Error',
          progress: 0,
          error: errorMessage
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
  const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:10000/process';
  console.log('调用Python服务:', { pythonServiceUrl, inputPath, outputPath, fileName }); // Debug log
  
  try {
    // For this to work, you'll need to:
    // 1. Deploy your Python service separately
    // 2. Set PYTHON_SERVICE_URL environment variable in Vercel
    const response = await fetch(pythonServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_src_dir: inputPath,
        target_root_dir: outputPath
      })
    });
    
    if (!response.ok) {
      throw new Error(`Python service error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Python服务返回结果:', result); // Debug log
    return result;
  } catch (error) {
    console.error('Python脚本执行错误:', error); // Debug log
    throw error
  }
}