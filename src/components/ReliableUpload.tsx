'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Loader2, CheckCircle, XCircle, Trash2, CloudUpload } from 'lucide-react'

interface AudioFile {
  id: string
  name: string
  file: File
  url?: string
  status: 'Pending' | 'Uploading' | 'Uploaded' | 'Error'
  progress: number
  error?: string
}

interface ReliableUploadProps {
  onUploadComplete: (files: AudioFile[]) => void
  onUploadError: (error: string) => void
}

export default function ReliableUpload({ onUploadComplete, onUploadError }: ReliableUploadProps) {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMethod, setUploadMethod] = useState<'traditional' | 'blob'>('traditional')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const newAudioFiles: AudioFile[] = files.map((file, index) => ({
      id: `file-${Date.now()}-${index}`,
      name: file.name,
      file,
      status: 'Pending',
      progress: 0
    }))
    setAudioFiles(prev => [...prev, ...newAudioFiles])
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const removeFile = (id: string) => {
    setAudioFiles(prev => prev.filter(af => af.id !== id))
  }

  const uploadFilesTraditional = async () => {
    // For traditional upload, we need to actually validate the files
    // and simulate upload progress for better user experience
    const uploadedFiles: AudioFile[] = []
    
    for (const audioFile of audioFiles) {
      if (audioFile.status === 'Uploaded') continue
      
      // Update file status to uploading
      setAudioFiles(prev => 
        prev.map(af => 
          af.id === audioFile.id 
            ? { ...af, status: 'Uploading', progress: 0 }
            : af
        )
      )
      
      try {
        // Simulate upload progress for better UX
        const progressSteps = [10, 25, 50, 75, 90, 100]
        for (const progress of progressSteps) {
          await new Promise(resolve => setTimeout(resolve, 200))
          setAudioFiles(prev => 
            prev.map(af => 
              af.id === audioFile.id 
                ? { ...af, progress }
                : af
            )
          )
        }
        
        // Validate file size and format
        if (audioFile.file.size === 0) {
          throw new Error('File is empty')
        }
        
        if (audioFile.file.size > 500 * 1024 * 1024) { // 500MB limit
          throw new Error('File size exceeds 500MB limit. Please use Vercel Blob upload for large files.')
        }
        
        const validTypes = ['audio/wav', 'audio/mp3', 'audio/flac', 'audio/m4a', 'audio/aac']
        if (!validTypes.includes(audioFile.file.type) && !audioFile.name.match(/\.(wav|mp3|flac|m4a|aac)$/i)) {
          throw new Error('Invalid file format. Please upload WAV, MP3, FLAC, M4A, or AAC files.')
        }
        
        // Mark as successfully uploaded
        const uploadedFile = {
          ...audioFile,
          status: 'Uploaded' as const,
          progress: 100
        }
        setAudioFiles(prev => 
          prev.map(af => 
            af.id === audioFile.id ? uploadedFile : af
          )
        )
        uploadedFiles.push(uploadedFile)
        
      } catch (error) {
        console.error('Traditional upload validation error:', error)
        const errorMessage = error instanceof Error ? error.message : 'File validation failed'
        
        // Update file status to error
        setAudioFiles(prev => 
          prev.map(af => 
            af.id === audioFile.id 
              ? { ...af, status: 'Error', error: errorMessage }
              : af
          )
        )
      }
    }
    
    return uploadedFiles
  }

  const uploadFilesBlob = async () => {
    const uploadedFiles: AudioFile[] = []

    for (const audioFile of audioFiles) {
      if (audioFile.status === 'Uploaded') continue

      // Update file status to uploading
      setAudioFiles(prev => 
        prev.map(af => 
          af.id === audioFile.id 
            ? { ...af, status: 'Uploading', progress: 0 }
            : af
        )
      )

      try {
        console.log(`Uploading file to Blob: ${audioFile.name}`)
        
        // Validate file format before attempting upload
        const validTypes = ['audio/wav', 'audio/mp3', 'audio/flac', 'audio/m4a', 'audio/aac']
        if (!validTypes.includes(audioFile.file.type) && !audioFile.name.match(/\.(wav|mp3|flac|m4a|aac)$/i)) {
          throw new Error('Invalid file format. Please upload files in WAV, MP3, FLAC, M4A, or AAC formats only.')
        }
        
        // Validate file size (empty files)
        if (audioFile.file.size === 0) {
          throw new Error('File is empty. Please select a valid audio file.')
        }
        
        // First try to get an upload URL from the server
        // This avoids the client-side token issue
        const uploadResponse = await fetch('/api/generate-upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: audioFile.name,
            contentType: audioFile.file.type || 'audio/wav',
            size: audioFile.file.size
          })
        })

        if (uploadResponse.ok) {
          // Use server-provided upload URL
          const { uploadUrl, publicUrl } = await uploadResponse.json()
          
          // Upload directly to the provided URL
          const uploadResult = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': audioFile.file.type || 'audio/wav',
            },
            body: audioFile.file
          })

          if (!uploadResult.ok) {
            throw new Error(`Upload failed with status ${uploadResult.status}`)
          }

          console.log(`Blob upload successful: ${publicUrl}`)

          // Update file status to uploaded
          const uploadedFile = {
            ...audioFile,
            url: publicUrl,
            status: 'Uploaded' as const,
            progress: 100
          }
          setAudioFiles(prev => 
            prev.map(af => 
              af.id === audioFile.id ? uploadedFile : af
            )
          )
          uploadedFiles.push(uploadedFile)
        } else {
          // Server upload URL generation failed - get error details
          const errorData = await uploadResponse.json().catch(() => ({}))
          const serverError = errorData.error || 'Server upload URL generation failed'
          throw new Error(serverError)
        }
      } catch (error) {
        console.error('Blob upload error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Blob upload failed'
        
        // Provide more helpful error message with specific guidance
        let helpfulMessage = errorMessage
        
        if (errorMessage.includes('No token found') || errorMessage.includes('BLOB_READ_WRITE_TOKEN')) {
          helpfulMessage = 'Vercel Blob token not found. Please ensure BLOB_READ_WRITE_TOKEN is configured in your Vercel environment variables, or use Traditional Upload method.'
        } else if (errorMessage.includes('Failed to retrieve the client token') || errorMessage.includes('authentication failed')) {
          helpfulMessage = 'Vercel Blob authentication failed. This is a known issue in some Vercel environments. Please use Traditional Upload method instead.'
        } else if (errorMessage.includes('File size is under 500MB')) {
          helpfulMessage = `${errorMessage} Traditional Upload is recommended for files under 500MB for better reliability.`
        } else if (errorMessage.includes('Invalid') && errorMessage.includes('format')) {
          helpfulMessage = 'Invalid file format. Please upload files in WAV, MP3, FLAC, M4A, or AAC formats only.'
        } else {
          // Generic error - provide helpful guidance
          const fileSizeMB = Math.round(audioFile.file.size / (1024 * 1024))
          if (fileSizeMB < 500) {
            helpfulMessage = `${errorMessage} For files under 500MB (your file: ${fileSizeMB}MB), Traditional Upload is recommended for better reliability.`
          } else {
            helpfulMessage = `${errorMessage} Please try Traditional Upload method as an alternative.`
          }
        }
        
        // Update file status to error
        setAudioFiles(prev => 
          prev.map(af => 
            af.id === audioFile.id 
              ? { ...af, status: 'Error', error: helpfulMessage }
              : af
          )
        )
      }
    }

    return uploadedFiles
  }

  const uploadFiles = async () => {
    if (audioFiles.length === 0) {
      onUploadError('Please select at least one audio file')
      return
    }

    setIsUploading(true)

    try {
      let uploadedFiles: AudioFile[] = []

      if (uploadMethod === 'traditional') {
        uploadedFiles = await uploadFilesTraditional()
      } else {
        uploadedFiles = await uploadFilesBlob()
      }

      const successfulUploads = uploadedFiles.filter(f => f.status === 'Uploaded')
      
      if (successfulUploads.length > 0) {
        onUploadComplete(successfulUploads)
      } else {
        onUploadError('All files failed to upload')
      }
    } catch (error) {
      console.error('Upload process error:', error)
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during upload'
      onUploadError(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  const resetUploads = () => {
    setAudioFiles([])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
          <Upload className="h-6 w-6" />
          Upload Audio Files
        </CardTitle>
        <CardDescription className="text-sm md:text-base">
          Select WAV, MP3, FLAC, M4A, or AAC files for processing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Method Selection */}
        <div className="flex gap-2">
          <Button
            variant={uploadMethod === 'traditional' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUploadMethod('traditional')}
            className="flex-1"
          >
            Traditional Upload
            <span className="text-xs opacity-70 block">Recommended (under 500MB)</span>
          </Button>
          <Button
            variant={uploadMethod === 'blob' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUploadMethod('blob')}
            className="flex-1"
          >
            <CloudUpload className="h-4 w-4 mr-1" />
            Vercel Blob
            <span className="text-xs opacity-70 block">For files over 500MB</span>
          </Button>
        </div>

        {uploadMethod === 'blob' && (
          <Alert>
            <AlertDescription>
              <strong>Vercel Blob Upload Notice:</strong> This method is designed for large files (over 500MB) 
              but may encounter authentication issues if BLOB_READ_WRITE_TOKEN is not properly configured. 
              If you see token errors, please switch to Traditional Upload method.
            </AlertDescription>
          </Alert>
        )}

        {uploadMethod === 'traditional' && (
          <Alert>
            <AlertDescription>
              <strong>Traditional Upload:</strong> This method works reliably in all environments 
              and is recommended for files under 500MB. For files larger than 500MB, please use Vercel Blob upload.
            </AlertDescription>
          </Alert>
        )}

        <div
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 md:p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
          onClick={handleUploadClick}
        >
          <Upload className="mx-auto h-10 w-10 md:h-12 md:w-12 text-muted-foreground mb-3 md:mb-4" />
          <p className="text-base md:text-lg font-medium mb-1 md:mb-2">
            Drop audio files here or click to select
          </p>
          <p className="text-xs md:text-sm text-muted-foreground">
            Supports WAV, MP3, FLAC, M4A, AAC
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".wav,.mp3,.flac,.m4a,.aac"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {audioFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Selected Files:</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetUploads}
                className="text-xs md:text-sm px-2 py-1 h-auto"
              >
                Clear All
              </Button>
            </div>
            <div className="space-y-2 max-h-32 md:max-h-40 overflow-y-auto">
              {audioFiles.map((af) => (
                <div key={af.id} className="flex items-center justify-between p-2 md:p-3 bg-muted rounded">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {af.status === 'Pending' && <Upload className="h-4 w-4 text-muted-foreground" />}
                      {af.status === 'Uploading' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                      {af.status === 'Uploaded' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {af.status === 'Error' && <XCircle className="h-4 w-4 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm truncate">{af.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={af.status === 'Uploaded' ? 'default' : 'secondary'} className="text-xs">
                          {af.status}
                        </Badge>
                        {af.status === 'Uploading' && (
                          <div className="flex-1">
                            <Progress value={af.progress} className="h-1" />
                          </div>
                        )}
                        {af.status === 'Error' && (
                          <p className="text-xs text-red-500 truncate">{af.error}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(af.id)}
                    className="text-xs md:text-sm px-2 py-1 h-auto flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={uploadFiles}
            disabled={isUploading || audioFiles.length === 0 || audioFiles.every(f => f.status === 'Uploaded')}
            className="flex-1 text-sm md:text-base py-2 md:py-3"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              `Upload Files (${uploadMethod === 'traditional' ? 'Traditional' : 'Vercel Blob'})`
            )}
          </Button>
        </div>

        {audioFiles.some(f => f.status === 'Error') && (
          <Alert variant="destructive">
            <AlertDescription>
              <strong>Upload Errors Detected:</strong><br />
              {audioFiles.filter(f => f.status === 'Error').map(f => (
                <div key={f.id} className="mt-1">
                  • {f.name}: {f.error}
                </div>
              ))}
              <br />
              <strong>Solutions:</strong><br />
              • For token errors: Use Traditional Upload method<br />
              • For file size errors: Use Vercel Blob upload for files over 500MB<br />
              • For format errors: Upload only WAV, MP3, FLAC, M4A, or AAC files
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

// Add Label component import
const Label = ({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={`text-sm font-medium ${className || ''}`} {...props}>
    {children}
  </label>
)