'use client'

import React, { useRef, useState, useEffect } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Play, Pause, Square, Upload, Volume2, VolumeX } from 'lucide-react'

interface AudioWaveformProps {
  className?: string
}

export default function AudioWaveform({ className }: AudioWaveformProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState([0.7])
  const [isMuted, setIsMuted] = useState(false)
  const [fileName, setFileName] = useState('')

  // 初始化 WaveSurfer
  useEffect(() => {
    if (waveformRef.current && !wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#3b82f6',
        progressColor: '#1d4ed8',
        cursorColor: '#ef4444',
        barWidth: 2,
        barRadius: 3,
        responsive: true,
        height: 100,
        normalize: true,
        backend: 'WebAudio',
        mediaControls: false,
      })

      // 监听播放事件
      wavesurferRef.current.on('play', () => setIsPlaying(true))
      wavesurferRef.current.on('pause', () => setIsPlaying(false))
      wavesurferRef.current.on('finish', () => setIsPlaying(false))
      wavesurferRef.current.on('audioprocess', () => {
        if (wavesurferRef.current) {
          setCurrentTime(wavesurferRef.current.getCurrentTime())
        }
      })
      wavesurferRef.current.on('ready', () => {
        if (wavesurferRef.current) {
          setDuration(wavesurferRef.current.getDuration())
          setIsLoading(false)
        }
      })
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy()
        wavesurferRef.current = null
      }
    }
  }, [])

  // 处理文件上传
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('audio/')) {
      setIsLoading(true)
      setAudioFile(file)
      setFileName(file.name)
      
      // 创建 URL 并加载音频
      const url = URL.createObjectURL(file)
      setAudioUrl(url)
      
      if (wavesurferRef.current) {
        wavesurferRef.current.load(url)
      }
    }
  }

  // 播放/暂停
  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }

  // 停止
  const stop = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.stop()
      setCurrentTime(0)
    }
  }

  // 跳转到指定位置
  const seekTo = (time: number) => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(time)
      setCurrentTime(time)
    }
  }

  // 音量控制
  const handleVolumeChange = (value: number[]) => {
    setVolume(value)
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(value[0])
    }
  }

  // 静音切换
  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (wavesurferRef.current) {
      wavesurferRef.current.setMute(!isMuted)
    }
  }

  // 格式化时间
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // 计算进度百分比
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <Card className={`w-full max-w-4xl mx-auto ${className}`}>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-center">音频波形播放器</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 文件上传区域 */}
        <div className="space-y-2">
          <Label htmlFor="audio-upload" className="text-sm font-medium">
            选择音频文件
          </Label>
          <div className="flex items-center space-x-2">
            <Input
              id="audio-upload"
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="flex-1"
            />
            <Upload className="h-4 w-4 text-gray-500" />
          </div>
          {fileName && (
            <p className="text-sm text-gray-600">已选择: {fileName}</p>
          )}
        </div>

        {/* 波形显示区域 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">音频波形</Label>
          <div className="relative">
            <div 
              ref={waveformRef} 
              className="w-full h-24 bg-gray-100 rounded-lg border"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-lg">
                <div className="text-white">加载中...</div>
              </div>
            )}
          </div>
        </div>

        {/* 进度条 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <Progress 
            value={progressPercentage} 
            className="w-full h-2 cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const clickPosition = (e.clientX - rect.left) / rect.width
              seekTo(clickPosition * duration)
            }}
          />
        </div>

        {/* 播放控制 */}
        <div className="flex items-center justify-center space-x-4">
          <Button
            variant="outline"
            size="icon"
            onClick={stop}
            disabled={!audioFile}
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            onClick={togglePlayPause}
            disabled={!audioFile}
            size="lg"
            className="w-16 h-16 rounded-full"
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6 ml-1" />
            )}
          </Button>
        </div>

        {/* 音量控制 */}
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            disabled={!audioFile}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <div className="flex-1">
            <Slider
              value={volume}
              onValueChange={handleVolumeChange}
              max={1}
              min={0}
              step={0.1}
              disabled={!audioFile}
              className="w-full"
            />
          </div>
          <span className="text-sm text-gray-600 w-12">
            {Math.round(volume[0] * 100)}%
          </span>
        </div>

        {/* 音频信息 */}
        {audioFile && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">文件名:</span> {fileName}
            </div>
            <div>
              <span className="font-medium">文件大小:</span> {(audioFile.size / 1024 / 1024).toFixed(2)} MB
            </div>
            <div>
              <span className="font-medium">持续时间:</span> {formatTime(duration)}
            </div>
            <div>
              <span className="font-medium">文件类型:</span> {audioFile.type}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}