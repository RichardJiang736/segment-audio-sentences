'use client'

import { useState, useRef, useEffect } from 'react'
import { type PutBlobResult } from '@vercel/blob';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Loader2, CheckCircle, XCircle, Trash2 } from 'lucide-react'

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
      onUploadError('请选择至少一个音频文件')
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
          console.log(`上传文件到Blob: ${audioFile.name}`)
          
          // Validate file format before attempting upload
          const validTypes = ['audio/wav', 'audio/mp3', 'audio/flac', 'audio/m4a', 'audio/aac']
          if (!validTypes.includes(audioFile.file.type) && !audioFile.name.match(/\.(wav|mp3|flac|m4a|aac)$/i)) {
            throw new Error('文件格式无效。请上传WAV、MP3、FLAC、M4A或AAC格式的文件。')
          }
          
          // Validate file size (empty files)
          if (audioFile.file.size === 0) {
            throw new Error('文件为空。请选择有效的音频文件。')
          }
          
          // Use the official Vercel Blob client upload method
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

          console.log(`Blob上传成功: ${blobResult.url}`)

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
          console.error('Blob上传错误:', error)
          const errorMessage = error instanceof Error ? error.message : 'Blob上传失败'
          
          // Clear progress interval when upload fails
          const intervalIndex = progressIntervals.current.findIndex(interval => 
            interval.toString().includes(audioFile.id)
          );
          if (intervalIndex !== -1) {
            clearInterval(progressIntervals.current[intervalIndex]);
            progressIntervals.current.splice(intervalIndex, 1);
          }
          
          // Provide more helpful error message with specific guidance
          let helpfulMessage = errorMessage
          
          if (errorMessage.includes('No token found') || errorMessage.includes('BLOB_READ_WRITE_TOKEN')) {
            helpfulMessage = '未找到Vercel Blob令牌。请确保在Vercel环境变量中配置了BLOB_READ_WRITE_TOKEN。'
          } else if (errorMessage.includes('Failed to retrieve the client token') || errorMessage.includes('authentication failed')) {
            helpfulMessage = 'Vercel Blob认证失败。这是Vercel环境中已知的问题。'
          } else if (errorMessage.includes('Invalid') && errorMessage.includes('format')) {
            helpfulMessage = '文件格式无效。请上传WAV、MP3、FLAC、M4A或AAC格式的文件。'
          } else {
            // Generic error - provide helpful guidance
            helpfulMessage = `${errorMessage} 请检查您的网络连接并重试。`
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

      if (uploadedFiles.length > 0) {
        onUploadComplete(uploadedFiles)
      } else {
        onUploadError('所有文件上传失败')
      }
    } catch (error) {
      console.error('上传过程错误:', error)
      const errorMessage = error instanceof Error ? error.message : '上传过程中发生错误'
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
        <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
          <Upload className="h-6 w-6" />
          上传音频文件
        </CardTitle>
        <CardDescription className="text-sm md:text-base">
          选择WAV、MP3、FLAC、M4A或AAC文件进行处理（最大5TB/文件）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            <strong>Vercel Blob上传:</strong> 此方法适用于所有文件大小。
            如果您遇到令牌错误，请确保在Vercel环境变量中正确配置了BLOB_READ_WRITE_TOKEN。
          </AlertDescription>
        </Alert>

        <div
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 md:p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
          onClick={handleUploadClick}
        >
          <Upload className="mx-auto h-10 w-10 md:h-12 md:w-12 text-muted-foreground mb-3 md:mb-4" />
          <p className="text-base md:text-lg font-medium mb-1 md:mb-2">
            拖拽音频文件到此处或点击选择
          </p>
          <p className="text-xs md:text-sm text-muted-foreground">
            支持WAV、MP3、FLAC、M4A、AAC（最大5TB/文件）
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
              <Label className="text-sm font-medium">已选择的文件:</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetUploads}
                className="text-xs md:text-sm px-2 py-1 h-auto"
              >
                清除所有
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
                上传中...
              </>
            ) : (
              '上传文件'
            )}
          </Button>
        </div>

        {audioFiles.some(f => f.status === 'Error') && (
          <Alert variant="destructive">
            <AlertDescription>
              部分文件上传失败。请检查错误信息并重试。
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