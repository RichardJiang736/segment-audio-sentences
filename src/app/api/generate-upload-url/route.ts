// This route is no longer needed with the official client upload method
// We're keeping it for backward compatibility but it's not used in the new implementation
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      message: 'This endpoint is deprecated. Use the official client upload method instead.',
      recommendation: '在所有环境中使用传统上传方法进行可靠的文件上传。'
    },
    { status: 410 } // Gone
  )
}