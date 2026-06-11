import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Send, Loader2, Lightbulb, Target, MessageSquare, Box, Calendar, AlertTriangle, BarChart3, Activity, Clock, DollarSign, FlaskConical, Eye, Zap, Edit3, Bot, LogOut } from 'lucide-react'
import { SimulationDashboard, TraceViewer, OptimizerDashboard, TemplateEditor, AgentTemplateEditor, Track2Dashboard } from './components/track2'
import { Button } from './components/ui/button'
import { Card, CardContent } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { Textarea } from './components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'
import { cn } from './lib/utils'
import { Login } from './components/Login'
import { useAuth } from './hooks/useAuth'

// Agent URL - unified server on port 3001
const DEPLOYED_AGENT = 'https://founder-validation-agent-356663565224.us-central1.run.app'
const LOCAL_AGENT = 'http://localhost:3001'
const getAgentUrl = () => {
  const saved = localStorage.getItem('agentUrl')
  if (saved === DEPLOYED_AGENT) return saved
  if (saved === LOCAL_AGENT) return saved
  // Default to local if running on localhost
  return window.location.hostname === 'localhost' ? LOCAL_AGENT : DEPLOYED_AGENT
}
const BACKEND_URL = getAgentUrl()

function App() {
  // All hooks must be at the top - before any conditional returns
  const { isAuthenticated, loading: authLoading, login, logout, getAuthHeaders } = useAuth()
  const [currentView, setCurrentView] = useState('chat')
  const [agentUrl, setAgentUrl] = useState(BACKEND_URL)
  const [isDeployed, setIsDeployed] = useState(BACKEND_URL === DEPLOYED_AGENT)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Welcome to **SoeMind Foundry** 👋

I'm your AI validation partner, designed to help founders test ideas before building. I specialize in:

• **Idea Clarification** — Transform vague concepts into testable hypotheses
• **Assumption Mapping** — Identify the riskiest assumptions in your business model
• **Customer Discovery** — Generate interview questions that reveal real insights
• **MVP Scoping** — Define the smallest experiment to validate demand
• **Validation Planning** — Create a focused 7-day sprint to test your idea

Share your startup idea and let's start validating.`,
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [toolCalls, setToolCalls] = useState([])
  const [activeTab, setActiveTab] = useState('chat')
  const [metrics, setMetrics] = useState({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    responseTimes: [],
    toolCallCounts: {},
    sessionStart: Date.now(),
  })
  const messagesEndRef = useRef(null)

  const toggleAgent = () => {
    const newUrl = isDeployed ? LOCAL_AGENT : DEPLOYED_AGENT
    setAgentUrl(newUrl)
    setIsDeployed(!isDeployed)
    localStorage.setItem('agentUrl', newUrl || 'local')
    window.location.reload() // Reload to use new agent
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const createSession = async () => {
    if (!isAuthenticated) return
    try {
      const newSessionId = `session_${Date.now()}`
      const res = await fetch(`${agentUrl}/apps/src/users/user/sessions/${newSessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      setSessionId(data.id || newSessionId)
    } catch (err) {
      setSessionId(`session_${Date.now()}`)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    createSession()
  }, [isAuthenticated])

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={login} />
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    if (!sessionId) {
      await createSession()
    }

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    const startTime = Date.now()

    try {
      const res = await fetch(`${agentUrl}/run_sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          appName: 'src',
          userId: 'user',
          sessionId: sessionId,
          newMessage: {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        }),
      })

      // Check for auth or other errors
      if (!res.ok) {
        const errorText = await res.text()
        console.error('[Chat] Error response:', res.status, errorText)
        throw new Error(`Server error: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantResponse = ''
      let currentToolCalls = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.content?.parts) {
                for (const part of data.content.parts) {
                  if (part.text) {
                    assistantResponse += part.text
                  }
                  if (part.functionCall) {
                    currentToolCalls.push({
                      name: part.functionCall.name,
                      args: part.functionCall.args,
                      timestamp: Date.now(),
                    })
                  }
                }
              }

              if (data.text) {
                assistantResponse += data.text
              }
            } catch (e) {
              // Skip parse errors
            }
          }
        }
      }

      const responseTime = Date.now() - startTime

      setMetrics((prev) => {
        const newResponseTimes = [...prev.responseTimes, responseTime]
        const newToolCounts = { ...prev.toolCallCounts }
        currentToolCalls.forEach((tc) => {
          newToolCounts[tc.name] = (newToolCounts[tc.name] || 0) + 1
        })

        return {
          ...prev,
          totalRequests: prev.totalRequests + 1,
          successfulRequests: prev.successfulRequests + 1,
          responseTimes: newResponseTimes,
          avgResponseTime: Math.round(
            newResponseTimes.reduce((a, b) => a + b, 0) / newResponseTimes.length
          ),
          toolCallCounts: newToolCounts,
        }
      })

      if (currentToolCalls.length > 0) {
        setToolCalls((prev) => [...prev, ...currentToolCalls])
      }

      if (assistantResponse) {
        setMessages((prev) => [...prev, { role: 'assistant', content: assistantResponse }])
      }
    } catch (err) {
      console.error('[Chat] Error:', err)
      setMetrics((prev) => ({
        ...prev,
        totalRequests: prev.totalRequests + 1,
        failedRequests: prev.failedRequests + 1,
      }))
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry, I had trouble connecting: ${err.message}. Please try refreshing the page or logging in again.` },
      ])
    }

    setIsLoading(false)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const getToolIcon = (toolName) => {
    const icons = {
      clarify_idea: Lightbulb,
      identify_risky_assumptions: AlertTriangle,
      generate_interview_questions: MessageSquare,
      define_mvp_scope: Box,
      create_7day_validation_plan: Calendar,
    }
    const Icon = icons[toolName] || Target
    return <Icon className="w-4 h-4" />
  }

  const formatDuration = (ms) => {
    const seconds = Math.floor((Date.now() - ms) / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  // Navigation items
  const navItems = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'simulation', label: 'Simulation', icon: FlaskConical },
    { id: 'templates', label: 'Agent Prompts', icon: Bot },
    { id: 'traces', label: 'Traces', icon: Eye },
    { id: 'optimizer', label: 'Optimizer', icon: Zap },
  ]

  // Render different views
  const renderContent = () => {
    switch (currentView) {
      case 'simulation':
        return <SimulationDashboard />
      case 'templates':
        return <TemplateEditor />
      case 'traces':
        return <TraceViewer sessionId={sessionId} />
      case 'optimizer':
        return <OptimizerDashboard />
      default:
        return renderChat()
    }
  }

  const renderChat = () => (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 p-4 hidden lg:block overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="chat" className="flex-1">
              <Target className="w-4 h-4 mr-1" /> Tools
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex-1">
              <BarChart3 className="w-4 h-4 mr-1" /> Metrics
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'chat' ? (
          <div>
            <h2 className="text-sm font-medium text-slate-400 mb-3">Tool Activity</h2>
            {toolCalls.length === 0 ? (
              <p className="text-sm text-slate-500">
                Tools will appear here as the agent uses them...
              </p>
            ) : (
              <div className="space-y-2">
                {toolCalls.slice(-10).reverse().map((tool, i) => (
                  <Card key={i} className="bg-slate-800/50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium">
                        {getToolIcon(tool.name)}
                        {tool.name.replace(/_/g, ' ')}
                      </div>
                      <pre className="text-xs text-slate-500 mt-2 overflow-x-auto max-h-20">
                        {JSON.stringify(tool.args, null, 2)?.slice(0, 200)}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="bg-slate-800/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Clock className="w-3 h-3" />
                  Session Duration
                </div>
                <p className="text-lg font-semibold text-slate-200">{formatDuration(metrics.sessionStart)}</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Activity className="w-3 h-3" />
                  Requests
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-emerald-400 font-semibold">{metrics.successfulRequests}</span>
                    <span className="text-slate-500 ml-1">success</span>
                  </div>
                  <div>
                    <span className="text-rose-400 font-semibold">{metrics.failedRequests}</span>
                    <span className="text-slate-500 ml-1">failed</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Clock className="w-3 h-3" />
                  Avg Response Time
                </div>
                <p className="text-lg font-semibold text-slate-200">
                  {metrics.avgResponseTime > 0 ? `${metrics.avgResponseTime}ms` : '-'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Target className="w-3 h-3" />
                  Tool Usage
                </div>
                {Object.keys(metrics.toolCallCounts).length === 0 ? (
                  <p className="text-slate-500 text-sm">No tools used yet</p>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(metrics.toolCallCounts).map(([name, count]) => (
                      <div key={name} className="flex justify-between text-sm">
                        <span className="text-slate-400">{name.replace(/_/g, ' ')}</span>
                        <span className="text-indigo-400 font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <DollarSign className="w-3 h-3" />
                  Est. Cost
                </div>
                <p className="text-lg font-semibold text-emerald-400">
                  ~${(metrics.totalRequests * 0.0005).toFixed(4)}
                </p>
                <p className="text-xs text-slate-500">Based on avg 1000 tokens/request</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 h-full">
        {/* Messages - scrollable container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 max-h-full">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={cn(
                  "max-w-2xl rounded-2xl px-5 py-4 shadow-lg",
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white'
                    : 'bg-gradient-to-br from-slate-800 to-slate-800/80 text-slate-100 border border-slate-700/50'
                )}
              >
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({children}) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                      ol: ({children}) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                      li: ({children}) => <li className="text-sm">{children}</li>,
                      strong: ({children}) => <strong className="font-semibold text-white">{children}</strong>,
                      em: ({children}) => <em className="italic">{children}</em>,
                      code: ({children}) => <code className="bg-slate-700 px-1 py-0.5 rounded text-xs">{children}</code>,
                      h1: ({children}) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                      h2: ({children}) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                      h3: ({children}) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                <span className="text-slate-400 text-sm">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input - full width */}
        <div className="border-t border-slate-800/50 p-4 bg-gradient-to-t from-slate-900 to-transparent">
          <div className="flex gap-3 bg-slate-800/50 rounded-xl p-2 border border-slate-700/50 shadow-lg">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe your startup idea..."
                className="flex-1 bg-transparent border-0 focus:ring-0 resize-none text-slate-100 placeholder:text-slate-500"
                rows={2}
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                size="lg"
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 rounded-xl"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
          <p className="text-center text-slate-600 text-xs mt-2">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Navigation Header */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border-b border-slate-800/50 px-6 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Lightbulb className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-lg bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">SoeMind</span>
                <span className="text-xs text-slate-500 block -mt-1">Foundry</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-1">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    currentView === item.id
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="track2">Track 2</Badge>

            {/* Cloud Run Status & Actions */}
            <div className="flex items-center gap-2">
              {/* Status Indicator */}
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
                isDeployed
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/50"
                  : "bg-amber-600/20 text-amber-400 border border-amber-600/50"
              )}>
                <span className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  isDeployed ? "bg-emerald-500" : "bg-amber-500"
                )} />
                {isDeployed ? "Cloud Run" : "Local"}
              </div>

              {/* Toggle Button */}
              <button
                onClick={toggleAgent}
                className="px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors border border-slate-700"
                title={isDeployed ? "Switch to Local" : "Switch to Cloud Run"}
              >
                Switch
              </button>

              {/* Open Console */}
              {isDeployed && (
                <a
                  href="https://console.cloud.google.com/run?project=inner-suprstate-498116-a1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors border border-slate-700"
                  title="Open Cloud Run Console"
                >
                  Console
                </a>
              )}

              {/* Logout Button */}
              <button
                onClick={logout}
                className="px-2 py-1.5 rounded-lg text-xs font-medium bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300 transition-colors border border-red-800/50 flex items-center gap-1"
                title="Sign out"
              >
                <LogOut className="w-3 h-3" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {renderContent()}
      </main>
    </div>
  )
}

export default App
