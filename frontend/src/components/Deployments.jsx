import { useEffect, useState } from 'react'
import axios from 'axios'
import { useTheme } from '../context/ThemeContext'

export default function Deployments({ ns }) {
  const [deps, setDeps] = useState([])
  const [loading, setLoading] = useState(true)
  const [scaling, setScaling] = useState({})
  const { theme } = useTheme()

  useEffect(() => {
    setLoading(true)
    axios.get('/api/k8s/deployments', { params: { ns }})
      .then(res => setDeps(res.data))
      .finally(() => setLoading(false))
  }, [ns])

  const updateReplicas = async (name, replicas) => {
    setScaling(prev => ({ ...prev, [name]: true }))
    try {
      console.log(`Scaling ${name} to ${replicas} replicas in namespace ${ns}`)
      
      // Make the scale request with proper error handling
      const response = await axios.post('/api/k8s/scale', { 
        ns, 
        name, 
        replicas: Number(replicas) 
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      })
      
      console.log('Scale response:', response.data)
      
      // Wait a moment for k8s to update
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Refresh deployments list
      const { data } = await axios.get('/api/k8s/deployments', { params: { ns }})
      setDeps(data)
      
      console.log(`✅ Successfully scaled ${name} to ${replicas} replicas`)
    } catch (error) {
      console.error('Scale error:', error)
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error'
      console.error(`❌ Failed to scale ${name}: ${errorMsg}`)
      alert(`Failed to scale ${name}: ${errorMsg}`)
    } finally {
      setScaling(prev => ({ ...prev, [name]: false }))
    }
  }

  if (loading) {
    return (
      <div className={`${theme.card} rounded-xl ${theme.shadow} p-8 border ${theme.border} transition-all duration-300`}>
        <div className="flex items-center justify-center space-x-3">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-current ${theme.textSecondary}`}></div>
          <span className={theme.textSecondary}>Loading deployments...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`${theme.card} rounded-xl ${theme.shadow} border ${theme.border} overflow-hidden transition-all duration-300 ${theme.cardHover}`}>
      <div className={`bg-gradient-to-r ${theme.gradient} px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            <h3 className="text-lg font-semibold text-white">Deployments</h3>
          </div>
          <span className="bg-white bg-opacity-20 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
            {deps.length}
          </span>
        </div>
      </div>
      
      <div className={`divide-y ${theme.border}`}>
        {deps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className={`w-16 h-16 ${theme.textMuted} opacity-30 mb-3 animate-bounce-slow`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className={theme.textMuted}>No deployments found</p>
          </div>
        ) : (
          deps.map(d => {
            const replicas = d.spec.replicas || 0
            const available = d.status.availableReplicas || 0
            const ready = d.status.readyReplicas || 0
            const isHealthy = available === replicas && ready === replicas
            
            return (
              <div key={d.metadata.uid} className={`px-6 py-4 hover:bg-opacity-5 hover:bg-blue-500 transition-all transform hover:scale-[1.01]`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${isHealthy ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-pulse'}`}></div>
                      <p className={`font-mono text-sm font-medium ${theme.text} truncate`}>
                        {d.metadata.name}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-medium ${theme.textMuted}`}>Replicas:</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${theme.info}`}>
                          {replicas}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-medium ${theme.textMuted}`}>Ready:</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          ready === replicas ? theme.success : theme.warning
                        }`}>
                          {ready}/{replicas}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-medium ${theme.textMuted}`}>Available:</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          available === replicas ? theme.success : theme.warning
                        }`}>
                          {available}/{replicas}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex items-center space-x-2">
                    <button 
                      onClick={() => updateReplicas(d.metadata.name, Math.max(0, replicas - 1))}
                      disabled={scaling[d.metadata.name] || replicas === 0}
                      className={`p-2 ${theme.buttonSecondary} rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.shadow} hover:scale-110 transform`}
                      title="Scale down"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className={`text-sm font-semibold ${theme.text} min-w-[2rem] text-center`}>
                      {scaling[d.metadata.name] ? '...' : replicas}
                    </span>
                    <button 
                      onClick={() => updateReplicas(d.metadata.name, replicas + 1)}
                      disabled={scaling[d.metadata.name]}
                      className={`p-2 ${theme.button} rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.shadow} hover:scale-110 transform`}
                      title="Scale up"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
