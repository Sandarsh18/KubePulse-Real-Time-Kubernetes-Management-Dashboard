import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useTheme } from '../context/ThemeContext'

export default function LogViewer({ ns, pod, container }) {
  const [lines, setLines] = useState([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const bottomRef = useRef(null)
  const containerRef = useRef(null)
  const { theme } = useTheme()

  useEffect(() => {
    if (!pod) {
      setLines([])
      setIsInitialLoad(true)
      return
    }
    
    // Set initial load to true when pod changes
    setIsInitialLoad(true)
    setLines([]) // Clear old logs
    
    const logSocket = io('/logs', { path: '/socket.io' })
    logSocket.emit('subscribe', { ns, pod, container })
    
    let firstBatchReceived = false
    
    logSocket.on('log', (l) => {
      setLines(prev => {
        const newLines = [...prev, l].slice(-500)
        // After first batch of logs, mark as loaded
        if (!firstBatchReceived && newLines.length > 0) {
          firstBatchReceived = true
          // Delay to prevent auto-scroll on initial load
          setTimeout(() => setIsInitialLoad(false), 500)
        }
        return newLines
      })
    })
    
    logSocket.on('error', (e) => setLines(prev => [...prev, `ERROR: ${e}`].slice(-500)))
    
    return () => { 
      logSocket.disconnect()
    }
  }, [ns, pod, container])

  // Handle scroll detection
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setAutoScroll(isNearBottom)
  }

  // Only auto-scroll if user is near bottom and not initial load
  useEffect(() => {
    if (!isInitialLoad && autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lines, autoScroll, isInitialLoad])

  if (!pod) {
    return (
      <div className={`${theme.card} rounded-xl ${theme.shadow} border ${theme.border} p-12 transition-all duration-300 flex flex-col items-center justify-center`}>
        <svg className={`w-20 h-20 ${theme.textMuted} opacity-30 mb-4 animate-pulse`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className={`${theme.textMuted} text-center`}>Select a pod to stream logs</p>
      </div>
    )
  }

  return (
    <div className={`${theme.card} rounded-xl ${theme.shadow} border ${theme.border} overflow-hidden transition-all duration-300`}>
      <div className={`bg-gradient-to-r ${theme.gradient} px-6 py-3 flex items-center justify-between`}>
        <div className="flex items-center space-x-2 text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="font-semibold">Live Logs</span>
        </div>
        <span className="text-white text-sm font-mono bg-white bg-opacity-20 px-3 py-1 rounded-full backdrop-blur-sm">
          {pod}
        </span>
      </div>
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-black text-green-400 p-6 h-[700px] overflow-auto font-mono text-sm leading-relaxed"
      >
        {lines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mx-auto mb-3"></div>
              <p className="text-base">Waiting for logs...</p>
            </div>
          </div>
        ) : (
          <>
            {lines.map((l, i) => (
              <div key={i} className="hover:bg-gray-900 px-3 py-1 transition-colors group">
                <span className="text-gray-600 mr-4 inline-block w-12 text-right select-none group-hover:text-gray-400">{i + 1}</span>
                <span className="select-all">{l}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  )
}
