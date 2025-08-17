'use client'

import { useState, useEffect } from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

export default function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error)
      event.preventDefault()
      setError(event.error?.message || 'An unexpected error occurred')
      setHasError(true)
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason)
      event.preventDefault()
      setError(event.reason?.message || 'An unexpected error occurred')
      setHasError(true)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  if (hasError) {
    return (
      <div className="p-4 border border-red-200 rounded-lg bg-red-50">
        <h2 className="text-lg font-semibold text-red-800">出现错误</h2>
        <p className="text-red-600">
          {error || '发生意外错误'}
        </p>
        <button
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          onClick={() => {
            setHasError(false)
            setError(null)
          }}
        >
          重试
        </button>
      </div>
    )
  }

  return <>{children}</>
}