import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { https } from 'follow-redirects'
import { createWriteStream } from 'fs'

const execAsync = promisify(exec)

export const maxDuration = 300;

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
    return NextResponse.json({ error: '处理音频文件时发生错误' }, { status: 500 });
  }
}

async function processUploadedFiles(uploadedFiles: any[], outputFolder: string = './output') {
  try {
    console.log('开始处理上传的文件，数量:', uploadedFiles.length, '输出文件夹:', outputFolder); // Debug log
    
    // Create output directory if it doesn't exist
    const outputPath = join(process.cwd(), 'public', outputFolder)
    console.log('输出路径:', outputPath); // Debug log
    
    try {
      await mkdir(outputPath, { recursive: true })
    } catch (error) {
      // Directory already exists
      console.log('输出目录已存在或创建失败:', error); // Debug log
    }

    interface ProcessedFileResult {
      id: string
      name: string
      segments: any[]
      status: string
      progress: number
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
    const outputPath = join(process.cwd(), 'public', outputFolder)
    try {
      await mkdir(outputPath, { recursive: true })
    } catch (error) {
      // Directory already exists
    }

    interface ProcessedFileResult {
      id: string
      name: string
      segments: any[]
      status: string
      progress: number
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
  console.log('执行Python脚本:', { pythonScriptPath, inputPath, outputPath, fileName }); // Debug log
  
  try {
    const { stdout, stderr } = await execAsync(`python ${pythonScriptPath} "${inputPath}" "${outputPath}"`)
    console.log('Python脚本执行完成，stdout:', stdout); // Debug log
    if (stderr) {
      console.log('Python脚本stderr:', stderr); // Debug log
    }
    
    // Parse the JSON output from Python script
    const result = JSON.parse(stdout)
    console.log('解析后的Python结果:', result); // Debug log
    return result
  } catch (error) {
    console.error('Python脚本执行错误:', error); // Debug log
    throw error
  }
}