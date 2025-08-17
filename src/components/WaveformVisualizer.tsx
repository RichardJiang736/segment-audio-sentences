'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Play, Pause, Square, Volume2, VolumeX } from 'lucide-react'

interface Segment {
  id: string
  speaker: string
  startTime: number
  endTime: number
  duration: number
  audioUrl: string
}

interface WaveformVisualizerProps {
  fileName: string
  segments: Segment[]
  audioUrl: string
}

export default function WaveformVisualizer({ fileName, segments, audioUrl }: WaveformVisualizerProps) {
  const canvasRefs = useRef<HTMLCanvasElement[]>([])
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null)
  const [currentSegment, setCurrentSegment] = useState<Segment | null>(null)
  const [waveformDatas, setWaveformDatas] = useState<Record<string, number[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [volume, setVolume] = useState([0.7])
  const [isMuted, setIsMuted] = useState(false)
  
  // Use refs for frequently changing values to prevent infinite loops
  const currentTimeRef = useRef(currentTime)
  const hoveredSegmentRef = useRef(hoveredSegment)
  const currentSegmentRef = useRef(currentSegment)
  const durationRef = useRef(duration)
  
  // Update refs when state changes
  useEffect(() => {
    currentTimeRef.current = currentTime
  }, [currentTime])
  
  useEffect(() => {
    hoveredSegmentRef.current = hoveredSegment
  }, [hoveredSegment])
  
  useEffect(() => {
    currentSegmentRef.current = currentSegment
  }, [currentSegment])
  
  useEffect(() => {
    durationRef.current = duration
  }, [duration])
  
  // Group segments by speaker - memoized with stable references
  const segmentsBySpeaker = useMemo(() => {
    return segments.reduce((acc, segment) => {
      if (!acc[segment.speaker]) {
        acc[segment.speaker] = []
      }
      acc[segment.speaker].push(segment)
      return acc
    }, {} as Record<string, Segment[]>)
  }, [segments])
  
  const speakers = useMemo(() => {
    return Object.keys(segmentsBySpeaker)
  }, [segmentsBySpeaker])
  
  // Generate color gradient from red to purple with better distribution
  const getSegmentColor = (index: number, total: number, isHovered: boolean = false) => {
    // Ensure we have a good distribution even with many segments
    const ratio = total > 1 ? index / (total - 1) : 0;
    
    // Hue range from red (0) to purple (300) with better spacing
    let hue;
    if (total <= 10) {
      // For fewer segments, use linear distribution
      hue = Math.round(ratio * 290);
    } else {
      // For many segments, use a more distributed approach to avoid similar colors
      // This creates a more visually distinct separation
      // Use a sine wave distribution to create better color separation
      const waveRatio = 0.5 * (1 - Math.cos(Math.PI * ratio)); // Creates a smooth S-curve
      hue = Math.round(waveRatio * 290);
      
      // For very large numbers of segments, add extra spacing
      if (total > 20) {
        // Add extra spacing by using a modulo operation with a prime number
        // This helps distribute colors more evenly
        const prime = 29; // A prime number close to our hue range
        hue = Math.round((index * prime) % 290);
      }
    }
    
    // Adjust saturation and lightness for better visual appeal
    // Increase contrast for better visibility
    const saturation = isHovered ? 92 : 96;
    const lightness = isHovered ? 72 : 62;
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
  
  // Get color for a specific speaker
  const getSpeakerColor = (speaker: string) => {
    const speakerIndex = speakers.indexOf(speaker);
    return getSegmentColor(speakerIndex, speakers.length);
  }

  // Generate mock waveform data with slight variation per speaker - memoized
  const generateWaveformData = useCallback((duration: number, speakerIndex: number = 0) => {
    const samples = 1000
    const data: number[] = []
    // Add a slight frequency variation based on speaker index
    const speakerVariation = speakerIndex * 0.3
    for (let i = 0; i < samples; i++) {
      // Create a more realistic waveform pattern with multiple frequency components
      const baseFreq = 0.1 + speakerVariation
      const variation = Math.sin(i * baseFreq) * 0.4 + 
                        Math.sin(i * baseFreq * 2.3) * 0.3 + 
                        Math.sin(i * baseFreq * 5.7) * 0.2 +
                        Math.sin(i * baseFreq * 11.2) * 0.1
      // Add some noise for a more natural look
      const noise = (Math.random() - 0.5) * 0.1
      data.push(Math.max(0, Math.abs(variation) + noise))
    }
    return data
  }, [])

  // Draw waveform for a specific speaker
  const drawSpeakerWaveform = useCallback((speaker: string, speakerSegments: Segment[]) => {
    const canvasIndex = speakers.indexOf(speaker)
    const canvas = canvasRefs.current[canvasIndex]
    const waveformData = waveformDatas[speaker]
    
    if (!canvas || !waveformData || waveformData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    const centerY = height / 2

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw waveform (blue color to contrast with segment bars)
    const waveformHue = (speakers.indexOf(speaker) * 30) % 360 // Vary hue based on speaker
    const waveformColor = `hsl(${waveformHue}, 70%, 60%)`
    ctx.shadowColor = `${waveformColor}40` // Add transparency to shadow
    ctx.shadowBlur = 2;
    ctx.strokeStyle = waveformColor; // Use speaker-based color for better distinction
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    const stepX = width / waveformData.length;
    waveformData.forEach((value, index) => {
      const x = index * stepX;
      const y = centerY - (value * centerY * 0.75); // Slightly reduced height for better balance
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw mirror waveform for better visualization
    ctx.beginPath();
    waveformData.forEach((value, index) => {
      const x = index * stepX;
      const y = centerY + (value * centerY * 0.75); // Slightly reduced height for better balance
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset shadow

    // Draw segment bars with improved coloring and transparency
    speakerSegments.forEach((segment, index) => {
      // Find the global index for color consistency
      const globalIndex = segments.findIndex(s => s.id === segment.id)
      
      const startX = (segment.startTime / durationRef.current) * width
      const endX = (segment.endTime / durationRef.current) * width
      const isHovered = hoveredSegmentRef.current === segment.id
      const isCurrent = currentSegmentRef.current?.id === segment.id
      
      // Set semi-transparent fill color with improved visibility
      const segmentColor = getSpeakerColor(segment.speaker)
      ctx.fillStyle = segmentColor.replace(')', ', 0.45)').replace('hsl', 'hsla') // Increased transparency for better contrast
      ctx.fillRect(startX, 0, endX - startX, height)
      
      // Add border - thicker and more visible for current segment
      const borderColor = getSpeakerColor(segment.speaker)
      ctx.strokeStyle = isCurrent ? '#ffffff' : (isHovered ? '#ffffff' : `${borderColor}80`)
      ctx.lineWidth = isCurrent ? 3 : 2
      ctx.strokeRect(startX, 0, endX - startX, height)
    })

    // Draw playhead
    if (durationRef.current > 0) {
      const playheadX = (currentTimeRef.current / durationRef.current) * width
      // Draw a more visible playhead with shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
      ctx.shadowBlur = 4
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, height)
      ctx.stroke()
      ctx.shadowBlur = 0 // Reset shadow
      
      // Draw a small triangle at the top for better visibility
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(playheadX - 5, 0)
      ctx.lineTo(playheadX + 5, 0)
      ctx.lineTo(playheadX, 10)
      ctx.closePath()
      ctx.fill()
    }
  }, [waveformDatas, segments, speakers, generateWaveformData]); // Added generateWaveformData

  // Draw all waveforms
  const drawWaveforms = useCallback(() => {
    // Only redraw if we have segments and waveform data
    if (Object.keys(waveformDatas).length > 0 && segments.length > 0) {
      Object.entries(segmentsBySpeaker).forEach(([speaker, speakerSegments]) => {
        drawSpeakerWaveform(speaker, speakerSegments);
      });
    }
  }, [drawSpeakerWaveform, waveformDatas, segments]); // Removed segmentsBySpeaker from dependencies
  
  // Use a ref to store the latest drawWaveforms function to avoid infinite loops
  const drawWaveformsRef = useRef(drawWaveforms);
  drawWaveformsRef.current = drawWaveforms;
  
  // Separate function for playhead-only updates to avoid full redraws
  const updatePlayhead = useCallback(() => {
    if (durationRef.current > 0) {
      canvasRefs.current.forEach((canvas, index) => {
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const { width, height } = canvas;
            const playheadX = (currentTimeRef.current / durationRef.current) * width;
            
            // Save the current context
            ctx.save();
            
            // Clear only the playhead area (a thin vertical line)
            ctx.clearRect(playheadX - 5, 0, 10, height);
            
            // Draw playhead
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(playheadX, 0);
            ctx.lineTo(playheadX, height);
            ctx.stroke();
            ctx.shadowBlur = 0; // Reset shadow
            
            // Draw a small triangle at the top for better visibility
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(playheadX - 5, 0);
            ctx.lineTo(playheadX + 5, 0);
            ctx.lineTo(playheadX, 10);
            ctx.closePath();
            ctx.fill();
            
            // Restore the context
            ctx.restore();
          }
        }
      });
    }
  }, []); // Removed all dependencies since we're using refs
  
  // Function to update only segment highlights without redrawing everything
  const updateSegmentHighlights = useCallback(() => {
    // This is a simplified version - in a real implementation you might want to 
    // only redraw the highlighted segments rather than everything
    drawWaveformsRef.current();
  }, []); // Removed drawWaveforms from dependencies

  // Handle canvas click for a specific speaker
  const handleCanvasClick = (speaker: string) => (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvasIndex = speakers.indexOf(speaker)
    const canvas = canvasRefs.current[canvasIndex]
    if (!canvas || durationRef.current === 0) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const clickedTime = (x / canvas.width) * durationRef.current

    // Find which segment was clicked
    const clickedSegment = segments.find(segment => 
      segment.speaker === speaker && clickedTime >= segment.startTime && clickedTime <= segment.endTime
    ) || segments.find(segment => 
      clickedTime >= segment.startTime && clickedTime <= segment.endTime
    )

    if (clickedSegment) {
      // Play the segment from its start time in the original audio
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.currentTime = clickedSegment.startTime
        setCurrentSegment(clickedSegment)
        if (!isPlaying) {
          audioRef.current.play().catch(error => {
            console.error('Error playing audio:', error)
            setError(`Failed to play audio: ${error.message}`)
          })
          setIsPlaying(true)
        }
      }
    } else {
      // Seek to clicked position in original audio
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.currentTime = clickedTime
        setCurrentSegment(null)
        if (!isPlaying) {
          audioRef.current.play().catch(error => {
            console.error('Error playing audio:', error)
            setError(`Failed to play audio: ${error.message}`)
          })
          setIsPlaying(true)
        }
      }
    }
  }

  // Handle mouse move for hover effects
  const handleMouseMove = (speaker: string) => (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvasIndex = speakers.indexOf(speaker)
    const canvas = canvasRefs.current[canvasIndex]
    if (!canvas || durationRef.current === 0) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const hoverTime = (x / canvas.width) * durationRef.current

    // Find which segment is being hovered
    const hovered = segments.find(segment => 
      segment.speaker === speaker && hoverTime >= segment.startTime && hoverTime <= segment.endTime
    ) || segments.find(segment => 
      hoverTime >= segment.startTime && hoverTime <= segment.endTime
    )

    setHoveredSegment(hovered?.id || null)
  }

  // Handle mouse leave
  const handleMouseLeave = () => {
    setHoveredSegment(null)
  }

  // Play original audio
  const playOriginal = () => {
    if (audioRef.current) {
      // Ensure we have a valid audio URL
      if (audioUrl) {
        audioRef.current.src = audioUrl
        setCurrentSegment(null)
        if (isPlaying) {
          audioRef.current.pause()
          setIsPlaying(false)
        } else {
          audioRef.current.play().catch(error => {
            console.error('Error playing audio:', error)
            setError(`Failed to play audio: ${error.message}`)
          })
          setIsPlaying(true)
        }
      } else {
        console.error('No audio URL provided')
        setError('No audio URL available')
      }
    }
  }

  // Stop playback
  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
      setCurrentSegment(null)
      setCurrentTime(0)
    }
  }

  // Seek to specific time
  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    setVolume(value)
    if (audioRef.current) {
      audioRef.current.volume = value[0]
    }
  }

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
    }
  }

  // Format time for display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Calculate progress percentage
  const progressPercentage = durationRef.current > 0 ? (currentTimeRef.current / durationRef.current) * 100 : 0

  // Initialize waveform data for each speaker
  useEffect(() => {
    if (segments.length > 0) {
      // Find the maximum end time across all segments to set the duration
      const maxDuration = Math.max(...segments.map(s => s.endTime))
      // Only set duration if it's different from current duration to avoid infinite loop
      if (maxDuration !== durationRef.current) {
        setDuration(maxDuration)
      }
      
      // Generate waveform data for each speaker
      const newWaveformDatas: Record<string, number[]> = {}
      speakers.forEach((speaker, index) => {
        newWaveformDatas[speaker] = generateWaveformData(maxDuration, index)
      })
      setWaveformDatas(newWaveformDatas)
    } else if (durationRef.current === 0 && audioUrl) {
      // Set a default duration if we have an audio URL but no segments
      const defaultDuration = 60
      setDuration(defaultDuration)
      const newWaveformDatas: Record<string, number[]> = {}
      speakers.forEach((speaker, index) => {
        newWaveformDatas[speaker] = generateWaveformData(defaultDuration, index)
      })
      setWaveformDatas(newWaveformDatas)
    }
  }, [segments, audioUrl, speakers, generateWaveformData])

  // Handle canvas resize
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    
    const handleResize = () => {
      // Debounce resize events
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        canvasRefs.current.forEach((canvas, index) => {
          if (canvas) {
            const container = canvas.parentElement
            if (container) {
              const rect = container.getBoundingClientRect()
              canvas.width = rect.width
              canvas.height = 160 // Consistent height for multiple waveforms
              const speaker = speakers[index]
              if (speaker && segmentsBySpeaker[speaker]) {
                drawSpeakerWaveform(speaker, segmentsBySpeaker[speaker])
              }
            }
          }
        })
      }, 100); // 100ms debounce
    }

    // Initial resize
    handleResize()

    // Add resize observer
    const resizeObserver = new ResizeObserver(handleResize)
    canvasRefs.current.forEach(canvas => {
      if (canvas && canvas.parentElement) {
        resizeObserver.observe(canvas.parentElement)
      }
    })

    return () => {
      resizeObserver.disconnect()
      clearTimeout(resizeTimeout)
    }
  }, [drawSpeakerWaveform, speakers]) // Removed segmentsBySpeaker from dependencies

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let lastTimeUpdate = 0;
    const throttleDelay = 16; // ~60fps throttling

    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastTimeUpdate > throttleDelay) {
        setCurrentTime(audio.currentTime);
        // Only update playhead if we're actually playing
        if (isPlaying) {
          updatePlayhead();
        }
        lastTimeUpdate = now;
      }
      
      // Check if we're playing a segment and should stop at the end
      if (isPlaying && currentSegment) {
        if (audio.currentTime >= currentSegment.endTime) {
          audio.pause();
          setIsPlaying(false);
          setCurrentSegment(null);
          // Redraw everything when segment ends
          drawWaveformsRef.current();
        }
      }
    }
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentSegment(null);
      setCurrentTime(0);
      // Redraw everything when playback ends
      drawWaveformsRef.current();
    }
    
    const handleLoadedMetadata = () => {
      // Only set duration from metadata if we're not playing a segment
      // When playing segments, we want to keep the full audio duration for proper visualization
      if (!currentSegment) {
        setDuration(audio.duration);
      }
    }

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }
  }, [isPlaying, currentSegment, updatePlayhead]); // Removed drawWaveforms from dependencies

  // Redraw waveforms when dependencies change - but throttle for performance
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const throttledDraw = () => {
      timeoutId = setTimeout(() => {
        drawWaveformsRef.current();
      }, 16); // ~60fps throttling
    };
    
    throttledDraw();
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [waveformDatas, segments]); // Only redraw when waveform data or segments change
  
  // Update segment highlights when hoveredSegment or currentSegment changes
  useEffect(() => {
    // For now, we'll just trigger a full redraw
    // In a more optimized version, you could update only the highlighted segments
    drawWaveformsRef.current();
  }, [hoveredSegment, currentSegment]); // Removed drawWaveforms from dependencies

  return (
    <div className="space-y-4 p-4 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-base md:text-lg font-semibold truncate pr-2">{fileName}</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="text-xs md:text-sm text-muted-foreground text-center sm:text-left">
            {formatTime(currentTime)} / {formatTime(duration)}
            {currentSegment && (
              <span className="ml-0 sm:ml-2 block sm:inline text-blue-500 dark:text-blue-400 font-medium">
                • Playing Speaker {currentSegment.speaker}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={playOriginal} variant="outline" size="sm" className="text-xs md:text-sm py-1 md:py-2 h-auto">
              {isPlaying && !currentSegment ? (
                <Pause className="h-3 w-3 md:h-4 md:w-4" />
              ) : (
                <Play className="h-3 w-3 md:h-4 md:w-4" />
              )}
              <span className="ml-1 md:ml-2">{isPlaying && !currentSegment ? 'Pause' : 'Play'}</span>
            </Button>
            <Button onClick={stopPlayback} variant="outline" size="sm" className="text-xs md:text-sm py-1 md:py-2 h-auto">
              <Square className="h-3 w-3 md:h-4 md:w-4" />
              <span className="ml-1 md:ml-2">Stop</span>
            </Button>
            <div className="flex items-center gap-2">
              <Button onClick={toggleMute} variant="ghost" size="sm" className="text-xs md:text-sm py-1 md:py-2 h-auto">
                {isMuted ? (
                  <VolumeX className="h-3 w-3 md:h-4 md:w-4" />
                ) : (
                  <Volume2 className="h-3 w-3 md:h-4 md:w-4" />
                )}
              </Button>
              <div className="w-16 md:w-20">
                <Slider
                  value={volume}
                  onValueChange={handleVolumeChange}
                  max={1}
                  min={0}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs md:text-sm text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
        <div className="flex items-center justify-center gap-2">
          <Button
            onClick={() => seekTo(Math.max(0, currentTime - 10))}
            variant="outline"
            size="sm"
            className="text-xs md:text-sm py-1 md:py-2 h-auto"
          >
            -10s
          </Button>
          <Button
            onClick={() => seekTo(Math.min(duration, currentTime + 10))}
            variant="outline"
            size="sm"
            className="text-xs md:text-sm py-1 md:py-2 h-auto"
          >
            +10s
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-red-500 text-sm py-2 px-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          Error: {error}
        </div>
      )}

      {/* Waveforms for each speaker */}
      <div className="space-y-4">
        {speakers.map((speaker, index) => (
          <div key={speaker} className="space-y-2">
            <div className="flex items-center gap-2 py-1">
              <h4 className="font-medium text-sm md:text-base">Speaker {speaker}</h4>
              <div 
                className="w-3 h-3 rounded-full border border-gray-300" 
                style={{ backgroundColor: getSpeakerColor(speaker) }}
              />
            </div>
            <div className="relative rounded-lg overflow-hidden border bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
              <canvas
                ref={(el) => {
                  if (el) canvasRefs.current[index] = el
                }}
                className="w-full h-36 md:h-40 cursor-pointer"
                onClick={handleCanvasClick(speaker)}
                onMouseMove={handleMouseMove(speaker)}
                onMouseLeave={handleMouseLeave}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Segments info */}
      <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-sm md:text-base">Speaker Segments:</h4>
        {segments.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 md:max-h-40 overflow-y-auto p-1">
            {segments.map((segment, index) => (
              <div
                key={segment.id}
                className={`p-2 md:p-3 rounded-lg border text-xs md:text-sm cursor-pointer transition-all duration-200 transform hover:scale-[1.02] ${
                  hoveredSegment === segment.id ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700'
                } ${currentSegment?.id === segment.id ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600' : ''}`}
                onMouseEnter={() => setHoveredSegment(segment.id)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={() => {
                  if (audioRef.current) {
                    // Play the segment from its start time in the original audio
                    audioRef.current.src = audioUrl;
                    audioRef.current.currentTime = segment.startTime;
                    setCurrentSegment(segment);
                    if (!isPlaying) {
                      audioRef.current.play().catch(error => {
                        console.error('Error playing audio:', error);
                        setError(`Failed to play audio: ${error.message}`);
                      });
                      setIsPlaying(true);
                    }
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 md:w-4 md:h-4 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: getSpeakerColor(segment.speaker) }}
                  />
                  <span className="font-medium truncate">Speaker {segment.speaker}</span>
                  {currentSegment?.id === segment.id && (
                    <Play className="h-2 w-2 md:h-3 md:w-3 text-blue-600 flex-shrink-0" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {segment.startTime.toFixed(1)}s - {segment.endTime.toFixed(1)}s
                  ({segment.duration.toFixed(1)}s)
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm py-2 italic">
            No speaker segments detected in this audio file.
          </p>
        )}
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
    </div>
  )
}