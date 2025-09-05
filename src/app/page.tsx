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
import ReliableUpload from '@/components/ReliableUpload'
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

  // Main process function - handles both traditional and blob uploads
  const processAudioFiles = async () => {
    if (audioFiles.length === 0) {
      setError('请选择至少一个音频文件')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      console.log('发送请求到 /api/process-audio')
      
      // Check if files have URLs (Blob uploads) or are File objects (traditional uploads)
      const hasBlobFiles = audioFiles.some(af => af.url)
      
      let response;
      if (hasBlobFiles) {
        // Send as JSON for Blob files        
        response = await fetch('/api/process-audio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uploadedFiles: audioFiles,
            outputFolder: outputFolder
          })
        })
      } else {
        // Send as FormData for traditional files
        const formData = new FormData()
        audioFiles.forEach(af => {
          if (af.file) {
            // Check file size before sending
            if (af.file.size > 10 * 1024 * 1024) { // 10MB limit for traditional upload
              throw new Error('文件太大，无法处理。请使用文件大小小于10MB的文件，或尝试使用Vercel Blob上传方法。')
            }
            formData.append('audioFiles', af.file)
          }
        })
        formData.append('outputFolder', outputFolder)
        
        response = await fetch('/api/process-audio', {
          method: 'POST',
          body: formData
        })
      }

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
            <h1 className="text-3xl md:text-4xl font-bold">DiarisatorAI</h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              上传音频文件以分离和识别不同的说话人
            </p>
          </div>

        {/* Upload Section */}
        <ReliableUpload 
          onUploadComplete={handleBlobUploadComplete}
          onUploadError={handleBlobUploadError}
        />

        {/* Process Files Button - Shows after successful uploads */}
        {audioFiles.length > 0 && audioFiles.some(af => af.url || af.file) && !isProcessing && processedFiles.every(pf => pf.status === 'Pending') && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Ready for Processing</h3>
                  <p className="text-sm text-muted-foreground">
                    {audioFiles.length} file{audioFiles.length > 1 ? 's' : ''} uploaded successfully. Click below to start speaker diarization and analysis.
                  </p>
                </div>
                <Button
                  onClick={processAudioFiles}
                  disabled={isProcessing}
                  size="lg"
                  className="px-8 py-3"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-5 w-5" />
                      Start Processing
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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