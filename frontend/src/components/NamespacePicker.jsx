import { useEffect, useState } from 'react'
import axios from 'axios'
import { useTheme } from '../context/ThemeContext'

export default function NamespacePicker({ value, onChange }) {
  const [namespaces, setNamespaces] = useState(['devops-demo'])
  const { theme } = useTheme()

  useEffect(() => {
    axios.get('/api/k8s/namespaces').then(res => setNamespaces(res.data)).catch(()=>{})
  }, [])

  return (
    <select 
      className={`${theme.input} border rounded-lg px-4 py-2 transition-all focus:ring-2 focus:ring-opacity-50 ${theme.shadow}`}
      value={value} 
      onChange={e=>onChange(e.target.value)}
    >
      {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
    </select>
  )
}
