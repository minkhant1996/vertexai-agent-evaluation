import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  GitCompare,
  Bot,
  User,
  CheckCircle,
  XCircle,
  Trophy,
  Clock,
  RefreshCw,
  X,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'
import { getAuthHeaders } from '../../lib/api'
import { API_URL as BACKEND_URL } from '../../config'

export function LiveABTest({ versionA, versionB, onClose }) {
  const [running, setRunning] = useState(false)
  const [currentScenario, setCurrentScenario] = useState(null)
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [totalScenarios, setTotalScenarios] = useState(0)

  // Streaming responses
  const [responseA, setResponseA] = useState('')
  const [responseB, setResponseB] = useState('')
  const [thinkingA, setThinkingA] = useState(false)
  const [thinkingB, setThinkingB] = useState(false)

  // Scores
  const [scoreA, setScoreA] = useState(null)
  const [scoreB, setScoreB] = useState(null)
  const [latencyA, setLatencyA] = useState(null)
  const [latencyB, setLatencyB] = useState(null)

  // Overall progress
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
    scoreA: 0,
    scoreB: 0,
    winsA: 0,
    winsB: 0,
    ties: 0,
  })

  // Scenario results
  const [scenarioResults, setScenarioResults] = useState([])
  const [winner, setWinner] = useState(null)

  const chatRefA = useRef(null)
  const chatRefB = useRef(null)

  useEffect(() => {
    if (chatRefA.current) chatRefA.current.scrollTop = chatRefA.current.scrollHeight
    if (chatRefB.current) chatRefB.current.scrollTop = chatRefB.current.scrollHeight
  }, [responseA, responseB])

  const startTest = async () => {
    setRunning(true)
    setScenarioResults([])
    setWinner(null)
    setProgress({ completed: 0, total: 0, scoreA: 0, scoreB: 0, winsA: 0, winsB: 0, ties: 0 })

    try {
      const response = await fetch(`${BACKEND_URL}/api/optimizer/ab-test-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ versionA: versionA.version, versionB: versionB.version }),
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
              handleEvent(event)
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error('A/B Test error:', err)
    }

    setRunning(false)
  }

  const handleEvent = (event) => {
    switch (event.type) {
      case 'start':
        setTotalScenarios(event.totalScenarios)
        setProgress(event.overallProgress)
        break

      case 'scenario_start':
        setCurrentScenario(event.scenarioName)
        setScenarioIndex(event.scenarioIndex)
        setResponseA('')
        setResponseB('')
        setScoreA(null)
        setScoreB(null)
        setLatencyA(null)
        setLatencyB(null)
        break

      case 'version_a_thinking':
        setThinkingA(true)
        break

      case 'version_a_response':
        setThinkingA(false)
        if (event.versionA?.chunk) {
          setResponseA(prev => prev + event.versionA.chunk)
        }
        break

      case 'version_a_complete':
        setThinkingA(false)
        setScoreA(Math.round((event.versionA?.score || 0) * 100))
        setLatencyA(event.versionA?.latencyMs)
        break

      case 'version_b_thinking':
        setThinkingB(true)
        break

      case 'version_b_response':
        setThinkingB(false)
        if (event.versionB?.chunk) {
          setResponseB(prev => prev + event.versionB.chunk)
        }
        break

      case 'version_b_complete':
        setThinkingB(false)
        setScoreB(Math.round((event.versionB?.score || 0) * 100))
        setLatencyB(event.versionB?.latencyMs)
        break

      case 'scenario_complete':
        setScenarioResults(prev => [...prev, {
          name: event.scenarioName,
          scoreA: Math.round((event.versionA?.score || 0) * 100),
          scoreB: Math.round((event.versionB?.score || 0) * 100),
          winner: event.winner,
        }])
        setProgress(event.overallProgress)
        break

      case 'complete':
        // Determine overall winner
        if (progress.scoreA > progress.scoreB + 5) {
          setWinner('A')
        } else if (progress.scoreB > progress.scoreA + 5) {
          setWinner('B')
        } else {
          setWinner('tie')
        }
        break
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <GitCompare className="w-6 h-6 text-violet-400" />
            <h2 className="text-xl font-bold text-slate-100">Live A/B Test</h2>
            <Badge variant="secondary">
              Version {versionA.version} vs Version {versionB.version}
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            {!running && !winner && (
              <Button onClick={startTest}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Start Test
              </Button>
            )}
            {running && (
              <Badge variant="warning" className="animate-pulse">
                Testing {scenarioIndex + 1}/{totalScenarios}: {currentScenario}
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-800/50">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-slate-400">Progress: {progress.completed}/{progress.total}</span>
            <div className="flex gap-4">
              <span className="text-blue-400">V{versionA.version}: {progress.scoreA}%</span>
              <span className="text-emerald-400">V{versionB.version}: {progress.scoreB}%</span>
              <span className="text-slate-400">
                Wins: {progress.winsA} - {progress.ties} - {progress.winsB}
              </span>
            </div>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex">
            <div
              className="bg-blue-500 transition-all duration-300"
              style={{ width: `${(progress.winsA / Math.max(progress.completed, 1)) * 100}%` }}
            />
            <div
              className="bg-slate-500 transition-all duration-300"
              style={{ width: `${(progress.ties / Math.max(progress.completed, 1)) * 100}%` }}
            />
            <div
              className="bg-emerald-500 transition-all duration-300"
              style={{ width: `${(progress.winsB / Math.max(progress.completed, 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Main Content - Side by Side */}
        <div className="flex-1 flex overflow-hidden">
          {/* Version A Panel */}
          <div className="flex-1 flex flex-col border-r border-slate-700">
            <div className="p-3 border-b border-slate-800 bg-blue-500/10 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-blue-400 font-semibold">Version {versionA.version}</span>
                {versionA.agentName && (
                  <Badge variant="secondary" className="text-xs">{versionA.agentName}</Badge>
                )}
              </div>
              {scoreA !== null && (
                <div className="flex items-center gap-2">
                  <Badge variant={scoreA >= 70 ? 'success' : scoreA >= 50 ? 'warning' : 'error'}>
                    {scoreA}%
                  </Badge>
                  {latencyA && <span className="text-xs text-slate-500">{latencyA}ms</span>}
                </div>
              )}
            </div>
            <div ref={chatRefA} className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentScenario && (
                <div className="bg-indigo-600 rounded-lg p-3 max-w-[80%]">
                  <div className="text-xs text-indigo-200 mb-1">Scenario: {currentScenario}</div>
                  <div className="text-white text-sm">Testing agent response...</div>
                </div>
              )}
              {(responseA || thinkingA) && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 bg-slate-800 rounded-lg p-3">
                    {thinkingA && !responseA ? (
                      <div className="flex items-center gap-2 text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Thinking...
                      </div>
                    ) : (
                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{responseA}</ReactMarkdown>
                        {thinkingA && <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1" />}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Version B Panel */}
          <div className="flex-1 flex flex-col">
            <div className="p-3 border-b border-slate-800 bg-emerald-500/10 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-semibold">Version {versionB.version}</span>
                {versionB.agentName && (
                  <Badge variant="secondary" className="text-xs">{versionB.agentName}</Badge>
                )}
              </div>
              {scoreB !== null && (
                <div className="flex items-center gap-2">
                  <Badge variant={scoreB >= 70 ? 'success' : scoreB >= 50 ? 'warning' : 'error'}>
                    {scoreB}%
                  </Badge>
                  {latencyB && <span className="text-xs text-slate-500">{latencyB}ms</span>}
                </div>
              )}
            </div>
            <div ref={chatRefB} className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentScenario && (
                <div className="bg-indigo-600 rounded-lg p-3 max-w-[80%]">
                  <div className="text-xs text-indigo-200 mb-1">Scenario: {currentScenario}</div>
                  <div className="text-white text-sm">Testing agent response...</div>
                </div>
              )}
              {(responseB || thinkingB) && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 bg-slate-800 rounded-lg p-3">
                    {thinkingB && !responseB ? (
                      <div className="flex items-center gap-2 text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Thinking...
                      </div>
                    ) : (
                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{responseB}</ReactMarkdown>
                        {thinkingB && <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-1" />}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Footer */}
        {scenarioResults.length > 0 && (
          <div className="p-4 border-t border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-4 overflow-x-auto pb-2">
              {scenarioResults.map((result, i) => (
                <div key={i} className={cn(
                  "flex-shrink-0 px-3 py-2 rounded-lg border text-sm",
                  result.winner === 'A' ? "bg-blue-500/20 border-blue-500/50" :
                  result.winner === 'B' ? "bg-emerald-500/20 border-emerald-500/50" :
                  "bg-slate-700/50 border-slate-600"
                )}>
                  <div className="text-slate-300 text-xs mb-1">{result.name}</div>
                  <div className="flex items-center gap-2">
                    <span className={result.winner === 'A' ? "text-blue-400 font-bold" : "text-slate-400"}>
                      {result.scoreA}%
                    </span>
                    <span className="text-slate-600">vs</span>
                    <span className={result.winner === 'B' ? "text-emerald-400 font-bold" : "text-slate-400"}>
                      {result.scoreB}%
                    </span>
                    {result.winner !== 'tie' && (
                      <Trophy className={cn("w-4 h-4", result.winner === 'A' ? "text-blue-400" : "text-emerald-400")} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Final Winner */}
            {winner && (
              <div className={cn(
                "mt-4 p-4 rounded-lg text-center",
                winner === 'A' ? "bg-blue-500/20 border border-blue-500/50" :
                winner === 'B' ? "bg-emerald-500/20 border border-emerald-500/50" :
                "bg-slate-700/50 border border-slate-600"
              )}>
                <div className="flex items-center justify-center gap-3">
                  <Trophy className={cn(
                    "w-8 h-8",
                    winner === 'A' ? "text-blue-400" :
                    winner === 'B' ? "text-emerald-400" :
                    "text-slate-400"
                  )} />
                  <div>
                    <div className="text-lg font-bold text-white">
                      {winner === 'tie' ? "It's a Tie!" : `Version ${winner === 'A' ? versionA.version : versionB.version} Wins!`}
                    </div>
                    <div className="text-sm text-slate-400">
                      Final Score: {progress.scoreA}% vs {progress.scoreB}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default LiveABTest
