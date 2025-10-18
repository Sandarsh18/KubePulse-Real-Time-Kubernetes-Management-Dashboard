import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { useTheme } from '../context/ThemeContext'

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [user, setUser] = useState('user')
  const [autoScroll, setAutoScroll] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [typingUsers, setTypingUsers] = useState([])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showUserList, setShowUserList] = useState(false)
  const { theme } = useTheme()
  const messagesEndRef = useRef(null)
  const containerRef = useRef(null)
  const socketRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    // Prevent auto-scroll on chat page
    window.scrollTo(0, 0)
    
    // Create single socket connection for chat
    const socket = io('/', { path: '/socket.io' })
    socketRef.current = socket
    
    let firstMessageReceived = false
    
    // Register user
    socket.emit('chat:register', { user })
    
    // Listen for messages
    socket.on('chat:message', (msg) => {
      setMessages(prev => {
        const newMessages = [...prev, msg].slice(-200)
        if (!firstMessageReceived && newMessages.length > 0) {
          firstMessageReceived = true
          setTimeout(() => setIsInitialLoad(false), 500)
        }
        return newMessages
      })
    })
    
    // Listen for online users
    socket.on('chat:users', (users) => {
      setOnlineUsers(users)
    })
    
    // Listen for typing indicators
    socket.on('chat:typing', ({ user: typingUser, isTyping }) => {
      setTypingUsers(prev => {
        if (isTyping && typingUser !== user) {
          return [...new Set([...prev, typingUser])]
        } else {
          return prev.filter(u => u !== typingUser)
        }
      })
    })
    
    // Listen for message reactions
    socket.on('chat:reaction', ({ messageId, reaction, user: reactionUser }) => {
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = { ...msg.reactions }
          if (!reactions[reaction]) reactions[reaction] = []
          if (!reactions[reaction].includes(reactionUser)) {
            reactions[reaction].push(reactionUser)
          }
          return { ...msg, reactions }
        }
        return msg
      }))
    })
    
    // Listen for message edits
    socket.on('chat:edit', ({ messageId, newText }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, text: newText, edited: true } : msg
      ))
    })
    
    // Listen for message deletions
    socket.on('chat:delete', ({ messageId }) => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId))
    })
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [user])

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
    
    if (editingMessage) {
      // Edit existing message
      socketRef.current.emit('chat:edit', { 
        messageId: editingMessage.id, 
        newText: text 
      })
      setEditingMessage(null)
    } else {
      // Send new message
      socketRef.current.emit('chat:send', { 
        user, 
        text,
        replyTo: replyTo?.id 
      })
      setReplyTo(null)
    }
    
    setText('')
    setShowEmojiPicker(false)
  }

  const handleTyping = (e) => {
    setText(e.target.value)
    
    // Emit typing indicator
    if (socketRef.current) {
      socketRef.current.emit('chat:typing', { user, isTyping: true })
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      // Set new timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('chat:typing', { user, isTyping: false })
      }, 1000)
    }
  }

  const addReaction = (messageId, emoji) => {
    if (socketRef.current) {
      socketRef.current.emit('chat:reaction', { 
        messageId, 
        reaction: emoji, 
        user 
      })
    }
  }

  const deleteMessage = (messageId) => {
    if (socketRef.current) {
      socketRef.current.emit('chat:delete', { messageId, user })
    }
  }

  const startEdit = (message) => {
    setEditingMessage(message)
    setText(message.text)
  }

  const cancelEdit = () => {
    setEditingMessage(null)
    setText('')
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    // Simple file info message
    const fileMsg = `📎 File: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`
    setText(fileMsg)
  }

  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🚀', '✅']

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className={`min-h-screen ${theme.bg} transition-all duration-500 p-6`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className={`${theme.card} rounded-xl ${theme.shadow} border ${theme.border} p-6 mb-6 transition-all duration-300`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 bg-gradient-to-br ${theme.gradient} rounded-lg flex items-center justify-center ${theme.shadow} animate-pulse-slow`}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h2 className={`text-2xl font-bold bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>
                  Team Chat
                </h2>
                <p className={`text-sm ${theme.textSecondary}`}>
                  {onlineUsers.length} online • {messages.length} messages
                </p>
              </div>
            </div>
            
            {/* Online Users Toggle */}
            <button
              onClick={() => setShowUserList(!showUserList)}
              className={`${theme.button} px-4 py-2 rounded-lg transition-all hover:scale-105 flex items-center space-x-2`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>{onlineUsers.length}</span>
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Chat Container */}
          <div className={`flex-1 ${theme.card} rounded-xl ${theme.shadow} border ${theme.border} overflow-hidden transition-all duration-300 ${theme.cardHover}`}>
            {/* Search Bar */}
            <div className={`p-4 border-b ${theme.border}`}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`${theme.input} border rounded-lg px-10 py-2 w-full transition-all focus:ring-2`}
                />
                <svg className={`w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Messages Area */}
            <div 
              ref={containerRef}
              onScroll={handleScroll}
              className={`h-[500px] overflow-auto p-6 space-y-4 ${theme.bg} bg-opacity-30`}
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <svg className={`w-20 h-20 ${theme.textMuted} opacity-30 mb-4 animate-bounce-slow`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </svg>
                  <p className={`${theme.textMuted} text-center`}>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages
                  .filter(m => !searchTerm || m.text.toLowerCase().includes(searchTerm.toLowerCase()) || m.user.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((m, idx) => (
                  <div 
                    key={m.id || idx} 
                    className={`flex items-start space-x-3 animate-fade-in group ${
                      m.user === user ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white font-semibold ${theme.shadow} flex-shrink-0`}>
                      {m.user.charAt(0).toUpperCase()}
                    </div>
                    <div className={`flex-1 max-w-lg ${m.user === user ? 'text-right' : ''}`}>
                      {/* Reply indicator */}
                      {m.replyTo && (
                        <div className={`text-xs ${theme.textMuted} mb-1 italic flex items-center ${m.user === user ? 'justify-end' : ''}`}>
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Replying to message
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`text-xs font-medium ${theme.textSecondary}`}>
                          {m.user}
                        </span>
                        <span className={`text-xs ${theme.textMuted}`}>
                          {new Date(m.timestamp || Date.now()).toLocaleTimeString()}
                        </span>
                        {m.edited && (
                          <span className={`text-xs ${theme.textMuted} italic`}>(edited)</span>
                        )}
                      </div>
                      
                      <div className={`inline-block px-4 py-3 rounded-2xl ${
                        m.user === user 
                          ? `bg-gradient-to-r ${theme.gradient} text-white` 
                          : `${theme.card} border ${theme.border} ${theme.text}`
                      } ${theme.shadow} relative`}>
                        <p className="text-sm break-words whitespace-pre-wrap">{m.text}</p>
                        
                        {/* Reactions */}
                        {m.reactions && Object.keys(m.reactions).length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {Object.entries(m.reactions).map(([emoji, users]) => (
                              <button
                                key={emoji}
                                onClick={() => addReaction(m.id, emoji)}
                                className={`px-2 py-1 rounded-full text-xs ${theme.card} border ${theme.border} hover:scale-110 transition-transform flex items-center gap-1`}
                                title={users.join(', ')}
                              >
                                <span>{emoji}</span>
                                <span className={theme.textMuted}>{users.length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {/* Message Actions (hover) */}
                        <div className={`absolute ${m.user === user ? 'left-0' : 'right-0'} top-0 -translate-y-8 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ${theme.card} rounded-lg p-1 border ${theme.border} ${theme.shadow}`}>
                          <button
                            onClick={() => setReplyTo(m)}
                            className={`p-1 rounded hover:bg-opacity-20 hover:bg-gray-500 transition-colors`}
                            title="Reply"
                          >
                            <svg className={`w-4 h-4 ${theme.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          </button>
                          
                          {emojis.slice(0, 3).map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => addReaction(m.id, emoji)}
                              className="p-1 rounded hover:scale-125 transition-transform"
                              title={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                          
                          {m.user === user && (
                            <>
                              <button
                                onClick={() => startEdit(m)}
                                className={`p-1 rounded hover:bg-opacity-20 hover:bg-gray-500 transition-colors`}
                                title="Edit"
                              >
                                <svg className={`w-4 h-4 ${theme.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteMessage(m.id)}
                                className={`p-1 rounded hover:bg-red-500 hover:bg-opacity-20 transition-colors`}
                                title="Delete"
                              >
                                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {/* Typing Indicator */}
              {typingUsers.length > 0 && (
                <div className="flex items-center space-x-2 animate-fade-in">
                  <div className={`flex space-x-1 ${theme.card} px-3 py-2 rounded-full border ${theme.border}`}>
                    <div className={`w-2 h-2 ${theme.bg} bg-opacity-60 rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
                    <div className={`w-2 h-2 ${theme.bg} bg-opacity-60 rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
                    <div className={`w-2 h-2 ${theme.bg} bg-opacity-60 rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className={`text-xs ${theme.textMuted}`}>
                    {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Reply/Edit Banner */}
            {(replyTo || editingMessage) && (
              <div className={`px-4 py-2 border-t ${theme.border} ${theme.bg} bg-opacity-30 flex items-center justify-between`}>
                <div className="flex items-center space-x-2">
                  <svg className={`w-4 h-4 ${theme.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={editingMessage ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" : "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"} />
                  </svg>
                  <span className={`text-sm ${theme.textSecondary}`}>
                    {editingMessage ? 'Editing message' : `Replying to ${replyTo?.user}`}
                  </span>
                </div>
                <button
                  onClick={() => { setReplyTo(null); cancelEdit() }}
                  className={`${theme.textMuted} hover:${theme.text} transition-colors`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Input Area */}
            <div className={`p-4 border-t ${theme.border} ${theme.card}`}>
              <div className="flex gap-2 mb-2">
                <input 
                  value={user} 
                  onChange={e=>setUser(e.target.value)} 
                  placeholder="Username" 
                  className={`${theme.input} border rounded-lg px-3 py-2 w-32 text-sm transition-all focus:ring-2`}
                  maxLength={20}
                />
                <div className="flex-1"></div>
                
                {/* File Upload */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-lg ${theme.button} transition-all hover:scale-110`}
                  title="Attach file"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {/* Emoji Picker Toggle */}
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`p-2 rounded-lg ${theme.button} transition-all hover:scale-110`}
                  title="Add emoji"
                >
                  😊
                </button>
              </div>
              
              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className={`${theme.card} border ${theme.border} rounded-lg p-3 mb-2 grid grid-cols-8 gap-2`}>
                  {emojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setText(text + emoji)
                        setShowEmojiPicker(false)
                      }}
                      className="text-2xl hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              
              <div className="flex gap-3">
                <textarea
                  value={text} 
                  onChange={handleTyping}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message (Shift+Enter for new line)" 
                  className={`${theme.input} border rounded-lg px-4 py-3 flex-1 transition-all focus:ring-2 resize-none`}
                  rows={2}
                  maxLength={1000}
                />
                <button 
                  onClick={send} 
                  disabled={!text.trim()}
                  className={`${theme.button} px-8 py-3 rounded-lg transition-all ${theme.shadow} hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 self-end`}
                >
                  <span>{editingMessage ? 'Update' : 'Send'}</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className={`text-xs ${theme.textMuted} mt-2 text-right`}>
                {text.length}/1000 characters
              </div>
            </div>
          </div>

          {/* Online Users Sidebar */}
          {showUserList && (
            <div className={`w-64 ${theme.card} rounded-xl ${theme.shadow} border ${theme.border} p-4 animate-fade-in`}>
              <h3 className={`text-lg font-semibold mb-4 flex items-center ${theme.text}`}>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Online Users
              </h3>
              <div className="space-y-2">
                {onlineUsers.length === 0 ? (
                  <p className={`text-sm ${theme.textMuted}`}>No users online</p>
                ) : (
                  onlineUsers.map((u, idx) => (
                    <div key={idx} className={`flex items-center space-x-3 p-2 rounded-lg ${theme.bg} bg-opacity-30 hover:bg-opacity-50 transition-all`}>
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white text-sm font-semibold`}>
                        {u.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${theme.text}`}>{u}</p>
                        {u === user && (
                          <span className={`text-xs ${theme.textMuted}`}>(You)</span>
                        )}
                      </div>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
