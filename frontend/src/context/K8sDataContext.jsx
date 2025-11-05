import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'

const K8sDataContext = createContext()

export function K8sDataProvider({ children }) {
  const [namespace, setNamespace] = useState('devops-demo')
  const [pods, setPods] = useState([])
  const [deployments, setDeployments] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)
  
  // Prevent duplicate fetches in React StrictMode
  const fetchInProgressRef = useRef(false)

  // Fetch all K8s data in one go
  const fetchData = useCallback(async (ns) => {
    // Prevent duplicate calls
    if (fetchInProgressRef.current) {
      console.log('⏭️ Fetch already in progress, skipping...')
      return
    }

    try {
      fetchInProgressRef.current = true
      setLoading(true)
      setError(null)

      console.log(`🔄 Fetching K8s data for namespace: ${ns}`)

      // Fetch all data in parallel
      const [podsRes, deploymentsRes, eventsRes] = await Promise.all([
        axios.get('/api/k8s/pods', { params: { ns }, timeout: 5000 }),
        axios.get('/api/k8s/deployments', { params: { ns }, timeout: 5000 }),
        axios.get('/api/k8s/events', { params: { ns }, timeout: 5000 })
      ])

      setPods(podsRes.data || [])
      setDeployments(deploymentsRes.data || [])
      setEvents(eventsRes.data || [])
      setLastFetch(Date.now())
      setError(null)
      
      console.log(`✅ K8s data fetched successfully`)
      
    } catch (err) {
      console.error('❌ K8s data fetch error:', err.message)
      
      // Check if backend is not running
      if (err.code === 'ERR_NETWORK' || err.message.includes('Network Error')) {
        setError('Backend server is not running. Please start the backend.')
      } else if (err.code === 'ECONNABORTED') {
        setError('Request timeout. Backend is slow or unavailable.')
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to fetch K8s data')
      }
      
      // Set empty arrays on error to prevent crashes
      setPods([])
      setDeployments([])
      setEvents([])
      
    } finally {
      setLoading(false)
      fetchInProgressRef.current = false
    }
  }, [])

  // Initial fetch + polling
  useEffect(() => {
    fetchData(namespace)
    
    // Poll every 10 seconds
    const interval = setInterval(() => {
      fetchData(namespace)
    }, 10000)

    return () => {
      clearInterval(interval)
      fetchInProgressRef.current = false
    }
  }, [namespace, fetchData])

  // Manual refresh function
  const refresh = useCallback(() => {
    console.log('🔄 Manual refresh triggered')
    fetchData(namespace)
  }, [namespace, fetchData])

  const value = {
    namespace,
    setNamespace,
    pods,
    deployments,
    events,
    loading,
    error,
    lastFetch,
    refresh
  }

  return (
    <K8sDataContext.Provider value={value}>
      {children}
    </K8sDataContext.Provider>
  )
}

export function useK8sData() {
  const context = useContext(K8sDataContext)
  if (!context) {
    throw new Error('useK8sData must be used within K8sDataProvider')
  }
  return context
}