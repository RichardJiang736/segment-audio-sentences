import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN
    
    return NextResponse.json({
      hasToken,
      message: hasToken 
        ? 'BLOB_READ_WRITE_TOKEN is configured' 
        : 'BLOB_READ_WRITE_TOKEN is not configured',
    })
  } catch (error) {
    console.error('Token check error:', error)
    return NextResponse.json(
      { 
        hasToken: false,
        message: 'Error checking token configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}