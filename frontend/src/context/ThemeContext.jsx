import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export const themes = {
  light: {
    name: 'light',
    bg: 'bg-gradient-to-br from-gray-50 to-blue-50',
    card: 'bg-white',
    cardHover: 'hover:shadow-xl',
    text: 'text-gray-900',
    textSecondary: 'text-gray-600',
    textMuted: 'text-gray-500',
    border: 'border-gray-200',
    input: 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500',
    button: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white',
    buttonSecondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
    nav: 'bg-white border-gray-200',
    navText: 'text-gray-600',
    navActive: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white',
    success: 'bg-green-100 text-green-800 border-green-300',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    error: 'bg-red-100 text-red-800 border-red-300',
    info: 'bg-blue-100 text-blue-800 border-blue-300',
    gradient: 'from-blue-600 to-purple-600',
    shadow: 'shadow-lg',
  },
  dark: {
    name: 'dark',
    bg: 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900',
    card: 'bg-gray-800 bg-opacity-80 backdrop-blur-sm',
    cardHover: 'hover:shadow-2xl hover:shadow-blue-500/20',
    text: 'text-gray-100',
    textSecondary: 'text-gray-300',
    textMuted: 'text-gray-400',
    border: 'border-gray-700',
    input: 'bg-gray-700 border-gray-600 text-gray-100 focus:border-blue-400',
    button: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white',
    buttonSecondary: 'bg-gray-700 hover:bg-gray-600 text-gray-200',
    nav: 'bg-gray-900 bg-opacity-90 backdrop-blur-md border-gray-800',
    navText: 'text-gray-300',
    navActive: 'bg-gradient-to-r from-blue-500 to-purple-600 text-white',
    success: 'bg-green-900 bg-opacity-50 text-green-300 border-green-700',
    warning: 'bg-yellow-900 bg-opacity-50 text-yellow-300 border-yellow-700',
    error: 'bg-red-900 bg-opacity-50 text-red-300 border-red-700',
    info: 'bg-blue-900 bg-opacity-50 text-blue-300 border-blue-700',
    gradient: 'from-blue-500 to-purple-600',
    shadow: 'shadow-2xl shadow-blue-500/10',
  },
  cyberpunk: {
    name: 'cyberpunk',
    bg: 'bg-gradient-to-br from-black via-purple-900 to-black',
    card: 'bg-black bg-opacity-60 backdrop-blur-md border-2 border-cyan-500',
    cardHover: 'hover:shadow-2xl hover:shadow-cyan-500/50 hover:border-pink-500',
    text: 'text-cyan-300',
    textSecondary: 'text-pink-400',
    textMuted: 'text-purple-400',
    border: 'border-cyan-500',
    input: 'bg-black border-2 border-cyan-500 text-cyan-300 focus:border-pink-500',
    button: 'bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-black font-bold',
    buttonSecondary: 'bg-transparent border-2 border-cyan-500 hover:border-pink-500 text-cyan-400 hover:text-pink-400',
    nav: 'bg-black bg-opacity-90 backdrop-blur-md border-cyan-500',
    navText: 'text-cyan-400',
    navActive: 'bg-gradient-to-r from-cyan-500 to-pink-500 text-black font-bold',
    success: 'bg-green-900 bg-opacity-50 text-green-400 border-green-500 border-2',
    warning: 'bg-yellow-900 bg-opacity-50 text-yellow-400 border-yellow-500 border-2',
    error: 'bg-red-900 bg-opacity-50 text-red-400 border-red-500 border-2',
    info: 'bg-cyan-900 bg-opacity-50 text-cyan-400 border-cyan-500 border-2',
    gradient: 'from-cyan-500 to-pink-500',
    shadow: 'shadow-2xl shadow-cyan-500/30',
  },
}

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState('light')

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('k8s-dashboard-theme')
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme)
    }
  }, [])

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('k8s-dashboard-theme', currentTheme)
  }, [currentTheme])

  const theme = themes[currentTheme]

  const toggleTheme = () => {
    const themeKeys = Object.keys(themes)
    const currentIndex = themeKeys.indexOf(currentTheme)
    const nextIndex = (currentIndex + 1) % themeKeys.length
    setCurrentTheme(themeKeys[nextIndex])
  }

  const setTheme = (themeName) => {
    if (themes[themeName]) {
      setCurrentTheme(themeName)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, toggleTheme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
