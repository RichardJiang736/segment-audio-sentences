'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Upload, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import ReliableUpload from '@/components/ReliableUpload'

interface TestResult {
  fileName: string
  fileSize: string
  uploadMethod: string
  status: 'success' | 'error' | 'pending'
  error?: string
  timestamp: string
}

export default function UploadTestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isTesting, setIsTesting] = useState(false)

  const handleUploadComplete = (files: any[]) => {
    const newResults: TestResult[] = files.map(file => ({
      fileName: file.name,
      fileSize: formatFileSize(file.file.size),
      uploadMethod: file.url ? 'Vercel Blob' : 'Traditional',
      status: 'success',
      timestamp: new Date().toLocaleTimeString()
    }))
    
    setTestResults(prev => [...prev, ...newResults])
    setIsTesting(false)
  }

  const handleUploadError = (error: string) => {
    const newResult: TestResult = {
      fileName: 'Unknown',
      fileSize: 'Unknown',
      uploadMethod: 'Unknown',
      status: 'error',
      error: error,
      timestamp: new Date().toLocaleTimeString()
    }
    
    setTestResults(prev => [...prev, newResult])
    setIsTesting(false)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const clearResults = () => {
    setTestResults([])
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Upload Test Page</h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Test both Traditional and Vercel Blob upload methods to verify they work correctly
          </p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Testing Instructions:</strong><br />
            1. Test with small files (&lt;25MB) using both methods<br />
            2. Test with large files (&gt;25MB) using Vercel Blob method<br />
            3. Check for any error messages, especially token-related errors<br />
            4. Verify that files are actually processed and not just "fake uploaded"
          </AlertDescription>
        </Alert>

        {/* Upload Component */}
        <ReliableUpload 
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
        />

        {/* Test Results */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Test Results</CardTitle>
                <CardDescription>
                  Results from upload tests. Check for errors and verify successful uploads.
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearResults}
                disabled={testResults.length === 0}
              >
                Clear Results
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {testResults.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No test results yet. Upload some files to see the results.
              </p>
            ) : (
              <div className="space-y-3">
                {testResults.map((result, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border ${
                      result.status === 'success' 
                        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' 
                        : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {result.status === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{result.fileName}</span>
                            <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                              {result.status}
                            </Badge>
                            <Badge variant="outline">
                              {result.uploadMethod}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {result.fileSize} • {result.timestamp}
                          </div>
                          {result.error && (
                            <div className="text-sm text-red-600 mt-1">
                              Error: {result.error}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expected Behavior */}
        <Card>
          <CardHeader>
            <CardTitle>Expected Behavior</CardTitle>
            <CardDescription>
              What you should expect to see when the upload system is working correctly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-green-700 dark:text-green-400 mb-2">✅ Traditional Upload</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Works with files up to 500MB</li>
                  <li>• Shows upload progress animation</li>
                  <li>• Validates file format and size</li>
                  <li>• Should always work in Vercel environment</li>
                  <li>• Files should be processed after upload</li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-2">✅ Vercel Blob Upload</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Works with files of any size (up to 5TB)</li>
                  <li>• May show token errors in some environments</li>
                  <li>• Falls back to client-side upload if server URL fails</li>
                  <li>• Files should be processed after upload</li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-red-700 dark:text-red-400 mb-2">❌ Common Issues</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Token errors: Switch to Traditional Upload</li>
                  <li>• File size errors: Use appropriate method</li>
                  <li>• Format errors: Upload only supported audio formats</li>
                  <li>• Fake uploads: Files show success but aren't processed</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}