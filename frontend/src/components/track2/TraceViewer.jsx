import React, { useState, useEffect } from 'react'
import { Activity, Clock, CheckCircle, XCircle, ExternalLink, ChevronRight, Search, Eye } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { StatCard } from '../ui/stat-card'
import { cn } from '../../lib/utils'
import { getAuthHeaders } from '../../lib/api'

import { API_URL as BACKEND_URL } from '../../config'

export function TraceViewer({ sessionId }) {
  const [traces, setTraces] = useState([])
  const [selectedTrace, setSelectedTrace] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [filter, setFilter] = useState('')
  const [fetchError, setFetchError] = useState(null)
  const [fetchStatus, setFetchStatus] = useState('loading')

  useEffect(() => {
    fetchTraces()
    fetchAnalytics()
  }, [sessionId])

  const fetchTraces = async () => {
    try {
      setFetchStatus('loading')
      setFetchError(null)
      console.log('[TraceViewer] Fetching traces...')
      // Always fetch all traces - filtering by session can be done in UI if needed
      const url = `${BACKEND_URL}/api/observability/traces/all?_t=${Date.now()}`
      console.log('[TraceViewer] URL:', url)
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          ...getAuthHeaders()
        }
      })
      console.log('[TraceViewer] Response status:', res.status)
      const text = await res.text()
      console.log('[TraceViewer] Raw response:', text.substring(0, 500))

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text}`)
      }

      let data
      try {
        data = JSON.parse(text)
      } catch (parseErr) {
        throw new Error(`JSON parse failed: ${text.substring(0, 200)}`)
      }

      console.log('[TraceViewer] Got traces:', data?.length || 0, data)
      if (Array.isArray(data)) {
        setTraces(data)
        setFetchStatus(`success: ${data.length} traces | response: ${text.substring(0, 100)}`)
      } else {
        console.error('[TraceViewer] Data is not an array:', data)
        setTraces([])
        setFetchError(`Not array: ${JSON.stringify(data).substring(0, 100)}`)
        setFetchStatus('error')
      }
    } catch (err) {
      console.error('[TraceViewer] Fetch error:', err)
      setTraces([])
      setFetchError(err.message)
      setFetchStatus('error')
    }
  }

  const fetchAnalytics = async () => {
    try {
      console.log('[TraceViewer] Fetching analytics...')
      const res = await fetch(`${BACKEND_URL}/api/observability/analytics`, {
        credentials: 'same-origin',
        headers: getAuthHeaders()
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      console.log('[TraceViewer] Got analytics:', data)
      setAnalytics(data)
    } catch (err) {
      console.error('[TraceViewer] Analytics error:', err)
      setAnalytics(MOCK_ANALYTICS)
    }
  }

  const filteredTraces = traces.filter(trace => {
    if (filter === '') return true
    const searchTerm = filter.toLowerCase()
    return (
      (trace.userMessage || '').toLowerCase().includes(searchTerm) ||
      (trace.scenarioName || '').toLowerCase().includes(searchTerm) ||
      (trace.scenarioId || '').toLowerCase().includes(searchTerm) ||
      (trace.traceId || '').toLowerCase().includes(searchTerm) ||
      (trace.failureReasons || []).some(r => r.toLowerCase().includes(searchTerm)) ||
      (trace.success ? 'passed' : 'failed').includes(searchTerm)
    )
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Eye className="w-6 h-6 text-cyan-400" />
          Agent Observability
        </h1>
        <p className="text-slate-400 mt-1">Trace agent reasoning and tool selection</p>
      </div>

      {/* Stats Grid */}
      {analytics && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Total Traces"
            value={analytics.totalTraces}
            icon={Activity}
          />
          <StatCard
            label="Success Rate"
            value={`${(analytics.successRate * 100).toFixed(1)}%`}
            variant={analytics.successRate >= 0.9 ? 'success' : 'warning'}
          />
          <StatCard
            label="Avg Latency"
            value={`${analytics.avgLatency?.toFixed(0) || 0}ms`}
            icon={Clock}
          />
          <StatCard
            label="Intent Accuracy"
            value={`${(analytics.intentAccuracy * 100).toFixed(1)}%`}
            variant={analytics.intentAccuracy >= 0.9 ? 'success' : 'warning'}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Trace List */}
        <Card className="col-span-1">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Filter traces..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-[600px] overflow-y-auto">
            {/* Debug info */}
            {fetchError && (
              <div className="p-4 bg-rose-500/20 border-b border-rose-500/30">
                <p className="text-rose-400 text-sm font-medium">Fetch Error:</p>
                <p className="text-rose-300 text-xs">{fetchError}</p>
              </div>
            )}
            {fetchStatus && (
              <div className="p-2 bg-slate-800 border-b border-slate-700 text-xs text-slate-400">
                Status: {fetchStatus} | Raw traces: {traces.length} | Filtered: {filteredTraces.length}
              </div>
            )}
            {filteredTraces.length === 0 && !fetchError && (
              <div className="p-8 text-center text-slate-500">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No traces yet</p>
                <p className="text-xs mt-1">Run a simulation to see traces</p>
              </div>
            )}
            {filteredTraces.map((trace, i) => (
              <div
                key={trace.traceId}
                onClick={() => setSelectedTrace(trace)}
                className={cn(
                  "p-4 border-b border-slate-800 cursor-pointer transition-colors",
                  selectedTrace?.traceId === trace.traceId
                    ? "bg-indigo-500/10 border-l-2 border-l-indigo-500"
                    : "hover:bg-slate-800/50"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-slate-200 text-sm">
                    {trace.scenarioName || `Trace ${i + 1}`}
                  </span>
                  <div className="flex items-center gap-2">
                    {trace.score !== undefined && (
                      <span className={cn(
                        "text-xs font-medium",
                        trace.score >= 0.7 ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {(trace.score * 100).toFixed(0)}%
                      </span>
                    )}
                    <span className="text-xs text-slate-500">{trace.latencyMs}ms</span>
                  </div>
                </div>
                <p className="text-sm text-slate-400 line-clamp-2 mb-2">
                  {trace.userMessage}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={trace.success ? 'success' : 'error'} className="text-xs">
                    {trace.success ? 'PASSED' : 'FAILED'}
                  </Badge>
                  {trace.failureReasons && trace.failureReasons.length > 0 && (
                    <Badge variant="error" className="text-xs">
                      {trace.failureReasons.length} issue{trace.failureReasons.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {trace.evaluationType && (
                    <Badge variant="trace" className="text-xs">
                      {trace.evaluationType === 'vertex_ai' ? 'AI' : 'Rules'}
                    </Badge>
                  )}
                  {trace.source && (
                    <Badge variant="secondary" className="text-xs">
                      {trace.source}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Trace Detail */}
        <Card className="col-span-2">
          {selectedTrace ? (
            <>
              <CardHeader>
                <CardTitle>Trace Details</CardTitle>
                <CardDescription>ID: {selectedTrace.traceId}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Trace Info */}
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-4">Trace Info</h3>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {/* User Message */}
                    <div className="flex-shrink-0 p-3 bg-slate-900 rounded-lg border border-slate-700 min-w-[140px]">
                      <div className="text-xs text-slate-500 mb-1">User</div>
                      <div className="text-sm text-slate-300 line-clamp-2">
                        {(selectedTrace.userMessage || '').substring(0, 40)}...
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />

                    {/* Status */}
                    <div className={cn(
                      "flex-shrink-0 p-3 rounded-lg border min-w-[140px]",
                      selectedTrace.success
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-rose-500/10 border-rose-500/30"
                    )}>
                      <div className={cn(
                        "text-xs mb-1",
                        selectedTrace.success ? "text-emerald-400/70" : "text-rose-400/70"
                      )}>
                        Status
                      </div>
                      <div className={cn(
                        "text-sm font-medium",
                        selectedTrace.success ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {selectedTrace.success ? 'Success' : 'Failed'}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />

                    {/* Latency */}
                    <div className="flex-shrink-0 p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30 min-w-[140px]">
                      <div className="text-xs text-cyan-400/70 mb-1">Latency</div>
                      <div className="text-sm font-medium text-cyan-400">
                        {selectedTrace.latencyMs}ms
                      </div>
                    </div>

                    {/* Source */}
                    {selectedTrace.source && (
                      <>
                        <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                        <div className="flex-shrink-0 p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/30 min-w-[140px]">
                          <div className="text-xs text-indigo-400/70 mb-1">Source</div>
                          <div className="text-sm font-medium text-indigo-400">
                            {selectedTrace.source}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* User Message */}
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2">User Message</h4>
                  <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-300">
                    {selectedTrace.userMessage || 'N/A'}
                  </div>
                </div>

                {/* Session & Trace IDs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Session ID</div>
                    <div className="text-sm font-mono text-slate-300 truncate">
                      {selectedTrace.sessionId || 'N/A'}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Trace ID</div>
                    <div className="text-sm font-mono text-slate-300 truncate">
                      {selectedTrace.traceId || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Score, Status, Latency - Key Info */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Overall Score */}
                  <div className={cn(
                    "rounded-lg p-4 border",
                    selectedTrace.score !== undefined
                      ? selectedTrace.score >= 0.8
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-amber-500/10 border-amber-500/30"
                      : "bg-slate-800/50 border-slate-700"
                  )}>
                    <div className="text-xs text-slate-400 mb-1">Overall Score</div>
                    {selectedTrace.score !== undefined ? (
                      <>
                        <div className={cn(
                          "text-3xl font-bold",
                          selectedTrace.score >= 0.8 ? "text-emerald-400" : "text-amber-400"
                        )}>
                          {(selectedTrace.score * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {selectedTrace.evaluationType === 'vertex_ai' ? 'Vertex AI' : 'Rule-based'}
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-500 text-sm">N/A</div>
                    )}
                  </div>

                  {/* Status */}
                  <div className={cn(
                    "rounded-lg p-4 border",
                    selectedTrace.success
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-rose-500/10 border-rose-500/30"
                  )}>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                      {selectedTrace.success ? (
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3 h-3 text-rose-400" />
                      )}
                      Status
                    </div>
                    <div className={cn(
                      "text-2xl font-bold",
                      selectedTrace.success ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {selectedTrace.success ? 'PASSED' : 'FAILED'}
                    </div>
                  </div>

                  {/* Latency */}
                  <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-xs text-cyan-400/70 mb-1">
                      <Clock className="w-3 h-3" />
                      Latency
                    </div>
                    <div className="text-2xl font-bold text-cyan-400">{selectedTrace.latencyMs || 0}ms</div>
                  </div>
                </div>

                {/* 5 Metrics per Project Rules */}
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3">5 Metrics (Project Rules)</h4>
                  {selectedTrace.metrics ? (
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { key: 'taskSuccess', label: 'Task Success', target: 0.8 },
                        { key: 'toolUseQuality', label: 'Tool Use', target: 0.85 },
                        { key: 'instructionAdherence', label: 'Instructions', target: 0.8 },
                        { key: 'responseQuality', label: 'Response', target: 0.75 },
                        { key: 'safety', label: 'Safety', target: 0.95 },
                      ].map(({ key, label, target }) => {
                        const value = selectedTrace.metrics[key] || 0
                        const passed = value >= target
                        return (
                          <div
                            key={key}
                            className={cn(
                              "p-2 rounded-lg border text-center",
                              passed
                                ? "bg-emerald-500/10 border-emerald-500/30"
                                : "bg-rose-500/10 border-rose-500/30"
                            )}
                          >
                            <div className="text-xs text-slate-400 mb-1">{label}</div>
                            <div className={cn(
                              "text-lg font-bold",
                              passed ? "text-emerald-400" : "text-rose-400"
                            )}>
                              {(value * 100).toFixed(0)}%
                            </div>
                            <div className="text-xs text-slate-500">
                              Target: {(target * 100).toFixed(0)}%
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
                      <p className="text-slate-400 text-sm">Metrics not available for this trace</p>
                      <p className="text-slate-500 text-xs mt-1">Run a new simulation to see detailed metrics</p>
                    </div>
                  )}
                </div>

                {/* Pass/Fail Criteria Results */}
                {selectedTrace.criteriaResults && selectedTrace.criteriaResults.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Evaluation Criteria</h4>
                    <div className="space-y-2">
                      {selectedTrace.criteriaResults.map((result, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "p-3 rounded-lg border text-sm",
                            result.passed
                              ? "bg-emerald-500/10 border-emerald-500/30"
                              : "bg-rose-500/10 border-rose-500/30"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={cn(
                              "font-medium",
                              result.passed ? "text-emerald-400" : "text-rose-400"
                            )}>
                              {result.passed ? '✓' : '✗'} {result.criteria}
                            </span>
                            {result.score !== undefined && (
                              <span className="text-slate-400 text-xs">
                                Score: {(result.score * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400 text-xs">
                            {result.term && <span className="text-slate-300">"{result.term}"</span>}
                            {result.tool && <span className="text-slate-300">"{result.tool}"</span>}
                            {result.reason && <span> — {result.reason}</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Failure Reasons Summary */}
                {selectedTrace.failureReasons && selectedTrace.failureReasons.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-rose-400 mb-2">Failure Reasons</h4>
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                      <ul className="space-y-1">
                        {selectedTrace.failureReasons.map((reason, idx) => (
                          <li key={idx} className="text-sm text-rose-300 flex items-start gap-2">
                            <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Tools Called */}
                {selectedTrace.toolsCalled && selectedTrace.toolsCalled.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-2">Tools Called</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTrace.toolsCalled.map((tool, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agent Response Preview */}
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Agent Response</h4>
                  {selectedTrace.agentResponse ? (
                    <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-300 max-h-40 overflow-y-auto">
                      {selectedTrace.agentResponse}
                    </div>
                  ) : (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-500">
                      Response not recorded for this trace
                    </div>
                  )}
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[400px] text-slate-500">
              Select a trace to view details
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// Mock data
const MOCK_TRACES = [
  {
    traceId: 'trace_001',
    sessionId: 'session_1',
    userMessage: "I want to build an app that helps businesses manage their data better",
    detectedIntent: 'clarify_idea',
    expectedTool: 'clarify_idea',
    actualToolsCalled: ['clarify_idea'],
    response: "Let me help you clarify this idea...",
    latencyMs: 1234,
    success: true,
  },
  {
    traceId: 'trace_002',
    sessionId: 'session_1',
    userMessage: "I've already decided to build this, just help me with MVP",
    detectedIntent: 'mvp_scoping',
    expectedTool: null,
    actualToolsCalled: ['define_mvp_scope'],
    response: "Before scoping the MVP...",
    latencyMs: 1567,
    success: false,
    failureReason: 'Called MVP tool without validation first',
  },
]

const MOCK_ANALYTICS = {
  totalTraces: 45,
  successRate: 0.78,
  avgLatency: 1456,
  intentAccuracy: 0.82,
}

export default TraceViewer
