'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Upload, Play, Pause, Loader2, Download } from 'lucide-react'
import WaveformVisualizer from '@/components/WaveformVisualizer'
import DirectBlobUpload from '@/components/DirectBlobUpload'
import { jsPDF } from 'jspdf'
import PizZip from 'pizzip'

interface AudioFile {
  id: string
  name: string
  file: File
  url?: string
  status?: 'pending' | 'uploading' | 'uploaded' | 'error'
  progress?: number
}

interface Segment {
  id: string
  speaker: string
  startTime: number
  endTime: number
  duration: number
  audioUrl: string
}

interface ProcessedFile {
  id: string
  name: string
  segments: Segment[]
  status: 'Pending' | 'Processing' | 'Completed' | 'Error'
  progress: number
  yiTranscription?: string
  chineseTranslation?: string
}

export default function Home() {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [outputFolder, setOutputFolder] = useState<string>('./output')
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const newAudioFiles: AudioFile[] = files.map((file, index) => ({
      id: `file-${Date.now()}-${index}`,
      name: file.name,
      file
    }))
    setAudioFiles(prev => [...prev, ...newAudioFiles])
    
    // Initialize processed files
    const newProcessedFiles: ProcessedFile[] = newAudioFiles.map(af => ({
      id: af.id,
      name: af.name,
      segments: [],
      status: 'Pending',
      progress: 0,
      yiTranscription: '',
      chineseTranslation: ''
    }))
    setProcessedFiles(prev => [...prev, ...newProcessedFiles])
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // Handle files uploaded via BlobUpload component
  const handleBlobUploadComplete = (uploadedFiles: AudioFile[]) => {
    setAudioFiles(uploadedFiles)
    
    // Initialize processed files
    const newProcessedFiles: ProcessedFile[] = uploadedFiles.map(af => ({
      id: af.id,
      name: af.name,
      segments: [],
      status: 'Pending',
      progress: 0,
      yiTranscription: '',
      chineseTranslation: ''
    }))
    setProcessedFiles(prev => [...prev, ...newProcessedFiles])
  }

  // Handle errors from BlobUpload component
  const handleBlobUploadError = (errorMessage: string) => {
    setError(errorMessage)
  }

  // Process uploaded files (from Blob storage)
  const processUploadedFiles = async () => {
    if (audioFiles.length === 0) {
      setError('请选择至少一个音频文件')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      console.log('发送请求到 /api/process-audio (uploaded files)') // Debug log
      
      const response = await fetch('/api/process-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadedFiles: audioFiles,
          outputFolder: outputFolder
        })
      })

      console.log('响应状态:', response.status) // Debug log

      if (!response.ok) {
        let errorMessage = '处理音频文件失败'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
          console.error('API 错误:', errorData) // Debug log
        } catch (parseError) {
          console.error('解析错误响应失败:', parseError) // Debug log
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('API 响应:', result) // Debug log
      
      // Update processed files with results
      if (result.files && result.files.length > 0) {
        const updatedFiles = result.files.map((file: any) => ({
          id: file.id,
          name: file.name,
          segments: file.segments || [],
          status: file.status || 'Completed',
          progress: file.progress || 100,
          yiTranscription: '',
          chineseTranslation: ''
        }));
        console.log('更新后的文件:', updatedFiles) // Debug log
        setProcessedFiles(prevFiles => {
          console.log('设置处理文件，之前:', prevFiles, '新的:', updatedFiles) // Debug log
          return updatedFiles
        });
      } else {
        // If no files in result, update status of existing files to show completion
        setProcessedFiles(prev => 
          prev.map(pf => ({
            ...pf,
            status: 'Completed',
            progress: 100,
            yiTranscription: pf.yiTranscription || '',
            chineseTranslation: pf.chineseTranslation || ''
          }))
        );
      }
    } catch (err) {
      console.error('处理错误:', err) // Debug log
      const errorMessage = err instanceof Error ? err.message : '发生错误'
      setError(errorMessage)
      // Update file status to show error but don't reset the page
      setProcessedFiles(prev => 
        prev.map(pf => ({
          ...pf,
          status: 'Error',
          progress: 0,
          yiTranscription: pf.yiTranscription || '',
          chineseTranslation: pf.chineseTranslation || ''
        }))
      );
    } finally {
      setIsProcessing(false)
    }
  }

  // Process traditional form files (fallback for smaller files)
  const processFormFiles = async () => {
    if (audioFiles.length === 0) {
      setError('请选择至少一个音频文件')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      audioFiles.forEach(af => {
        formData.append('audioFiles', af.file)
      })
      formData.append('outputFolder', outputFolder)

      console.log('发送请求到 /api/process-audio (form files)') // Debug log
      
      const response = await fetch('/api/process-audio', {
        method: 'POST',
        body: formData
      })

      console.log('响应状态:', response.status) // Debug log

      if (!response.ok) {
        let errorMessage = '处理音频文件失败'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
          console.error('API 错误:', errorData) // Debug log
        } catch (parseError) {
          console.error('解析错误响应失败:', parseError) // Debug log
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('API 响应:', result) // Debug log
      
      // Update processed files with results
      if (result.files && result.files.length > 0) {
        const updatedFiles = result.files.map((file: any) => ({
          id: file.id,
          name: file.name,
          segments: file.segments || [],
          status: file.status || 'Completed',
          progress: file.progress || 100,
          yiTranscription: '',
          chineseTranslation: ''
        }));
        console.log('更新后的文件:', updatedFiles) // Debug log
        setProcessedFiles(prevFiles => {
          console.log('设置处理文件，之前:', prevFiles, '新的:', updatedFiles) // Debug log
          return updatedFiles
        });
      } else {
        // If no files in result, update status of existing files to show completion
        setProcessedFiles(prev => 
          prev.map(pf => ({
            ...pf,
            status: 'Completed',
            progress: 100,
            yiTranscription: pf.yiTranscription || '',
            chineseTranslation: pf.chineseTranslation || ''
          }))
        );
      }
    } catch (err) {
      console.error('处理错误:', err) // Debug log
      const errorMessage = err instanceof Error ? err.message : '发生错误'
      setError(errorMessage)
      // Update file status to show error but don't reset the page
      setProcessedFiles(prev => 
        prev.map(pf => ({
          ...pf,
          status: 'Error',
          progress: 0,
          yiTranscription: pf.yiTranscription || '',
          chineseTranslation: pf.chineseTranslation || ''
        }))
      );
    } finally {
      setIsProcessing(false)
    }
  }

  // Main process function - decides which method to use
  const processAudioFiles = async () => {
    // Check if files are already uploaded to Blob storage
    const hasBlobFiles = audioFiles.some(af => af.url && af.status === 'uploaded')
    
    if (hasBlobFiles) {
      await processUploadedFiles()
    } else {
      await processFormFiles()
    }
  }

  const removeFile = (id: string) => {
    setAudioFiles(prev => prev.filter(af => af.id !== id))
    setProcessedFiles(prev => prev.filter(pf => pf.id !== id))
  }

  const updateYiTranscription = (id: string, value: string) => {
    setProcessedFiles(prev => 
      prev.map(pf => 
        pf.id === id ? { ...pf, yiTranscription: value } : pf
      )
    )
  }

  const updateChineseTranslation = (id: string, value: string) => {
    setProcessedFiles(prev => 
      prev.map(pf => 
        pf.id === id ? { ...pf, chineseTranslation: value } : pf
      )
    )
  }

  const exportToFile = async (content: string, filename: string, format: 'pdf' | 'docx') => {
    if (!content.trim()) {
      alert('内容为空。请输入一些文本以导出。');
      return;
    }

    if (format === 'pdf') {
      try {
        // Use the browser's built-in print functionality to generate PDF
        // This has better Unicode support for Chinese characters
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          throw new Error('无法打开打印窗口，请检查弹出窗口阻止器设置。');
        }

        // Create HTML content with proper Chinese character support
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>${filename}</title>
            <style>
              body {
                font-family: 'Microsoft YaHei', 'SimSun', 'Arial Unicode MS', 'Arial', sans-serif;
                margin: 20px;
                line-height: 1.6;
              }
              h1 {
                text-align: center;
                color: #333;
              }
              .content {
                white-space: pre-wrap;
                word-wrap: break-word;
              }
              @media print {
                body {
                  margin: 10px;
                }
              }
            </style>
          </head>
          <body>
            <h1>${filename}</h1>
            <div class="content">${content.replace(/\n/g, '<br>')}</div>
            <script>
              // Automatically trigger print dialog when page loads
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  setTimeout(function() {
                    window.close();
                  }, 1000);
                }, 500);
              };
              
              // Handle print completion
              window.onafterprint = function() {
                setTimeout(function() {
                  window.close();
                }, 1000);
              };
            </script>
          </body>
          </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Focus the window to ensure print dialog appears
        printWindow.focus();
      } catch (error) {
        console.error('PDF generation error:', error);
        alert('PDF生成失败，请重试或使用DOCX格式导出。');
      }
    } else {
      // For DOCX, create a proper document structure
      const zip = new PizZip();
      
      // Add required files for a valid DOCX
      zip.file(
        "[Content_Types].xml",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '</Types>'
      );
      
      zip.file(
        "_rels/.rels",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '</Relationships>'
      );
      
      zip.file(
        "word/_rels/document.xml.rels",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '</Relationships>'
      );
      
      // Create the main document content
      let escapedContent = content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      
      // Handle line breaks properly
      if (escapedContent.includes('\n')) {
        const lines = escapedContent.split('\n');
        escapedContent = lines.map(line => `<w:t>${line}</w:t>`).join("</w:r></w:p><w:p><w:r>");
      } else {
        escapedContent = `<w:t>${escapedContent}</w:t>`;
      }
        
      const documentXml = 
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<w:body>' +
        `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${filename}</w:t></w:r></w:p>` +
        '<w:p><w:r></w:r></w:p>' + // Empty paragraph for spacing
        '<w:p><w:r>' + escapedContent + '</w:r></w:p>' +
        '</w:body>' +
        '</w:document>';
      
      zip.file("word/document.xml", documentXml);
      
      try {
        // Generate the DOCX file
        const blob = zip.generate({type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.docx`;
        
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('生成 DOCX 错误:', error);
        alert('生成 DOCX 文件时出错。请重试。');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">说话人分离</h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              上传音频文件以分离和识别不同的说话人
            </p>
          </div>

        {/* Upload Section */}
        <DirectBlobUpload 
          onUploadComplete={handleBlobUploadComplete}
          onUploadError={handleBlobUploadError}
        />

        {/* Traditional Upload Section (fallback) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">传统上传 (小文件)</CardTitle>
            <CardDescription className="text-sm md:text-base">
              对于小文件 (小于 25MB)，可以使用传统上传方式
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="outputFolder" className="text-sm font-medium">输出文件夹</Label>
              <Input
                id="outputFolder"
                value={outputFolder}
                onChange={(e) => setOutputFolder(e.target.value)}
                placeholder="./output"
                className="text-sm"
              />
            </div>

            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 md:p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onClick={handleUploadClick}
            >
              <Upload className="mx-auto h-10 w-10 md:h-12 md:w-12 text-muted-foreground mb-3 md:mb-4" />
              <p className="text-base md:text-lg font-medium mb-1 md:mb-2">
                拖放音频文件到此处或点击选择
              </p>
              <p className="text-xs md:text-sm text-muted-foreground">
                支持 WAV, MP3, FLAC, M4A, AAC (最大 25MB)
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
                <Label className="text-sm font-medium">已选择的文件:</Label>
                <div className="space-y-2 max-h-32 md:max-h-40 overflow-y-auto">
                  {audioFiles.map((af) => (
                    <div key={af.id} className="flex items-center justify-between p-2 md:p-3 bg-muted rounded">
                      <span className="text-xs md:text-sm truncate flex-1 mr-2">{af.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(af.id)}
                        className="text-xs md:text-sm px-2 py-1 h-auto"
                      >
                        移除
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={processAudioFiles}
              disabled={isProcessing || audioFiles.length === 0}
              className="w-full text-sm md:text-base py-2 md:py-3"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                '处理音频文件'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results Section */}
        {(processedFiles.length > 0 || isProcessing) && (
          <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold">结果</h2>
            <div className="grid gap-4 md:gap-6">
              {processedFiles.map((pf) => (
                <Card key={pf.id}>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                        <span className="truncate">{pf.name}</span>
                        <Badge variant={pf.status === 'Completed' ? 'default' : 'secondary'} className="text-xs">
                          {pf.status === 'Pending' ? '等待中' : 
                           pf.status === 'Processing' ? '处理中' : 
                           pf.status === 'Completed' ? '已完成' : '错误'}
                        </Badge>
                      </CardTitle>
                      {pf.status === 'Processing' && (
                        <div className="w-full sm:w-24">
                          <Progress value={pf.progress} />
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {pf.segments.length > 0 ? (
                      <WaveformVisualizer
                        fileName={pf.name}
                        segments={pf.segments}
                        audioUrl={`/api/audio/${pf.id}?type=original`}
                      />
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        {pf.status === 'Pending' ? '等待处理...' : 
                         pf.status === 'Processing' ? '处理中...' : 
                         '此音频文件中未检测到说话人片段。'}
                      </p>
                    )}
                    
                    {/* Text Input Sections */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      {/* 彝语抄写 Section */}
                      <Card className="border border-muted">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">彝语抄写</CardTitle>
                          <CardDescription>用原始彝语转录音频</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <Textarea
                            value={pf.yiTranscription || ''}
                            onChange={(e) => updateYiTranscription(pf.id, e.target.value)}
                            placeholder="在此输入彝语转录..."
                            className="min-h-32"
                            onKeyDown={(e) => {
                              // Prevent default behavior for some keys to improve performance
                              if (e.key === 'Tab') {
                                e.preventDefault();
                                const target = e.target as HTMLTextAreaElement;
                                const start = target.selectionStart;
                                const end = target.selectionEnd;
                                target.value = target.value.substring(0, start) + '\t' + target.value.substring(end);
                                target.selectionStart = target.selectionEnd = start + 1;
                              }
                            }}
                          />
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              onClick={async () => await exportToFile(pf.yiTranscription || '', `${pf.name}_yi_transcription`, 'pdf')}
                              className="mr-2"
                            >
                              <Download className="mr-2 h-4 w-4" />
                              导出 PDF
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => exportToFile(pf.yiTranscription || '', `${pf.name}_yi_transcription`, 'docx')}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              导出 DOCX
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                      
                      {/* 汉化翻译 Section */}
                      <Card className="border border-muted">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">汉化翻译</CardTitle>
                          <CardDescription>将音频翻译成普通话</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <Textarea
                            value={pf.chineseTranslation || ''}
                            onChange={(e) => updateChineseTranslation(pf.id, e.target.value)}
                            placeholder="在此输入普通话翻译..."
                            className="min-h-32"
                            onKeyDown={(e) => {
                              // Prevent default behavior for some keys to improve performance
                              if (e.key === 'Tab') {
                                e.preventDefault();
                                const target = e.target as HTMLTextAreaElement;
                                const start = target.selectionStart;
                                const end = target.selectionEnd;
                                target.value = target.value.substring(0, start) + '\t' + target.value.substring(end);
                                target.selectionStart = target.selectionEnd = start + 1;
                              }
                            }}
                          />
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              onClick={async () => await exportToFile(pf.chineseTranslation || '', `${pf.name}_chinese_translation`, 'pdf')}
                              className="mr-2"
                            >
                              <Download className="mr-2 h-4 w-4" />
                              导出 PDF
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => exportToFile(pf.chineseTranslation || '', `${pf.name}_chinese_translation`, 'docx')}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              导出 DOCX
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {isProcessing && processedFiles.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg md:text-xl">处理文件中...</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">请等待您的音频文件被处理。</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}