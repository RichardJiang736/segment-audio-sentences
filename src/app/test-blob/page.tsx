'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { upload } from '@vercel/blob/client'
import type { PutBlobResult } from '@vercel/blob'

interface TestFile {
  id: string
  name: string
  file: File
  url?: string
  status: 'Pending' | 'Uploading' | 'Uploaded' | 'Error'
  progress: number
  error?: string
}

export default function TestBlobPage() {
  const [files, setFiles] = useState<TestFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tokenStatus, setTokenStatus] = useState<{ hasToken: boolean; message: string } | null>(null)

  // Check token status on component mount
  useEffect(() => {
    const checkTokenStatus = async () => {
      try {
        const response = await fetch('/api/check-blob-token')
        const data = await response.json()
        setTokenStatus(data)
      } catch (error) {
        console.error('Failed to check token status:', error)
        setTokenStatus({ hasToken: false, message: 'Failed to check token status' })
      }
    }
    checkTokenStatus()
  }, [])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    const newFiles: TestFile[] = selectedFiles.map((file, index) => ({
      id: `file-${Date.now()}-${index}`,
      name: file.name,
      file,
      status: 'Pending',
      progress: 0
    }))
    setFiles(prev => [...prev, ...newFiles])
  }

  const uploadFiles = async () => {
    if (files.length === 0) {
      setError('Please select at least one file')
      return
    }

    setIsUploading(true)
    setError(null)
    setSuccess(null)

    try {
      for (const testFile of files) {
        if (testFile.status === 'Uploaded') continue

        // Update file status to uploading
        setFiles(prev => 
          prev.map(f => 
            f.id === testFile.id 
              ? { ...f, status: 'Uploading', progress: 0 }
              : f
          )
        )

        try {
          console.log(`Uploading file: ${testFile.name}`)
          
          // Upload file to Vercel Blob using the official client method
          const blobResult: PutBlobResult = await upload(testFile.name, testFile.file, {
            access: 'public',
            handleUploadUrl: '/api/upload',
            onUploadProgress: (progress) => {
              // Update progress in real-time
              setFiles(prev => 
                prev.map(f => 
                  f.id === testFile.id 
                    ? { ...f, progress: Math.round(progress * 100) }
                    : f
                )
              )
            }
          })

          console.log(`Upload successful: ${blobResult.url}`)

          // Update file status to uploaded
          setFiles(prev => 
            prev.map(f => 
              f.id === testFile.id 
                ? { ...f, url: blobResult.url, status: 'Uploaded', progress: 100 }
                : f
            )
          )
        } catch (uploadError) {
          console.error('Upload error:', uploadError)
          const errorMessage = uploadError instanceof Error ? uploadError.message : 'Upload failed'
          
          // Update file status to error
          setFiles(prev => 
            prev.map(f => 
              f.id === testFile.id 
                ? { ...f, status: 'Error', error: errorMessage }
                : f
            )
          )
        }
      }

      const uploadedCount = files.filter(f => f.status === 'Uploaded').length
      if (uploadedCount > 0) {
        setSuccess(`Successfully uploaded ${uploadedCount} file(s)`)
      } else {
        setError('All files failed to upload')
      }
    } catch (error) {
      console.error('Upload process error:', error)
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during upload'
      setError(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  const resetAll = () => {
    setFiles([])
    setError(null)
    setSuccess(null)
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Vercel Blob Upload Test</h1>
          <p className="text-base md:text-lg text-muted-foreground">
            Test Vercel Blob upload functionality
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Test Upload</CardTitle>
            <CardDescription>
              This page tests the basic Vercel Blob upload functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 md:p-8 text-center">
              <Upload className="mx-auto h-10 w-10 md:h-12 md:w-12 text-muted-foreground mb-3 md:mb-4" />
              <p className="text-base md:text-lg font-medium mb-1 md:mb-2">
                Select files to test upload
              </p>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="block mx-auto"
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">Selected Files:</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex-shrink-0">
                          {f.status === 'Pending' && <Upload className="h-4 w-4 text-muted-foreground" />}
                          {f.status === 'Uploading' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                          {f.status === 'Uploaded' && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {f.status === 'Error' && <XCircle className="h-4 w-4 text-red-500" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm truncate">{f.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-1 rounded ${
                              f.status === 'Uploaded' ? 'bg-green-100 text-green-800' :
                              f.status === 'Error' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {f.status}
                            </span>
                            {f.status === 'Uploading' && (
                              <div className="flex-1">
                                <Progress value={f.progress} className="h-1" />
                              </div>
                            )}
                            {f.status === 'Error' && (
                              <p className="text-xs text-red-500 truncate">{f.error}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={uploadFiles}
                disabled={isUploading || files.length === 0 || files.every(f => f.status === 'Uploaded')}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Test Upload'
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={resetAll}
              >
                Reset
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="font-medium mb-2">Debug Information:</h3>
              <div className="text-sm space-y-1">
                <p><strong>BLOB_READ_WRITE_TOKEN:</strong> {
                  tokenStatus ? 
                    <span className={tokenStatus.hasToken ? 'text-green-600' : 'text-red-600'}>
                      {tokenStatus.message}
                    </span>
                    : 'Checking...'
                }</p>
                <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
                <p><strong>Vercel Environment:</strong> {process.env.BLOB_READ_WRITE_TOKEN || 'Unknown'}</p>
                {!tokenStatus?.hasToken && (
                  <p className="text-red-600 text-xs mt-2">
                    <strong>Recommendation:</strong> Configure BLOB_READ_WRITE_TOKEN in Vercel environment variables or use Traditional Upload
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}