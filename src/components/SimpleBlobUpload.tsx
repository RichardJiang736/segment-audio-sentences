'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Loader2, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { upload } from '@vercel/blob/client'
import type { PutBlobResult } from '@vercel/blob'

interface AudioFile {
  id: string
  name: string
  file: File
  url?: string
  status: 'Pending' | 'Uploading' | 'Uploaded' | 'Error'
  progress: number
  error?: string
}

interface SimpleBlobUploadProps {
  onUploadComplete: (files: AudioFile[]) => void
  onUploadError: (error: string) => void
}

export default function SimpleBlobUpload({ onUploadComplete, onUploadError }: SimpleBlobUploadProps) {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressIntervals = useRef<NodeJS.Timeout[]>([])

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      progressIntervals.current.forEach(interval => clearInterval(interval));
    };
  }, []);

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

  const uploadFiles = async () => {
    if (audioFiles.length === 0) {
      onUploadError('Please select at least one audio file')
      return
    }

    setIsUploading(true)
    const uploadedFiles: AudioFile[] = []

    try {
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
          // Upload file to Vercel Blob using the official client method
          // Simulate progress if real progress is not available
          let progressValue = 0;
          const progressSteps = [20, 50, 90, 100];
          let stepIndex = 0;
          const stepInterval = 2500; // 10 seconds / 4 steps = 2.5 seconds per step
          
          const blobResult: PutBlobResult = await upload(audioFile.name, audioFile.file, {
            access: 'public',
            handleUploadUrl: '/api/upload',
            onUploadProgress: (progress) => {
              // Clear any existing interval for this file
              const existingIntervalIndex = progressIntervals.current.findIndex(interval => 
                interval.toString().includes(audioFile.id)
              );
              if (existingIntervalIndex !== -1) {
                clearInterval(progressIntervals.current[existingIntervalIndex]);
                progressIntervals.current.splice(existingIntervalIndex, 1);
              }
              
              // Update progress in real-time
              setAudioFiles(prev => 
                prev.map(af => 
                  af.id === audioFile.id 
                    ? { ...af, progress: Math.round(progress * 100) }
                    : af
                )
              )
            }
          })
          
          // If no real progress was reported, simulate it
          if (progressValue === 0) {
            const interval = setInterval(() => {
              if (stepIndex < progressSteps.length) {
                progressValue = progressSteps[stepIndex];
                stepIndex++;
                setAudioFiles(prev => 
                  prev.map(af => 
                    af.id === audioFile.id 
                      ? { ...af, progress: progressValue }
                      : af
                  )
                )
              } else {
                // Clear this interval when complete
                const intervalIndex = progressIntervals.current.indexOf(interval);
                if (intervalIndex !== -1) {
                  progressIntervals.current.splice(intervalIndex, 1);
                }
                clearInterval(interval);
              }
            }, stepInterval);
            
            // Store interval reference
            progressIntervals.current.push(interval);
          }

          // Update file status to uploaded
          const uploadedFile = {
            ...audioFile,
            url: blobResult.url,
            status: 'Uploaded' as const,
            progress: 100
          }
          // Clear progress interval when upload completes
          const intervalIndex = progressIntervals.current.findIndex(interval => 
            interval.toString().includes(audioFile.id)
          );
          if (intervalIndex !== -1) {
            clearInterval(progressIntervals.current[intervalIndex]);
            progressIntervals.current.splice(intervalIndex, 1);
          }
          setAudioFiles(prev => 
            prev.map(af => 
              af.id === audioFile.id ? uploadedFile : af
            )
          )
          uploadedFiles.push(uploadedFile)
        } catch (error) {
          console.error('Upload error:', error)
          const errorMessage = error instanceof Error ? error.message : 'Upload failed'
          
          // Clear progress interval when upload fails
          const intervalIndex = progressIntervals.current.findIndex(interval => 
            interval.toString().includes(audioFile.id)
          );
          if (intervalIndex !== -1) {
            clearInterval(progressIntervals.current[intervalIndex]);
            progressIntervals.current.splice(intervalIndex, 1);
          }
          
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

      if (uploadedFiles.length > 0) {
        onUploadComplete(uploadedFiles)
      } else {
        onUploadError('All files failed to upload')
      }
    } catch (error) {
      console.error('Upload process error:', error)
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during upload'
      onUploadError(errorMessage)
    } finally {
      setIsUploading(false)
      // Clear all remaining progress intervals
      progressIntervals.current.forEach(interval => clearInterval(interval));
      progressIntervals.current = [];
    }
  }

  const resetUploads = () => {
    setAudioFiles([])
    // Clear all progress intervals
    progressIntervals.current.forEach(interval => clearInterval(interval));
    progressIntervals.current = [];
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Upload Audio Files (Simple Mode)</CardTitle>
        <CardDescription className="text-sm md:text-base">
          Select WAV, MP3, FLAC, M4A, or AAC files for processing (using Vercel Blob)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <Button
          onClick={uploadFiles}
          disabled={isUploading || audioFiles.length === 0 || audioFiles.every(f => f.status === 'Uploaded')}
          className="w-full text-sm md:text-base py-2 md:py-3"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            'Upload Files'
          )}
        </Button>

        {audioFiles.some(f => f.status === 'Error') && (
          <Alert variant="destructive">
            <AlertDescription>
              Some files failed to upload. Please check the error messages and try again.
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