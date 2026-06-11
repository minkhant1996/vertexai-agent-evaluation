import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Play,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Target,
  User,
  Bot,
  Zap,
  Clock,
  MessageSquare,
  Activity,
  Pause,
  SkipForward,
  SplitSquareHorizontal,
  LayoutList,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { StatCard } from '../ui/stat-card'
import { cn } from '../../lib/utils'
import { DualLiveSimulation } from './DualLiveSimulation'

// Use relative URL when not in development (same-origin)
const BACKEND_URL = import.meta.env.VITE_API_URL || ''

export function SimulationDashboard() {
  const [scenarios, setScenarios] = useState([])
  const [results, setResults] = useState({})
  const [running, setRunning] = useState(false)
  const [currentScenarioId, setCurrentScenarioId] = useState(null)
  const [expandedScenario, setExpandedScenario] = useState(null)

  // View mode: 'single' for regular view, 'parallel' for dual live view
  const [viewMode, setViewMode] = useState('single')

  // Selected scenario (preview mode)
  const [selectedScenario, setSelectedScenario] = useState(null)

  // Live simulation state
  const [liveMode, setLiveMode] = useState(false)
  const [liveConversation, setLiveConversation] = useState([])
  const [currentTurn, setCurrentTurn] = useState(null)
  const [agentThinking, setAgentThinking] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [liveMetrics, setLiveMetrics] = useState({
    currentScenario: 0,
    totalScenarios: 0,
    passedCount: 0,
    failedCount: 0,
    passRate: 0,
    currentLatency: 0,
  })
  const [liveToolCalls, setLiveToolCalls] = useState([])
  const [currentScenarioData, setCurrentScenarioData] = useState(null)
  const [criteriaResults, setCriteriaResults] = useState([])

  const chatEndRef = useRef(null)
  const abortControllerRef = useRef(null)

  useEffect(() => {
    fetchScenarios()
    fetchPreviousResults()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [liveConversation, streamingText])

  const fetchScenarios = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/simulation/scenarios`)
      const data = await res.json()
      setScenarios(data)
    } catch (err) {
      console.error('Failed to fetch scenarios:', err)
    }
  }

  // Load previous results
  const fetchPreviousResults = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/simulation/history`)
      const history = await res.json()
      if (history && history.length > 0) {
        // Group by scenarioId, keep latest result for each
        const latestResults = {}
        for (const run of history) {
          if (!latestResults[run.scenarioId] || new Date(run.createdAt) > new Date(latestResults[run.scenarioId].createdAt)) {
            latestResults[run.scenarioId] = run
          }
        }
        // Convert to results format
        const resultsMap = {}
        for (const [scenarioId, run] of Object.entries(latestResults)) {
          resultsMap[scenarioId] = {
            passed: run.passed,
            score: run.score,
            failureReasons: run.failureReasons || [],
            metrics: run.metrics || {},
            createdAt: run.createdAt,
          }
        }
        setResults(resultsMap)
      }
    } catch (err) {
      console.error('Failed to fetch previous results:', err)
    }
  }

  const runSingleScenario = async (scenarioId) => {
    setRunning(true)
    setCurrentScenarioId(scenarioId)
    setSelectedScenario(null) // Clear preview, show live mode
    setLiveMode(true)
    setLiveConversation([])
    setStreamingText('')
    setAgentThinking(false)
    setLiveToolCalls([])

    const scenario = scenarios.find(s => s.id === scenarioId)
    if (scenario) {
      setLiveConversation([{
        type: 'system',
        content: `Starting simulation: ${scenario.name}`,
        timestamp: Date.now(),
      }])
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/simulation/run-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))
              handleSimulationEvent(event, scenarioId)
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error('Simulation error:', err)
    }

    setRunning(false)
    setCurrentScenarioId(null)
    setAgentThinking(false)
  }

  const runAllScenarios = async () => {
    setRunning(true)
    setLiveMode(true)
    setLiveConversation([])
    setStreamingText('')
    setAgentThinking(false)
    setLiveToolCalls([])
    setResults({})

    setLiveConversation([{
      type: 'system',
      content: `Starting batch simulation: ${scenarios.length} scenarios`,
      timestamp: Date.now(),
    }])

    try {
      const response = await fetch(`${BACKEND_URL}/api/simulation/run-all-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))
              handleSimulationEvent(event)
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error('Batch simulation error:', err)
    }

    setRunning(false)
    setAgentThinking(false)
  }

  const handleSimulationEvent = (event, singleScenarioId = null) => {
    switch (event.type) {
      case 'scenario_start':
        setCurrentScenarioId(event.scenarioId)
        // Find and store current scenario data for criteria display
        const scenarioData = scenarios.find(s => s.id === event.scenarioId)
        setCurrentScenarioData(scenarioData)
        setCriteriaResults([]) // Reset criteria
        setLiveConversation(prev => [...prev, {
          type: 'system',
          content: `Scenario: ${event.scenarioName} (${event.totalTurns} turns)`,
          timestamp: Date.now(),
        }])
        setStreamingText('')
        setLiveToolCalls([])
        break

      case 'turn_start':
        setCurrentTurn(event.turnNumber)
        setLiveConversation(prev => [...prev, {
          type: 'user',
          content: event.userMessage,
          turnNumber: event.turnNumber,
          timestamp: Date.now(),
        }])
        break

      case 'agent_thinking':
        setAgentThinking(true)
        setStreamingText('')
        break

      case 'agent_response':
        setAgentThinking(false)
        if (event.agentChunk) {
          setStreamingText(prev => prev + event.agentChunk)
        }
        break

      case 'turn_complete':
        setAgentThinking(false)
        setStreamingText('')
        setLiveConversation(prev => [...prev, {
          type: 'agent',
          content: event.agentResponse,
          turnNumber: event.turnNumber,
          toolsCalled: event.toolsCalled,
          latencyMs: event.latencyMs,
          timestamp: Date.now(),
        }])
        if (event.toolsCalled?.length > 0) {
          setLiveToolCalls(prev => [...prev, ...event.toolsCalled])
        }
        setLiveMetrics(prev => ({ ...prev, currentLatency: event.latencyMs }))
        break

      case 'scoring':
        // Build criteria results from failure reasons
        const criteria = []
        const scenario = currentScenarioData || scenarios.find(s => s.id === currentScenarioId)

        if (scenario?.passCriteria) {
          // Check mustContain
          (scenario.passCriteria.mustContain || []).forEach(term => {
            const failed = event.failureReasons?.some(r => r.includes(term))
            criteria.push({ type: 'mustContain', term, passed: !failed })
          })
          // Check mustNotContain
          (scenario.passCriteria.mustNotContain || []).forEach(term => {
            const failed = event.failureReasons?.some(r => r.includes(term))
            criteria.push({ type: 'mustNotContain', term, passed: !failed })
          })
          // Check toolsMustCall
          (scenario.passCriteria.toolsMustCall || []).forEach(tool => {
            const failed = event.failureReasons?.some(r => r.includes(tool))
            criteria.push({ type: 'toolsMustCall', term: tool, passed: !failed })
          })
          // Check toolsMustNotCall
          (scenario.passCriteria.toolsMustNotCall || []).forEach(tool => {
            const failed = event.failureReasons?.some(r => r.includes(tool))
            criteria.push({ type: 'toolsMustNotCall', term: tool, passed: !failed })
          })
        }

        // Add any failures not captured above
        event.failureReasons?.forEach(reason => {
          if (!criteria.some(c => reason.includes(c.term))) {
            criteria.push({ type: 'other', term: reason, passed: false })
          }
        })

        setCriteriaResults(criteria)
        setLiveConversation(prev => [...prev, {
          type: 'scoring',
          score: event.score,
          passed: event.passed,
          failureReasons: event.failureReasons,
          timestamp: Date.now(),
        }])
        break

      case 'scenario_complete':
        setResults(prev => ({
          ...prev,
          [event.scenarioId]: {
            passed: event.passed,
            score: event.score,
            failureReasons: event.failureReasons,
            metrics: event.metrics,
          },
        }))
        break

      case 'batch_progress':
        setLiveMetrics({
          currentScenario: event.currentScenario,
          totalScenarios: event.totalScenarios,
          passedCount: event.passedCount,
          failedCount: event.failedCount,
          passRate: event.passRate,
          currentLatency: liveMetrics.currentLatency,
        })
        break

      case 'complete':
      case 'batch_complete':
        // Get the final result from the most recent scoring event (using prev to get latest state)
        setLiveConversation(prev => {
          const lastResult = [...prev].reverse().find(msg => msg.type === 'scoring')
          return [...prev, {
            type: 'final_result',
            passed: lastResult?.passed ?? false,
            score: lastResult?.score ?? 0,
            timestamp: Date.now(),
          }]
        })
        break

      case 'error':
        setLiveConversation(prev => [...prev, {
          type: 'error',
          content: event.error || 'Unknown error',
          timestamp: Date.now(),
        }])
        break
    }
  }

  const passedCount = Object.values(results).filter(r => r.passed).length
  const totalRun = Object.keys(results).length
  const passRate = totalRun > 0 ? (passedCount / totalRun * 100) : 0

  const getDifficultyVariant = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 'success'
      case 'medium': return 'warning'
      case 'hard': return 'error'
      default: return 'secondary'
    }
  }

  // Handle completion from parallel mode
  const handleParallelComplete = (completedResults) => {
    const newResults = {}
    completedResults.forEach(r => {
      newResults[r.scenarioId] = {
        passed: r.passed,
        score: r.score,
      }
    })
    setResults(prev => ({ ...prev, ...newResults }))
    fetchPreviousResults() // Refresh from server
  }

  // If in parallel mode, render the dual live view
  if (viewMode === 'parallel') {
    return (
      <div className="h-full flex flex-col">
        {/* Mode toggle header */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('single')}
              className="text-slate-400 hover:text-slate-200"
            >
              <LayoutList className="w-4 h-4 mr-2" />
              Standard View
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-indigo-500/20 text-indigo-300"
            >
              <SplitSquareHorizontal className="w-4 h-4 mr-2" />
              Parallel View
            </Button>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-emerald-400">{passedCount} passed</span>
            <span className="text-rose-400">{totalRun - passedCount} failed</span>
            <span className={cn(
              "font-semibold",
              passRate >= 80 ? "text-emerald-400" : "text-amber-400"
            )}>
              {passRate.toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="flex-1">
          <DualLiveSimulation
            scenarios={scenarios}
            onComplete={handleParallelComplete}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - Scenario List */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/50">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-indigo-400" />
              Scenarios
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('parallel')}
              className="text-slate-400 hover:text-indigo-400"
              title="Switch to Parallel Live View"
            >
              <SplitSquareHorizontal className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-slate-400 mt-1">{scenarios.length} edge cases</p>
        </div>

        <div className="p-3">
          <Button
            onClick={runAllScenarios}
            disabled={running}
            className="w-full"
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run All Scenarios
              </>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {scenarios.map(scenario => {
            const result = results[scenario.id]
            const isActive = currentScenarioId === scenario.id || selectedScenario?.id === scenario.id

            return (
              <div
                key={scenario.id}
                className={cn(
                  "p-3 border-b border-slate-800 transition-colors",
                  isActive ? "bg-indigo-500/20 border-l-2 border-l-indigo-500" : "hover:bg-slate-800/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                    if (!running) {
                      setSelectedScenario(scenario)
                      setLiveMode(false) // Clear live mode to show preview
                      setLiveConversation([]) // Clear previous conversation
                    }
                  }}>
                    <div className="font-medium text-slate-200 text-sm truncate">{scenario.name}</div>
                    <div className="text-xs text-slate-500 truncate">{scenario.description}</div>
                    {result?.createdAt && (
                      <div className="text-xs text-slate-600 mt-1">
                        Last run: {new Date(result.createdAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge variant={getDifficultyVariant(scenario.difficulty)} className="text-xs">
                      {scenario.difficulty}
                    </Badge>
                    {isActive && running ? (
                      <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                    ) : result ? (
                      <div className="flex items-center gap-1">
                        {result.passed ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                      </div>
                    ) : (
                      <Play className="w-3 h-3 text-slate-500" />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Center Panel - Live Conversation */}
      <div className="flex-1 flex flex-col">
        {/* Live Metrics Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Activity className={cn("w-4 h-4", running ? "text-emerald-400 animate-pulse" : "text-slate-500")} />
                <span className="text-sm text-slate-300">
                  {running ? 'Live' : 'Ready'}
                </span>
              </div>
              {liveMetrics.totalScenarios > 0 && (
                <div className="text-sm text-slate-400">
                  Progress: {liveMetrics.currentScenario}/{liveMetrics.totalScenarios}
                </div>
              )}
              {liveMetrics.currentLatency > 0 && (
                <div className="flex items-center gap-1 text-sm text-slate-400">
                  <Clock className="w-3 h-3" />
                  {liveMetrics.currentLatency}ms
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-semibold">{passedCount}</span>
                <span className="text-slate-500 text-sm">passed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-rose-400 font-semibold">{totalRun - passedCount}</span>
                <span className="text-slate-500 text-sm">failed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-semibold",
                  passRate >= 85 ? "text-emerald-400" : passRate >= 70 ? "text-amber-400" : "text-rose-400"
                )}>
                  {passRate.toFixed(0)}%
                </span>
                <span className="text-slate-500 text-sm">rate</span>
              </div>
            </div>
          </div>
        </div>

        {/* Conversation Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!liveMode && !selectedScenario ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FlaskConical className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-400">Run a Simulation</h3>
                <p className="text-slate-500 mt-2">
                  Click "Run All" or select a scenario to see details
                </p>
              </div>
            </div>
          ) : !liveMode && selectedScenario ? (
            <ScenarioPreview
              scenario={selectedScenario}
              result={results[selectedScenario.id]}
              onRun={() => runSingleScenario(selectedScenario.id)}
              running={running}
            />
          ) : (
            <>
              {liveConversation.map((msg, i) => (
                <ConversationMessage key={i} message={msg} />
              ))}

              {/* Streaming text */}
              {streamingText && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 bg-slate-800 rounded-2xl rounded-tl-none p-4 max-w-2xl">
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({children}) => <p className="mb-2 last:mb-0 text-slate-200">{children}</p>,
                          ul: ({children}) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                          li: ({children}) => <li className="text-sm text-slate-200">{children}</li>,
                          strong: ({children}) => <strong className="font-semibold text-white">{children}</strong>,
                        }}
                      >
                        {streamingText}
                      </ReactMarkdown>
                    </div>
                    <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-1" />
                  </div>
                </div>
              )}

              {/* Agent thinking indicator */}
              {agentThinking && !streamingText && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-slate-800 rounded-2xl rounded-tl-none p-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Agent is thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Right Panel - Live Tools & Scoring */}
      <div className="w-72 border-l border-slate-800 flex flex-col bg-slate-900/50">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-300">Live Activity</h3>
        </div>

        {/* Score Dashboard */}
        <div className="p-4 border-b border-slate-800">
          <h4 className="text-xs font-medium text-slate-500 uppercase mb-3">Overall Score</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className={cn(
                "text-2xl font-bold",
                passRate >= 85 ? "text-emerald-400" : passRate >= 70 ? "text-amber-400" : "text-rose-400"
              )}>
                {passRate.toFixed(0)}%
              </div>
              <div className="text-xs text-slate-500">Pass Rate</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-200">{totalRun}</div>
              <div className="text-xs text-slate-500">Completed</div>
            </div>
          </div>

          {/* Progress bar */}
          {liveMetrics.totalScenarios > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Progress</span>
                <span>{liveMetrics.currentScenario}/{liveMetrics.totalScenarios}</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(liveMetrics.passedCount / Math.max(liveMetrics.totalScenarios, 1)) * 100}%` }}
                />
                <div
                  className="bg-rose-500 transition-all duration-300"
                  style={{ width: `${(liveMetrics.failedCount / Math.max(liveMetrics.totalScenarios, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Pass Criteria */}
        <div className="p-4 border-b border-slate-800">
          <h4 className="text-xs font-medium text-slate-500 uppercase mb-3">Pass Criteria</h4>
          {currentScenarioData?.passCriteria ? (
            <div className="space-y-2 text-xs">
              {(currentScenarioData.passCriteria.mustContain || []).map((term, i) => {
                const result = criteriaResults.find(c => c.term === term && c.type === 'mustContain')
                return (
                  <div key={`mc-${i}`} className="flex items-start gap-2">
                    {result ? (
                      result.passed ? <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" /> : <XCircle className="w-3 h-3 text-rose-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-slate-600 mt-0.5 flex-shrink-0" />
                    )}
                    <span className={cn("text-slate-400", result?.passed === false && "text-rose-300")}>
                      Must contain: "{term}"
                    </span>
                  </div>
                )
              })}
              {(currentScenarioData.passCriteria.mustNotContain || []).map((term, i) => {
                const result = criteriaResults.find(c => c.term === term && c.type === 'mustNotContain')
                return (
                  <div key={`mnc-${i}`} className="flex items-start gap-2">
                    {result ? (
                      result.passed ? <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" /> : <XCircle className="w-3 h-3 text-rose-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-slate-600 mt-0.5 flex-shrink-0" />
                    )}
                    <span className={cn("text-slate-400", result?.passed === false && "text-rose-300")}>
                      Must NOT contain: "{term}"
                    </span>
                  </div>
                )
              })}
              {(currentScenarioData.passCriteria.toolsMustCall || []).map((tool, i) => {
                const result = criteriaResults.find(c => c.term === tool && c.type === 'toolsMustCall')
                const called = liveToolCalls.includes(tool)
                return (
                  <div key={`tmc-${i}`} className="flex items-start gap-2">
                    {result ? (
                      result.passed ? <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" /> : <XCircle className="w-3 h-3 text-rose-400 mt-0.5 flex-shrink-0" />
                    ) : called ? (
                      <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-slate-600 mt-0.5 flex-shrink-0" />
                    )}
                    <span className={cn("text-slate-400", result?.passed === false && "text-rose-300")}>
                      Must call: {tool.replace(/_/g, ' ')}
                    </span>
                  </div>
                )
              })}
              {(currentScenarioData.passCriteria.toolsMustNotCall || []).map((tool, i) => {
                const result = criteriaResults.find(c => c.term === tool && c.type === 'toolsMustNotCall')
                return (
                  <div key={`tmnc-${i}`} className="flex items-start gap-2">
                    {result ? (
                      result.passed ? <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" /> : <XCircle className="w-3 h-3 text-rose-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-slate-600 mt-0.5 flex-shrink-0" />
                    )}
                    <span className={cn("text-slate-400", result?.passed === false && "text-rose-300")}>
                      Must NOT call: {tool.replace(/_/g, ' ')}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select a scenario to see criteria</p>
          )}
        </div>

        {/* Tools Called */}
        <div className="flex-1 overflow-y-auto p-4">
          <h4 className="text-xs font-medium text-slate-500 uppercase mb-3">Tools Called</h4>
          {liveToolCalls.length === 0 ? (
            <p className="text-sm text-slate-500">No tools called yet...</p>
          ) : (
            <div className="space-y-2">
              {[...new Set(liveToolCalls)].map((tool, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="text-sm text-slate-300">{tool.replace(/_/g, ' ')}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {liveToolCalls.filter(t => t === tool).length}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ScenarioPreview({ scenario, result, onRun, running }) {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-slate-100">{scenario.name}</h2>
            <Badge variant={scenario.difficulty === 'hard' ? 'error' : scenario.difficulty === 'medium' ? 'warning' : 'success'}>
              {scenario.difficulty}
            </Badge>
            {result && (
              <Badge variant={result.passed ? 'success' : 'error'}>
                {result.passed ? 'PASSED' : 'FAILED'}
              </Badge>
            )}
          </div>
          <p className="text-slate-400">{scenario.description}</p>
        </div>
        <Button onClick={onRun} disabled={running} size="lg">
          {running ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Test
            </>
          )}
        </Button>
      </div>

      {/* Test Details */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left Column - Prompts */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                Initial Prompt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-300 bg-slate-800/50 rounded-lg p-3">
                "{scenario.initialPrompt}"
              </p>
            </CardContent>
          </Card>

          {scenario.followUpPrompts?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  Follow-up Prompts ({scenario.followUpPrompts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {scenario.followUpPrompts.map((prompt, i) => (
                    <p key={i} className="text-sm text-slate-300 bg-slate-800/50 rounded-lg p-3">
                      {i + 1}. "{prompt}"
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Expected Behavior & Criteria */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                Expected Agent Behavior
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {scenario.expectedAgentBehavior?.map((behavior, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    {behavior}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-amber-400" />
                Pass Criteria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                {scenario.passCriteria?.mustContain?.length > 0 && (
                  <div>
                    <p className="text-slate-500 text-xs uppercase mb-1">Must contain:</p>
                    <div className="flex flex-wrap gap-1">
                      {scenario.passCriteria.mustContain.map((term, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">"{term}"</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {scenario.passCriteria?.mustNotContain?.length > 0 && (
                  <div>
                    <p className="text-slate-500 text-xs uppercase mb-1">Must NOT contain:</p>
                    <div className="flex flex-wrap gap-1">
                      {scenario.passCriteria.mustNotContain.map((term, i) => (
                        <Badge key={i} variant="error" className="text-xs">"{term}"</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {scenario.passCriteria?.toolsMustCall?.length > 0 && (
                  <div>
                    <p className="text-slate-500 text-xs uppercase mb-1">Must call tools:</p>
                    <div className="flex flex-wrap gap-1">
                      {scenario.passCriteria.toolsMustCall.map((tool, i) => (
                        <Badge key={i} variant="warning" className="text-xs">{tool}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {scenario.passCriteria?.toolsMustNotCall?.length > 0 && (
                  <div>
                    <p className="text-slate-500 text-xs uppercase mb-1">Must NOT call tools:</p>
                    <div className="flex flex-wrap gap-1">
                      {scenario.passCriteria.toolsMustNotCall.map((tool, i) => (
                        <Badge key={i} variant="error" className="text-xs">{tool}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Previous Result */}
          {result && (
            <Card className={result.passed ? 'border-emerald-500/30' : 'border-rose-500/30'}>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  {result.passed ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                  Last Run Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Score:</span>
                    <span className={result.passed ? 'text-emerald-400' : 'text-rose-400'}>
                      {(result.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  {result.metrics?.totalLatencyMs && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Latency:</span>
                      <span className="text-slate-300">{result.metrics.totalLatencyMs}ms</span>
                    </div>
                  )}
                  {result.failureReasons?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-slate-500 text-xs uppercase mb-1">Issues:</p>
                      {result.failureReasons.map((reason, i) => (
                        <p key={i} className="text-rose-300 text-xs">{reason}</p>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function ConversationMessage({ message }) {
  if (message.type === 'system') {
    return (
      <div className="flex justify-center">
        <div className="bg-slate-800/50 rounded-full px-4 py-2 text-sm text-slate-400">
          {message.content}
        </div>
      </div>
    )
  }

  if (message.type === 'final_result') {
    return (
      <div className="flex justify-center my-4">
        <div className={cn(
          "rounded-xl px-6 py-4 text-center border-2",
          message.passed
            ? "bg-emerald-500/20 border-emerald-500/50"
            : "bg-rose-500/20 border-rose-500/50"
        )}>
          <div className="flex items-center justify-center gap-2 mb-2">
            {message.passed ? (
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            ) : (
              <XCircle className="w-8 h-8 text-rose-400" />
            )}
          </div>
          <div className={cn(
            "text-2xl font-bold",
            message.passed ? "text-emerald-400" : "text-rose-400"
          )}>
            {message.passed ? 'PASSED' : 'FAILED'}
          </div>
          <div className="text-sm text-slate-400 mt-1">
            Score: {((message.score || 0) * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    )
  }

  if (message.type === 'error') {
    return (
      <div className="flex justify-center">
        <div className="bg-rose-500/20 border border-rose-500/30 rounded-lg px-4 py-2 text-sm text-rose-400">
          Error: {message.content}
        </div>
      </div>
    )
  }

  if (message.type === 'scoring') {
    return (
      <div className="flex justify-center">
        <div className={cn(
          "rounded-lg px-4 py-3 text-sm flex items-center gap-3",
          message.passed
            ? "bg-emerald-500/20 border border-emerald-500/30"
            : "bg-rose-500/20 border border-rose-500/30"
        )}>
          {message.passed ? (
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-400" />
          )}
          <div>
            <span className={message.passed ? "text-emerald-400" : "text-rose-400"}>
              Score: {(message.score * 100).toFixed(0)}% - {message.passed ? 'PASSED' : 'FAILED'}
            </span>
            {message.failureReasons?.length > 0 && (
              <div className="text-xs text-rose-300 mt-1">
                {message.failureReasons.join(' | ')}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (message.type === 'user') {
    return (
      <div className="flex gap-3 justify-end">
        <div className="flex-1 max-w-2xl">
          <div className="flex items-center justify-end gap-2 mb-1">
            <span className="text-xs text-slate-500">Simulated User</span>
            <Badge variant="secondary" className="text-xs">Turn {message.turnNumber}</Badge>
          </div>
          <div className="bg-indigo-600 rounded-2xl rounded-tr-none p-4">
            <div className="text-sm text-white whitespace-pre-wrap">{message.content}</div>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-white" />
        </div>
      </div>
    )
  }

  if (message.type === 'agent') {
    return (
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 max-w-2xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-500">Agent</span>
            {message.toolsCalled?.length > 0 && (
              <Badge variant="warning" className="text-xs">
                <Zap className="w-3 h-3 mr-1" />
                {message.toolsCalled.join(', ')}
              </Badge>
            )}
            {message.latencyMs && (
              <span className="text-xs text-slate-600">{message.latencyMs}ms</span>
            )}
          </div>
          <div className="bg-slate-800 rounded-2xl rounded-tl-none p-4">
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  p: ({children}) => <p className="mb-2 last:mb-0 text-slate-200">{children}</p>,
                  ul: ({children}) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                  li: ({children}) => <li className="text-sm text-slate-200">{children}</li>,
                  strong: ({children}) => <strong className="font-semibold text-white">{children}</strong>,
                  em: ({children}) => <em className="italic">{children}</em>,
                  code: ({children}) => <code className="bg-slate-700 px-1 py-0.5 rounded text-xs">{children}</code>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default SimulationDashboard
