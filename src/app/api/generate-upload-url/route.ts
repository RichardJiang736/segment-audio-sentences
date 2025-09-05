import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileName, contentType } = body

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: '缺少文件名或内容类型' },
        { status: 400 }
      )
    }

    // Check if BLOB_READ_WRITE_TOKEN is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN not found in environment variables')
      return NextResponse.json(
        { 
          error: '未找到Vercel Blob令牌。请确保在Vercel环境变量中配置了BLOB_READ_WRITE_TOKEN。',
          recommendation: '在所有环境中使用传统上传方法进行可靠的文件上传。'
        },
        { status: 500 }  // TODO: Resolve the code triggering this error
      )
    }

    // Generate a unique pathname for the blob
    const pathname = `uploads/${Date.now()}-${fileName}`

    try {
      // Use the Vercel Blob SDK to generate an upload URL
      const blob = await put(pathname, new Blob(), {
        access: 'public',
        contentType,
        addRandomSuffix: false,
      })

      return NextResponse.json({
        uploadUrl: blob.url,
        publicUrl: blob.downloadUrl,
        pathname: blob.pathname,
        downloadUrl: blob.downloadUrl,
      })
    } catch (blobError) {
      console.error('Vercel Blob SDK error:', blobError)
      
      // Fallback: Try using the REST API
      try {
        const blobResponse = await fetch('https://blob.vercel-storage.com/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pathname,
            contentType,
            addRandomSuffix: false,
          }),
        })

        if (!blobResponse.ok) {
          const errorText = await blobResponse.text()
          console.error('Blob REST API failed:', errorText)
          
          // Provide more helpful error message based on the error
          let helpfulMessage = '使用SDK和REST API生成上传URL失败'  // TODO: Resolve the code triggering this error
          if (errorText.includes('Unauthorized') || errorText.includes('Invalid token')) {
            helpfulMessage = 'Vercel Blob认证失败。请确保正确配置了BLOB_READ_WRITE_TOKEN。'
          }
          
          return NextResponse.json(
            { 
              error: helpfulMessage,
              recommendation: '在所有环境中使用传统上传方法进行可靠的文件上传。'
            },
            { status: 500 }
          )
        }

        const blobData = await blobResponse.json()
        
        return NextResponse.json({
          uploadUrl: blobData.url,
          publicUrl: blobData.downloadUrl,
          pathname: blobData.pathname,
          downloadUrl: blobData.downloadUrl,
        })
      } catch (restError) {
        console.error('REST API fallback failed:', restError)
        return NextResponse.json(
          { 
            error: 'Vercel Blob认证失败。这是Vercel环境中已知的问题。',
            recommendation: '在所有环境中使用传统上传方法进行可靠的文件上传。'
          },
          { status: 500 }
        )
      }
    }
  } catch (error) {
    console.error('Generate upload URL error:', error)
    return NextResponse.json(
      { 
        error: '生成上传URL失败。',
        recommendation: '在所有环境中使用传统上传方法进行可靠的文件上传。'
      },
      { status: 500 }
    )
  }
}