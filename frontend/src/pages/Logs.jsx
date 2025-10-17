import { useState, useEffect } from 'react'
import NamespacePicker from '../components/NamespacePicker'
import LogViewer from '../components/LogViewer'
import PodList from '../components/PodList'
import { useTheme } from '../context/ThemeContext'

export default function Logs() {
  const [ns, setNs] = useState('devops-demo')
  const [pod, setPod] = useState(null)
  const { theme } = useTheme()

  useEffect(() => {
    // Prevent auto-scroll on logs page
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className={`min-h-screen ${theme.bg} transition-all duration-500 p-6`}>
      <div className="max-w-[95vw] mx-auto">
        <div className="grid md:grid-cols-4 gap-6">
          <div className="md:col-span-1 space-y-6">
            <div className={`${theme.card} ${theme.shadow} rounded-xl border ${theme.border} p-6 transition-all duration-300`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-xl font-semibold ${theme.text} flex items-center`}>
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Logs
                </h2>
                <NamespacePicker value={ns} onChange={setNs} />
              </div>
              <p className={`text-sm ${theme.textSecondary} mb-4`}>Select a pod to stream logs</p>
            </div>
            <PodList ns={ns} onSelect={(p) => setPod(p.metadata.name)} />
          </div>
          <div className="md:col-span-3">
            <LogViewer ns={ns} pod={pod} />
          </div>
        </div>
      </div>
    </div>
  )
}
