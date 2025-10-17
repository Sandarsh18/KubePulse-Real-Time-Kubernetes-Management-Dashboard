import { useEffect, useState } from 'react'
import axios from 'axios'
import { useTheme } from '../context/ThemeContext'

export default function Events({ ns }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true)
      try {
        const { data } = await axios.get('/api/k8s/events', { params: { ns } })
        // Get last 10 events, sorted by time
        const sortedEvents = data
          .sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp))
          .slice(0, 10)
        setEvents(sortedEvents)
      } catch (e) {
        console.error('Failed to fetch events:', e)
        setEvents([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchEvents()
    const interval = setInterval(fetchEvents, 15000) // Refresh every 15s
    return () => clearInterval(interval)
  }, [ns])

  if (loading) {
    return (
      <div className={`${theme.card} rounded-xl ${theme.shadow} p-6 border ${theme.border}`}>
        <div className="flex items-center justify-center">
          <div className={`animate-spin rounded-full h-6 w-6 border-b-2 ${theme.textSecondary}`}></div>
          <span className={`ml-3 ${theme.textSecondary}`}>Loading events...</span>
        </div>
      </div>
    )
  }

  const getEventTypeColor = (type) => {
    switch(type) {
      case 'Normal': return theme.success
      case 'Warning': return theme.warning
      case 'Error': return theme.error
      default: return theme.info
    }
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className={`${theme.card} rounded-xl ${theme.shadow} border ${theme.border} overflow-hidden transition-all duration-300`}>
      <div className={`bg-gradient-to-r ${theme.gradient} px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h3 className="text-lg font-semibold text-white">Recent Events</h3>
          </div>
          <span className="bg-white bg-opacity-20 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
            {events.length}
          </span>
        </div>
      </div>

      <div className={`divide-y ${theme.border} max-h-96 overflow-y-auto`}>
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg className={`w-12 h-12 ${theme.textMuted} opacity-30 mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className={`${theme.textMuted} text-sm`}>No recent events</p>
          </div>
        ) : (
          events.map((event, idx) => (
            <div key={idx} className="px-6 py-4 hover:bg-opacity-5 hover:bg-blue-500 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEventTypeColor(event.type)}`}>
                      {event.type}
                    </span>
                    <span className={`text-xs ${theme.textMuted}`}>
                      {formatTime(event.lastTimestamp)}
                    </span>
                  </div>
                  <p className={`text-sm ${theme.text} font-medium mb-1`}>
                    {event.reason}
                  </p>
                  <p className={`text-xs ${theme.textSecondary} line-clamp-2`}>
                    {event.message}
                  </p>
                  {event.involvedObject?.name && (
                    <p className={`text-xs ${theme.textMuted} mt-1 font-mono`}>
                      {event.involvedObject.kind}: {event.involvedObject.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
