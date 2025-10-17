import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { useTheme } from '../context/ThemeContext'

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [user, setUser] = useState('user')
  const [autoScroll, setAutoScroll] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const { theme } = useTheme()
  const messagesEndRef = useRef(null)
  const containerRef = useRef(null)
  const socketRef = useRef(null)

  useEffect(() => {
    // Prevent auto-scroll on chat page
    window.scrollTo(0, 0)
    
    // Create single socket connection for chat
    const socket = io('/', { path: '/socket.io' })
    socketRef.current = socket
    
    let firstMessageReceived = false
    
    socket.on('chat:message', (msg) => {
      setMessages(prev => {
        const newMessages = [...prev, msg].slice(-200)
        // Mark as loaded after first message
        if (!firstMessageReceived && newMessages.length > 0) {
          firstMessageReceived = true
          setTimeout(() => setIsInitialLoad(false), 500)
        }
        return newMessages
      })
    })
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  // Handle scroll detection
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setAutoScroll(isNearBottom)
  }

  // Only auto-scroll if user is near bottom and not initial load
  useEffect(() => {
    if (!isInitialLoad && autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, autoScroll, isInitialLoad])

  const send = () => {
    if (!text.trim() || !socketRef.current) return
    socketRef.current.emit('chat:send', { user, text })
    setText('')
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className={`min-h-screen ${theme.bg} transition-all duration-500 p-6`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className={`${theme.card} rounded-xl ${theme.shadow} border ${theme.border} p-6 mb-6 transition-all duration-300`}>
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 bg-gradient-to-br ${theme.gradient} rounded-lg flex items-center justify-center ${theme.shadow} animate-pulse-slow`}>
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h2 className={`text-2xl font-bold bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>
                Real-time Chat
              </h2>
              <p className={`text-sm ${theme.textSecondary}`}>Team collaboration and communication</p>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className={`${theme.card} rounded-xl ${theme.shadow} border ${theme.border} overflow-hidden transition-all duration-300 ${theme.cardHover}`}>
          {/* Messages Area */}
          <div 
            ref={containerRef}
            onScroll={handleScroll}
            className={`h-[500px] overflow-auto p-6 space-y-3 ${theme.bg} bg-opacity-30`}
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <svg className={`w-20 h-20 ${theme.textMuted} opacity-30 mb-4 animate-bounce-slow`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
                <p className={`${theme.textMuted} text-center`}>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((m, idx) => (
                <div 
                  key={m.id || idx} 
                  className={`flex items-start space-x-3 animate-fade-in ${
                    m.user === user ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white font-semibold text-sm ${theme.shadow}`}>
                    {m.user.charAt(0).toUpperCase()}
                  </div>
                  <div className={`flex-1 max-w-md ${m.user === user ? 'text-right' : ''}`}>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`text-xs font-medium ${theme.textSecondary}`}>
                        {m.user}
                      </span>
                      <span className={`text-xs ${theme.textMuted}`}>
                        {new Date(m.timestamp || Date.now()).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className={`inline-block px-4 py-2 rounded-2xl ${
                      m.user === user 
                        ? `bg-gradient-to-r ${theme.gradient} text-white` 
                        : `${theme.card} border ${theme.border} ${theme.text}`
                    } ${theme.shadow}`}>
                      <p className="text-sm break-words">{m.text}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className={`p-4 border-t ${theme.border} ${theme.card}`}>
            <div className="flex gap-3">
              <input 
                value={user} 
                onChange={e=>setUser(e.target.value)} 
                placeholder="user" 
                className={`${theme.input} border rounded-lg px-4 py-2 w-32 transition-all focus:ring-2 focus:ring-opacity-50`}
                maxLength={20}
              />
              <input 
                value={text} 
                onChange={e=>setText(e.target.value)} 
                onKeyPress={handleKeyPress}
                placeholder="Type a message" 
                className={`${theme.input} border rounded-lg px-4 py-2 flex-1 transition-all focus:ring-2 focus:ring-opacity-50`}
              />
              <button 
                onClick={send} 
                disabled={!text.trim()}
                className={`${theme.button} px-6 py-2 rounded-lg transition-all ${theme.shadow} hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2`}
              >
                <span>Send</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
