import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Play,
  CheckCircle,
  XCircle,
  RefreshCw,
  User,
  Bot,
  Zap,
  Clock,
  Activity,
  Pause,
  SkipForward,
  SplitSquareHorizontal,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'

const BACKEND_URL = import.meta.env.VITE_API_URL || ''

/**
 * Dual Live Simulation Component
 * Shows 2 scenarios running in parallel with live streaming conversations
 */
export function DualLiveSimulation({ scenarios, onComplete }) {
  const [running, setRunning] = useState(false)
  const [slot1, setSlot1] = useState(null) // { scenario, conversation, status, score }
  const [slot2, setSlot2] = useState(null)
  const [queue, setQueue] = useState([])
  const [completed, setCompleted] = useState([])
  const [paused, setPaused] = useState(false)

  const abortRef = useRef(null)

  const startParallelRun = async (scenarioList = scenarios) => {
    if (running) return

    setRunning(true)
    setPaused(false)
    setCompleted([])
    setSlot1(null)
    setSlot2(null)

    // Create queue of scenario IDs
    const scenarioQueue = [...scenarioList]
    setQueue(scenarioQueue)

    // Start first 2 scenarios
    const first = scenarioQueue.shift()
    const second = scenarioQueue.shift()

    if (first) runScenarioInSlot(first, 1, scenarioQueue)
    if (second) runScenarioInSlot(second, 2, scenarioQueue)
  }

  const runScenarioInSlot = async (scenario, slotNum, remainingQueue) => {
    const setSlot = slotNum === 1 ? setSlot1 : setSlot2

    // Initialize slot state
    setSlot({
      scenario,
      conversation: [{
        type: 'system',
        content: `Starting: ${scenario.name}`,
        timestamp: Date.now(),
      }],
      status: 'running',
      score: null,
      toolsCalled: [],
      criteriaResults: [],
      streamingText: '',
      agentThinking: false,
    })

    try {
      const response = await fetch(`${BACKEND_URL}/api/simulation/run-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: scenario.id }),
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
              handleEventForSlot(event, slotNum, scenario)
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error(`Slot ${slotNum} error:`, err)
      setSlot(prev => ({
        ...prev,
        status: 'error',
        conversation: [...prev.conversation, {
          type: 'error',
          content: err.message,
          timestamp: Date.now(),
        }],
      }))
    }

    // Scenario complete - get next from queue
    setQueue(prevQueue => {
      const nextScenario = prevQueue[0]
      const newQueue = prevQueue.slice(1)

      if (nextScenario && !paused) {
        // Start next scenario in this slot
        setTimeout(() => runScenarioInSlot(nextScenario, slotNum, newQueue), 500)
      } else if (!nextScenario) {
        // No more scenarios - mark as done
        setSlot(prev => prev ? { ...prev, status: 'complete' } : null)

        // Check if both slots are complete
        setTimeout(() => {
          if (slotNum === 1) {
            setSlot2(prev => {
              if (prev?.status === 'complete' || !prev) {
                setRunning(false)
                onComplete?.(completed)
              }
              return prev
            })
          } else {
            setSlot1(prev => {
              if (prev?.status === 'complete' || !prev) {
                setRunning(false)
                onComplete?.(completed)
              }
              return prev
            })
          }
        }, 100)
      }

      return newQueue
    })
  }

  const handleEventForSlot = (event, slotNum, scenario) => {
    const setSlot = slotNum === 1 ? setSlot1 : setSlot2

    switch (event.type) {
      case 'turn_start':
        setSlot(prev => ({
          ...prev,
          agentThinking: false,
          streamingText: '',
          conversation: [...prev.conversation, {
            type: 'user',
            content: event.userMessage,
            turnNumber: event.turnNumber,
            timestamp: Date.now(),
          }],
        }))
        break

      case 'agent_thinking':
        setSlot(prev => ({
          ...prev,
          agentThinking: true,
          streamingText: '',
        }))
        break

      case 'agent_response':
        if (event.agentChunk) {
          setSlot(prev => ({
            ...prev,
            agentThinking: false,
            streamingText: prev.streamingText + event.agentChunk,
          }))
        }
        break

      case 'turn_complete':
        setSlot(prev => ({
          ...prev,
          agentThinking: false,
          streamingText: '',
          toolsCalled: [...prev.toolsCalled, ...(event.toolsCalled || [])],
          conversation: [...prev.conversation, {
            type: 'agent',
            content: event.agentResponse,
            turnNumber: event.turnNumber,
            toolsCalled: event.toolsCalled,
            latencyMs: event.latencyMs,
            timestamp: Date.now(),
          }],
        }))
        break

      case 'scoring':
        // Build criteria results
        const criteria = []
        if (scenario.passCriteria) {
          (scenario.passCriteria.mustContain || []).forEach(term => {
            const failed = event.failureReasons?.some(r => r.toLowerCase().includes(term.toLowerCase()))
            criteria.push({ type: 'mustContain', term, passed: !failed })
          })
          ;(scenario.passCriteria.mustNotContain || []).forEach(term => {
            const failed = event.failureReasons?.some(r => r.toLowerCase().includes(term.toLowerCase()))
            criteria.push({ type: 'mustNotContain', term, passed: !failed })
          })
          ;(scenario.passCriteria.toolsMustCall || []).forEach(tool => {
            const failed = event.failureReasons?.some(r => r.toLowerCase().includes(tool.toLowerCase()))
            criteria.push({ type: 'toolsMustCall', term: tool, passed: !failed })
          })
        }

        setSlot(prev => ({
          ...prev,
          score: event.score,
          passed: event.passed,
          criteriaResults: criteria,
          conversation: [...prev.conversation, {
            type: 'scoring',
            score: event.score,
            passed: event.passed,
            failureReasons: event.failureReasons,
            timestamp: Date.now(),
          }],
        }))
        break

      case 'scenario_complete':
        setCompleted(prev => [...prev, {
          scenarioId: event.scenarioId,
          passed: event.passed,
          score: event.score,
        }])
        setSlot(prev => ({
          ...prev,
          status: 'done',
        }))
        break
    }
  }

  const passedCount = completed.filter(c => c.passed).length
  const totalDone = completed.length
  const passRate = totalDone > 0 ? (passedCount / totalDone * 100) : 0

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <SplitSquareHorizontal className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-slate-200">Parallel Live Simulation</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className={cn("w-4 h-4", running ? "text-emerald-400 animate-pulse" : "text-slate-500")} />
            <span className="text-sm text-slate-400">
              {running ? `Running (${queue.length} queued)` : 'Ready'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Live stats */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-emerald-400 font-semibold">{passedCount} passed</span>
            <span className="text-rose-400 font-semibold">{totalDone - passedCount} failed</span>
            <span className={cn(
              "font-semibold",
              passRate >= 80 ? "text-emerald-400" : "text-amber-400"
            )}>
              {passRate.toFixed(0)}%
            </span>
          </div>

          <Button
            onClick={() => startParallelRun()}
            disabled={running}
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Running {totalDone}/{scenarios.length}
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run All Parallel
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Dual conversation panels */}
      <div className="flex-1 flex">
        <LiveSlot slot={slot1} slotNum={1} />
        <div className="w-px bg-slate-700" />
        <LiveSlot slot={slot2} slotNum={2} />
      </div>
    </div>
  )
}

function LiveSlot({ slot, slotNum }) {
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [slot?.conversation, slot?.streamingText])

  if (!slot) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900/30">
        <div className="text-center text-slate-500">
          <Bot className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Slot {slotNum} - Waiting...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-900/30">
      {/* Slot header */}
      <div className="p-3 border-b border-slate-800 bg-slate-800/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={
              slot.status === 'running' ? 'warning' :
              slot.passed ? 'success' :
              slot.status === 'done' ? 'error' : 'secondary'
            }>
              {slot.status === 'running' ? 'LIVE' :
               slot.passed ? 'PASSED' :
               slot.status === 'done' ? 'FAILED' : 'WAITING'}
            </Badge>
            <span className="font-medium text-slate-200 text-sm truncate">
              {slot.scenario?.name}
            </span>
          </div>
          {slot.score !== null && (
            <span className={cn(
              "text-sm font-semibold",
              slot.passed ? "text-emerald-400" : "text-rose-400"
            )}>
              {(slot.score * 100).toFixed(0)}%
            </span>
          )}
        </div>

        {/* Mini criteria tracker */}
        <div className="flex flex-wrap gap-1 mt-2">
          {slot.criteriaResults.map((c, i) => (
            <div
              key={i}
              className={cn(
                "text-xs px-1.5 py-0.5 rounded flex items-center gap-1",
                c.passed ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
              )}
            >
              {c.passed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {c.term}
            </div>
          ))}
          {slot.toolsCalled.length > 0 && (
            <div className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {[...new Set(slot.toolsCalled)].join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {slot.conversation.map((msg, i) => (
          <MiniMessage key={i} message={msg} />
        ))}

        {/* Streaming text */}
        {slot.streamingText && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="flex-1 bg-slate-800 rounded-lg rounded-tl-none p-2 text-sm text-slate-200">
              {slot.streamingText}
              <span className="inline-block w-1.5 h-3 bg-indigo-400 animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {slot.agentThinking && !slot.streamingText && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="bg-slate-800 rounded-lg rounded-tl-none p-2 flex items-center gap-2">
              <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />
              <span className="text-xs text-slate-400">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>
    </div>
  )
}

function MiniMessage({ message }) {
  if (message.type === 'system') {
    return (
      <div className="text-center">
        <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  if (message.type === 'scoring') {
    return (
      <div className="flex justify-center">
        <div className={cn(
          "text-xs px-3 py-1.5 rounded-full flex items-center gap-2",
          message.passed ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
        )}>
          {message.passed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {(message.score * 100).toFixed(0)}% - {message.passed ? 'PASSED' : 'FAILED'}
        </div>
      </div>
    )
  }

  if (message.type === 'error') {
    return (
      <div className="text-center">
        <span className="text-xs text-rose-400 bg-rose-500/20 px-2 py-1 rounded">
          Error: {message.content}
        </span>
      </div>
    )
  }

  if (message.type === 'user') {
    return (
      <div className="flex gap-2 justify-end">
        <div className="max-w-[85%] bg-indigo-600 rounded-lg rounded-tr-none p-2">
          <p className="text-xs text-white line-clamp-4">{message.content}</p>
        </div>
        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
          <User className="w-3 h-3 text-white" />
        </div>
      </div>
    )
  }

  if (message.type === 'agent') {
    return (
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
          <Bot className="w-3 h-3 text-white" />
        </div>
        <div className="max-w-[85%] bg-slate-800 rounded-lg rounded-tl-none p-2">
          <p className="text-xs text-slate-200 line-clamp-6">{message.content}</p>
          {message.toolsCalled?.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-xs text-amber-300">{message.toolsCalled.join(', ')}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}

export default DualLiveSimulation
