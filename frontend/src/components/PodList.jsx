import { useTheme } from '../context/ThemeContext'
import { useK8sData } from '../context/K8sDataContext'

export default function PodList({ onSelect }) {
  const { pods, loading, error } = useK8sData()
  const { theme } = useTheme()

  if (loading) {
    return (
      <div className={`${theme.card} rounded-xl ${theme.shadow} p-8 border ${theme.border} transition-all duration-300`}>
        <div className="flex items-center justify-center space-x-3">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-current ${theme.textSecondary}`}></div>
          <span className={theme.textSecondary}>Loading pods...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${theme.card} rounded-xl ${theme.shadow} p-6 ${theme.error} border transition-all duration-300`}>
        <div className="flex items-center space-x-2 mb-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">Error loading pods</span>
        </div>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className={`${theme.card} rounded-xl ${theme.shadow} border ${theme.border} overflow-hidden transition-all duration-300 ${theme.cardHover}`}>
      <div className={`bg-gradient-to-r ${theme.gradient} px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-lg font-semibold text-white">Pods</h3>
          </div>
          <span className="bg-white bg-opacity-20 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
            {pods.length} {pods.length === 1 ? 'pod' : 'pods'}
          </span>
        </div>
      </div>
      
      <div className={`divide-y ${theme.border}`}>
        {pods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className={`w-16 h-16 ${theme.textMuted} opacity-30 mb-3 animate-bounce-slow`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className={theme.textMuted}>No pods found in current namespace</p>
          </div>
        ) : (
          pods.map(p => (
            <div 
              key={p.metadata.uid} 
              className={`px-6 py-4 hover:bg-opacity-5 hover:bg-blue-500 transition-all cursor-pointer transform hover:scale-[1.01]`}
              onClick={() => onSelect(p)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      p.status.phase === 'Running' ? 'bg-green-500 animate-pulse' :
                      p.status.phase === 'Pending' ? 'bg-yellow-500 animate-pulse' :
                      'bg-red-500'
                    }`}></div>
                    <p className={`font-mono text-sm font-medium ${theme.text} truncate`}>
                      {p.metadata.name}
                    </p>
                  </div>
                  <div className={`mt-1 flex items-center space-x-4 text-xs ${theme.textMuted}`}>
                    {p.status.podIP && (
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        {p.status.podIP}
                      </span>
                    )}
                    {p.spec.nodeName && (
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                        </svg>
                        {p.spec.nodeName}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`ml-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  p.status.phase === 'Running' ? theme.success :
                  p.status.phase === 'Pending' ? theme.warning :
                  theme.error
                }`}>
                  {p.status.phase}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
