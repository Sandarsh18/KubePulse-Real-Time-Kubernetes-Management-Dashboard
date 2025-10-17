import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import NamespacePicker from '../components/NamespacePicker'
import PodList from '../components/PodList'
import Deployments from '../components/Deployments'
import Events from '../components/Events'
import { useTheme } from '../context/ThemeContext'

export default function Dashboard() {
  const [ns, setNs] = useState('devops-demo')
  const [selectedPod, setSelectedPod] = useState(null)
  const [clusterInfo, setClusterInfo] = useState({ nodes: 0, pods: 0, deployments: 0 })
  const { theme } = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    // Prevent auto-scroll on dashboard
    window.scrollTo(0, 0)
    
    // Fetch cluster stats
    const fetchStats = async () => {
      try {
        const podsRes = await axios.get('/api/k8s/pods', { params: { ns } })
        const depsRes = await axios.get('/api/k8s/deployments', { params: { ns } })
        setClusterInfo({
          pods: podsRes.data.length,
          deployments: depsRes.data.length,
          nodes: 1 // Can be extended
        })
      } catch (e) {
        console.error('Failed to fetch stats:', e)
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [ns])

  const handleDeletePod = async (podName) => {
    if (!window.confirm(`⚠️ Are you sure you want to delete pod "${podName}"? This action cannot be undone.`)) {
      return
    }
    
    try {
      console.log(`Deleting pod ${podName} in namespace ${ns}`)
      await axios.delete(`/api/k8s/pods/${podName}`, { 
        params: { ns },
        timeout: 10000
      })
      alert(`✅ Pod ${podName} deleted successfully. The page will refresh.`)
      setTimeout(() => window.location.reload(), 1000)
    } catch (e) {
      console.error('Delete pod error:', e)
      const errorMsg = e.response?.data?.error || e.message || 'Unknown error'
      alert(`❌ Failed to delete pod: ${errorMsg}`)
    }
  }

  const handleRestartPod = async (podName) => {
    if (!window.confirm(`🔄 Restart pod "${podName}"? This will delete and recreate the pod.`)) {
      return
    }
    
    try {
      console.log(`Restarting pod ${podName} in namespace ${ns}`)
      await axios.post(`/api/k8s/pods/${podName}/restart`, { ns }, {
        timeout: 10000
      })
      alert(`✅ Pod ${podName} restarted successfully. The page will refresh.`)
      setTimeout(() => window.location.reload(), 1000)
    } catch (e) {
      console.error('Restart pod error:', e)
      const errorMsg = e.response?.data?.error || e.message || 'Unknown error'
      alert(`❌ Failed to restart pod: ${errorMsg}`)
    }
  }

  return (
    <div className={`min-h-screen ${theme.bg} transition-all duration-500`}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header with Animation */}
        <div className="mb-6 animate-fade-in">
          <h1 className={`text-3xl font-bold bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent mb-2`}>
            Kubernetes Dashboard
          </h1>
          <p className={theme.textSecondary}>Real-time cluster management and monitoring</p>
        </div>

        {/* Cluster Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`${theme.card} rounded-xl ${theme.shadow} p-6 border ${theme.border} transition-all duration-300 ${theme.cardHover} transform hover:scale-105`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${theme.textMuted}`}>Total Pods</p>
                <p className={`text-3xl font-bold ${theme.text} mt-1`}>{clusterInfo.pods}</p>
              </div>
              <div className={`w-12 h-12 bg-gradient-to-br ${theme.gradient} rounded-lg flex items-center justify-center ${theme.shadow}`}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </div>
            </div>
          </div>

          <div className={`${theme.card} rounded-xl ${theme.shadow} p-6 border ${theme.border} transition-all duration-300 ${theme.cardHover} transform hover:scale-105`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${theme.textMuted}`}>Deployments</p>
                <p className={`text-3xl font-bold ${theme.text} mt-1`}>{clusterInfo.deployments}</p>
              </div>
              <div className={`w-12 h-12 bg-gradient-to-br ${theme.gradient} rounded-lg flex items-center justify-center ${theme.shadow}`}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
            </div>
          </div>

          <div className={`${theme.card} rounded-xl ${theme.shadow} p-6 border ${theme.border} transition-all duration-300 ${theme.cardHover} transform hover:scale-105`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${theme.textMuted}`}>Active Nodes</p>
                <p className={`text-3xl font-bold ${theme.text} mt-1`}>{clusterInfo.nodes}</p>
              </div>
              <div className={`w-12 h-12 bg-gradient-to-br ${theme.gradient} rounded-lg flex items-center justify-center ${theme.shadow}`}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Namespace Selector Card with Enhanced Design */}
            <div className={`${theme.card} rounded-xl ${theme.shadow} p-6 border ${theme.border} transition-all duration-300 ${theme.cardHover} transform hover:scale-[1.02]`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 bg-gradient-to-br ${theme.gradient} rounded-lg flex items-center justify-center ${theme.shadow} animate-pulse-slow`}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className={`text-sm font-medium ${theme.textMuted}`}>Active Namespace</h3>
                    <p className={`text-lg font-semibold ${theme.text}`}>{ns}</p>
                  </div>
                </div>
                <NamespacePicker value={ns} onChange={setNs} />
              </div>
            </div>

            {/* Pods Section */}
            <PodList ns={ns} onSelect={setSelectedPod} />
            
            {/* Deployments Section */}
            <Deployments ns={ns} />

            {/* Events Section */}
            <Events ns={ns} />
          </div>

          {/* Sidebar with Enhanced Styling */}
          <div className="space-y-6">
            {/* Selected Pod Details */}
            <div className={`${theme.card} rounded-xl ${theme.shadow} p-6 border ${theme.border} sticky top-24 transition-all duration-300 ${theme.cardHover}`}>
              <div className="flex items-center space-x-2 mb-4">
                <svg className={`w-5 h-5 ${theme.textSecondary}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className={`font-semibold ${theme.text}`}>Pod Details</h3>
              </div>
              {selectedPod ? (
                <div className="space-y-3 animate-fade-in">
                  <div>
                    <label className={`text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>Name</label>
                    <div className={`mt-1 font-mono text-sm ${theme.card} p-2 rounded border ${theme.border} break-all ${theme.textSecondary}`}>
                      {selectedPod.metadata.name}
                    </div>
                  </div>
                  <div>
                    <label className={`text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>Status</label>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        selectedPod.status.phase === 'Running' 
                          ? theme.success
                          : selectedPod.status.phase === 'Pending'
                          ? theme.warning
                          : theme.error
                      }`}>
                        <span className={`w-2 h-2 rounded-full mr-2 ${
                          selectedPod.status.phase === 'Running' ? 'bg-green-500 animate-pulse' : 
                          selectedPod.status.phase === 'Pending' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                        }`}></span>
                        {selectedPod.status.phase}
                      </span>
                    </div>
                  </div>
                  {selectedPod.status.podIP && (
                    <div>
                      <label className={`text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>Pod IP</label>
                      <div className={`mt-1 font-mono text-sm ${theme.textSecondary}`}>{selectedPod.status.podIP}</div>
                    </div>
                  )}
                  {selectedPod.spec.nodeName && (
                    <div>
                      <label className={`text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>Node</label>
                      <div className={`mt-1 text-sm ${theme.textSecondary}`}>{selectedPod.spec.nodeName}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <svg className={`w-16 h-16 ${theme.textMuted} opacity-30 mb-3 animate-bounce-slow`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className={`${theme.textMuted} text-sm`}>Select a pod to view details</p>
                </div>
              )}
            </div>

            {/* Quick Actions with Working Buttons */}
            <div className={`bg-gradient-to-br ${theme.gradient} rounded-xl ${theme.shadow} p-6 text-white transition-all duration-300`}>
              <h3 className="font-semibold mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Actions
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/logs')}
                  className="w-full text-left bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-3 rounded-lg transition-all transform hover:scale-105 backdrop-blur-sm flex items-center"
                >
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium">View Pod Logs</span>
                </button>
                
                <button
                  onClick={() => navigate('/chat')}
                  className="w-full text-left bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-3 rounded-lg transition-all transform hover:scale-105 backdrop-blur-sm flex items-center"
                >
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="font-medium">Team Chat</span>
                </button>

                {selectedPod && (
                  <>
                    <button
                      onClick={() => handleRestartPod(selectedPod.metadata.name)}
                      className="w-full text-left bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-3 rounded-lg transition-all transform hover:scale-105 backdrop-blur-sm flex items-center"
                    >
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="font-medium">Restart Selected Pod</span>
                    </button>

                    <button
                      onClick={() => handleDeletePod(selectedPod.metadata.name)}
                      className="w-full text-left bg-red-500 bg-opacity-30 hover:bg-opacity-50 px-4 py-3 rounded-lg transition-all transform hover:scale-105 backdrop-blur-sm flex items-center"
                    >
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="font-medium">Delete Selected Pod</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Resource Usage Section */}
            <div className={`${theme.card} rounded-xl ${theme.shadow} p-6 border ${theme.border} transition-all duration-300`}>
              <h3 className={`font-semibold mb-4 flex items-center ${theme.text}`}>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Namespace Info
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${theme.textMuted}`}>Current Namespace:</span>
                  <span className={`text-sm font-mono ${theme.text}`}>{ns}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${theme.textMuted}`}>Running Pods:</span>
                  <span className={`text-sm font-semibold ${theme.success}`}>{clusterInfo.pods}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${theme.textMuted}`}>Deployments:</span>
                  <span className={`text-sm font-semibold ${theme.info}`}>{clusterInfo.deployments}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
