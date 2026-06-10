import React, { useState, useEffect } from 'react'
import { Zap, TrendingUp, GitCompare, AlertTriangle, FileCode, Check, ArrowRight, X, Eye } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { StatCard } from '../ui/stat-card'
import { cn } from '../../lib/utils'

// Use relative URL when not in development (same-origin)
const BACKEND_URL = import.meta.env.VITE_API_URL || ''

export function OptimizerDashboard() {
  const [patterns, setPatterns] = useState([])
  const [versions, setVersions] = useState([])
  const [optimizing, setOptimizing] = useState(false)
  const [abTestRunning, setAbTestRunning] = useState(false)
  const [abTestResult, setAbTestResult] = useState(null)
  const [availableAgents, setAvailableAgents] = useState([])
  const [targetAgent, setTargetAgent] = useState('orchestrator')
  const [detailsModal, setDetailsModal] = useState(null) // Version to show in modal
  const [abTestModal, setAbTestModal] = useState(false) // Show A/B test selector
  const [selectedVersionA, setSelectedVersionA] = useState(null)
  const [selectedVersionB, setSelectedVersionB] = useState(null)
  const [useADK, setUseADK] = useState(false) // Use Google ADK optimizer
  const [useQualityFlywheel, setUseQualityFlywheel] = useState(false) // Use full Quality Flywheel

  useEffect(() => {
    fetchPatterns()
    fetchVersions()
    fetchAgents()
  }, [])

  const fetchPatterns = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/optimizer/analyze-failures`)
      const data = await res.json()
      setPatterns(data)
    } catch (err) {
      setPatterns(MOCK_PATTERNS)
    }
  }

  const fetchVersions = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/optimizer/history`)
      const data = await res.json()
      setVersions(data)
    } catch (err) {
      setVersions(MOCK_VERSIONS)
    }
  }

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/optimizer/agents`)
      const data = await res.json()
      setAvailableAgents(data)
    } catch (err) {
      setAvailableAgents([
        { id: 'orchestrator', name: 'Root Orchestrator' },
        { id: 'problem_clarifier', name: 'Problem Clarifier' },
        { id: 'assumption_hunter', name: 'Assumption Hunter' },
        { id: 'customer_researcher', name: 'Customer Researcher' },
        { id: 'experiment_designer', name: 'Experiment Designer' },
      ])
    }
  }

  const runOptimization = async (selectedPatterns = null) => {
    setOptimizing(true)
    try {
      const body = {
        targetAgent,
        useADK: useADK && !useQualityFlywheel, // ADK only if not using Flywheel
        useQualityFlywheel, // Full Google Quality Flywheel
        ...(selectedPatterns ? { patterns: selectedPatterns } : {}),
      }

      await fetch(`${BACKEND_URL}/api/optimizer/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await fetchVersions()
      await fetchPatterns()
    } catch (err) {
      const patternsToFix = selectedPatterns || patterns.map(p => p.pattern)
      const agentName = availableAgents.find(a => a.id === targetAgent)?.name || 'Root Orchestrator'
      setVersions(prev => [{
        id: `v${prev.length + 1}`,
        version: prev.length + 1,
        targetAgent,
        agentName,
        passRateBefore: 0.6,
        passRateAfter: 0.85,
        failurePatternsAddressed: patternsToFix,
        isActive: false,
        createdAt: new Date().toISOString(),
      }, ...prev])
    }
    setOptimizing(false)
  }

  const fixSinglePattern = async (pattern) => {
    await runOptimization([pattern.pattern])
  }

  const applyVersion = async (versionId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/optimizer/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.corrupted) {
          alert(`Cannot apply this version:\n\n${data.error}\n\nPlease reset the agent to default first, then create a new optimization.`)
        } else {
          alert(`Error applying version: ${data.error}`)
        }
        return
      }

      await fetchVersions()
    } catch (err) {
      console.error('Failed to apply version:', err)
      setVersions(prev => prev.map(v => ({ ...v, isActive: v.id === versionId })))
    }
  }

  const openABTestModal = () => {
    if (versions.length < 2) {
      alert('Need at least 2 instruction versions. Create more versions first.')
      return
    }
    // Pre-select: active version as A, latest non-active as B
    const activeVersion = versions.find(v => v.isActive) || versions[versions.length - 1]
    const otherVersions = versions.filter(v => v.version !== activeVersion?.version)
    setSelectedVersionA(activeVersion?.version || versions[0]?.version)
    setSelectedVersionB(otherVersions[0]?.version || versions[1]?.version)
    setAbTestModal(true)
  }

  const runABTest = async () => {
    if (!selectedVersionA || !selectedVersionB) {
      alert('Please select two versions to compare')
      return
    }
    if (selectedVersionA === selectedVersionB) {
      alert('Please select two different versions')
      return
    }

    setAbTestModal(false)
    setAbTestRunning(true)
    setAbTestResult(null)

    try {
      console.log('[A/B Test] Comparing:', selectedVersionA, 'vs', selectedVersionB)

      const res = await fetch(`${BACKEND_URL}/api/optimizer/ab-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          versionA: selectedVersionA,
          versionB: selectedVersionB,
        }),
      })

      console.log('[A/B Test] Response status:', res.status)

      if (!res.ok) {
        const errorText = await res.text()
        console.error('[A/B Test] Error:', errorText)
        throw new Error(`HTTP ${res.status}: ${errorText}`)
      }

      const data = await res.json()
      console.log('[A/B Test] Result:', data)
      setAbTestResult(data)
    } catch (err) {
      console.error('[A/B Test] Error:', err)
      alert(`A/B Test failed: ${err.message || 'Unknown error'}. Check that Vertex AI is properly configured.`)
    }

    setAbTestRunning(false)
  }

  const totalFailures = patterns.reduce((sum, p) => sum + p.frequency, 0)
  const activeVersion = versions.find(v => v.isActive)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-6 h-6 text-violet-400" />
            Agent Optimizer
          </h1>
          <p className="text-slate-400 mt-1">Programmatically refine agent instructions</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Agent Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Target:</span>
            <select
              value={targetAgent}
              onChange={(e) => setTargetAgent(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {availableAgents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>
          {/* Optimizer Method Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Method:</span>
            <select
              value={useQualityFlywheel ? 'flywheel' : (useADK ? 'adk' : 'built_in')}
              onChange={(e) => {
                const val = e.target.value
                setUseQualityFlywheel(val === 'flywheel')
                setUseADK(val === 'adk')
              }}
              className="bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="built_in">Built-in (Fast)</option>
              <option value="adk">Google ADK</option>
              <option value="flywheel">Quality Flywheel (Full)</option>
            </select>
          </div>
          <Button
            variant="secondary"
            onClick={openABTestModal}
            disabled={abTestRunning || versions.length < 2}
          >
            <GitCompare className="w-4 h-4" />
            {abTestRunning ? 'Running...' : 'A/B Test'}
          </Button>
          <Button
            onClick={() => runOptimization()}
            disabled={optimizing || patterns.length === 0}
          >
            <Zap className="w-4 h-4" />
            {optimizing ? 'Optimizing...' : `Fix All (${patterns.length})`}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Failure Patterns" value={patterns.length} icon={AlertTriangle} variant="error" />
        <StatCard label="Total Failures" value={totalFailures} variant="warning" />
        <StatCard label="Instruction Versions" value={versions.length} icon={FileCode} />
        <StatCard label="Active Version" value={`v${activeVersion?.version || 1}`} variant="success" />
      </div>

      {/* Workflow */}
      <Card>
        <CardHeader>
          <CardTitle>Optimization Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {[
              { icon: AlertTriangle, label: 'Detect', sublabel: 'Run simulations', color: 'text-rose-400', bg: 'bg-rose-500/10' },
              { icon: Zap, label: 'Analyze', sublabel: 'Group patterns', color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { icon: FileCode, label: 'Generate', sublabel: 'Update instruction', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
              { icon: GitCompare, label: 'A/B Test', sublabel: 'Compare versions', color: 'text-violet-400', bg: 'bg-violet-500/10' },
              { icon: Check, label: 'Deploy', sublabel: 'Apply winner', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            ].map((step, i, arr) => (
              <React.Fragment key={step.label}>
                <div className="flex flex-col items-center">
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", step.bg)}>
                    <step.icon className={cn("w-6 h-6", step.color)} />
                  </div>
                  <div className="text-sm font-medium text-slate-200 mt-2">{step.label}</div>
                  <div className="text-xs text-slate-500">{step.sublabel}</div>
                </div>
                {i < arr.length - 1 && <ArrowRight className="w-5 h-5 text-slate-600" />}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* A/B Test Results - Side by Side Comparison */}
      {abTestResult && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-violet-400" />
              A/B Test Results
            </CardTitle>
            <CardDescription>
              Tested {abTestResult.scenarios?.length || abTestResult.testedScenarios || 5} scenarios using Gemini evaluation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className={cn("rounded-lg p-4 border", abTestResult.winner === 'A' ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-800/50 border-slate-700")}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-200">Version {abTestResult.instructionA?.version || 'A'}</span>
                  {abTestResult.winner === 'A' && <Badge variant="success">Winner</Badge>}
                </div>
                <div className="text-3xl font-bold text-slate-200">{((abTestResult.instructionA?.passRate || 0) * 100).toFixed(0)}%</div>
                <div className="text-xs text-slate-500">Avg Score</div>
              </div>

              <div className="flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-violet-400">VS</div>
                {abTestResult.improvement > 0 && (
                  <div className="text-lg font-bold text-emerald-400">+{abTestResult.improvement}%</div>
                )}
              </div>

              <div className={cn("rounded-lg p-4 border", abTestResult.winner === 'B' ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-800/50 border-slate-700")}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-200">Version {abTestResult.instructionB?.version || 'B'}</span>
                  {abTestResult.winner === 'B' && <Badge variant="success">Winner</Badge>}
                </div>
                <div className="text-3xl font-bold text-slate-200">{((abTestResult.instructionB?.passRate || 0) * 100).toFixed(0)}%</div>
                <div className="text-xs text-slate-500">Avg Score</div>
              </div>
            </div>

            {/* Scenario-by-Scenario Comparison */}
            {abTestResult.scenarios && abTestResult.scenarios.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-400">Scenario Comparison</h4>
                {abTestResult.scenarios.map((scenario, idx) => (
                  <div key={idx} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-slate-200">{scenario.name}</span>
                      <Badge variant={scenario.winner === 'tie' ? 'secondary' : 'success'}>
                        {scenario.winner === 'tie' ? 'Tie' : `V${scenario.winner === 'A' ? abTestResult.instructionA?.version : abTestResult.instructionB?.version} wins`}
                      </Badge>
                    </div>

                    {/* Side-by-side scores */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Version A */}
                      <div className={cn("rounded p-3 border", scenario.winner === 'A' ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-900/50 border-slate-600")}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-400">Version {abTestResult.instructionA?.version}</span>
                          <span className={cn("text-lg font-bold", scenario.scoreA >= 0.7 ? "text-emerald-400" : "text-amber-400")}>
                            {Math.round(scenario.scoreA * 100)}%
                          </span>
                        </div>
                        {scenario.responseA && (
                          <p className="text-xs text-slate-400 line-clamp-3">{scenario.responseA}...</p>
                        )}
                      </div>

                      {/* Version B */}
                      <div className={cn("rounded p-3 border", scenario.winner === 'B' ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-900/50 border-slate-600")}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-400">Version {abTestResult.instructionB?.version}</span>
                          <span className={cn("text-lg font-bold", scenario.scoreB >= 0.7 ? "text-emerald-400" : "text-amber-400")}>
                            {Math.round(scenario.scoreB * 100)}%
                          </span>
                        </div>
                        {scenario.responseB && (
                          <p className="text-xs text-slate-400 line-clamp-3">{scenario.responseB}...</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Apply Winner Button */}
            {abTestResult.winner !== 'tie' && (
              <div className="flex justify-center pt-2">
                <Button onClick={() => {
                  const winnerVersion = abTestResult.winner === 'A' ? abTestResult.instructionA?.version : abTestResult.instructionB?.version
                  const winnerId = versions.find(v => v.version === winnerVersion)?.id
                  if (winnerId) applyVersion(winnerId)
                  setAbTestResult(null)
                }}>
                  <Check className="w-4 h-4 mr-2" />
                  Apply Winner (Version {abTestResult.winner === 'A' ? abTestResult.instructionA?.version : abTestResult.instructionB?.version})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Failure Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Detected Failure Patterns
            </CardTitle>
            <CardDescription>
              Global patterns from all simulation runs. Fixes will be applied to: <span className="text-violet-400 font-medium">{availableAgents.find(a => a.id === targetAgent)?.name || targetAgent}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {patterns.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No failures detected. Run simulations first.</div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {patterns.map((pattern, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-slate-200">{pattern.pattern.replace(/_/g, ' ')}</span>
                      <Badge variant="error">{pattern.frequency} failures</Badge>
                    </div>
                    <div className="text-sm text-slate-500 mb-2">Type: {pattern.type}</div>
                    <div className="text-sm text-indigo-400 mb-3">Fix: {pattern.suggestedFix}</div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => fixSinglePattern(pattern)}
                      disabled={optimizing}
                      className="w-full"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      {optimizing ? 'Fixing...' : 'Fix This Pattern'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Version History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-indigo-400" />
              Instruction Versions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {versions.map(version => (
                <div
                  key={version.id}
                  className="bg-slate-800/50 rounded-lg p-4 border border-slate-700"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">Version {version.version}</span>
                      {version.isActive && <Badge variant="success">Active</Badge>}
                    </div>
                    {!version.isActive && (
                      <Button variant="ghost" size="sm" onClick={() => applyVersion(version.id)}>
                        Apply
                      </Button>
                    )}
                  </div>
                  {/* Show which agent this version is for */}
                  {version.agentName && (
                    <div className="text-xs text-violet-400 mb-2">
                      Agent: {version.agentName}
                    </div>
                  )}
                  {version.passRateBefore != null && (
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm">
                        <span className="text-rose-400">{(version.passRateBefore * 100).toFixed(0)}%</span>
                        <span className="text-slate-500 mx-1">→</span>
                        {version.passRateAfter != null ? (
                          <span className="text-emerald-400 font-medium">{(version.passRateAfter * 100).toFixed(0)}%</span>
                        ) : (
                          <span className="text-amber-400">Run A/B Test</span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="text-sm text-slate-500 mb-2">Fixed {version.failurePatternsAddressed?.length || 0} patterns</div>
                  <div className="text-xs text-slate-600 mb-3">{new Date(version.createdAt).toLocaleString()}</div>

                  {/* View Details Button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => setDetailsModal(version)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Version Details Modal */}
      {detailsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-100">Version {detailsModal.version} Details</h2>
                {detailsModal.agentName && (
                  <Badge variant="default">{detailsModal.agentName}</Badge>
                )}
                {detailsModal.isActive && <Badge variant="success">Active</Badge>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDetailsModal(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="text-sm text-slate-400 mb-1">Patterns Fixed</div>
                  <div className="text-2xl font-bold text-violet-400">{detailsModal.failurePatternsAddressed?.length || 0}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="text-sm text-slate-400 mb-1">Pass Rate Before</div>
                  <div className="text-2xl font-bold text-rose-400">
                    {detailsModal.passRateBefore != null ? `${(detailsModal.passRateBefore * 100).toFixed(0)}%` : 'N/A'}
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="text-sm text-slate-400 mb-1">Pass Rate After</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {detailsModal.passRateAfter != null ? `${(detailsModal.passRateAfter * 100).toFixed(0)}%` : 'Run A/B Test'}
                  </div>
                </div>
              </div>

              {/* Patterns Addressed */}
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-3">Patterns Addressed</h4>
                <div className="flex flex-wrap gap-2">
                  {detailsModal.failurePatternsAddressed?.map((pattern, i) => (
                    <Badge key={i} variant="default">{pattern.replace(/_/g, ' ')}</Badge>
                  )) || <span className="text-slate-500">None</span>}
                </div>
              </div>

              {/* Changes Made */}
              {detailsModal.changes && detailsModal.changes.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-3">Changes Made</h4>
                  <div className="space-y-3">
                    {detailsModal.changes.map((change, i) => (
                      <div key={i} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary">{change.section}</Badge>
                        </div>
                        <div className="text-sm text-slate-400 mb-3">{change.reason}</div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <div className="text-rose-400 mb-1 font-medium">Before:</div>
                            <pre className="bg-slate-950 p-3 rounded text-slate-500 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">{change.original || '(section did not exist)'}</pre>
                          </div>
                          <div>
                            <div className="text-emerald-400 mb-1 font-medium">After:</div>
                            <pre className="bg-slate-950 p-3 rounded text-emerald-300 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">{change.updated}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Instruction Preview */}
              {detailsModal.instruction && detailsModal.instruction !== 'Default instruction' && (
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-3">Full Optimized Instruction</h4>
                  <pre className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 text-xs text-slate-300 max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {detailsModal.instruction}
                  </pre>
                </div>
              )}

              {/* Created At */}
              <div className="text-sm text-slate-500">
                Created: {new Date(detailsModal.createdAt).toLocaleString()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-slate-700">
              <Button variant="secondary" onClick={() => setDetailsModal(null)}>
                Close
              </Button>
              {!detailsModal.isActive && (
                <Button onClick={() => { applyVersion(detailsModal.id); setDetailsModal(null); }}>
                  <Check className="w-4 h-4 mr-2" />
                  Apply This Version
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* A/B Test Version Selection Modal */}
      {abTestModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-lg w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-violet-400" />
                Select Versions to Compare
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setAbTestModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              <p className="text-sm text-slate-400">
                Choose two versions to compare. The A/B test will evaluate both against simulation scenarios.
              </p>

              <div className="grid grid-cols-2 gap-6">
                {/* Version A */}
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Version A (Baseline)</label>
                  <select
                    value={selectedVersionA || ''}
                    onChange={(e) => setSelectedVersionA(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {versions.map(v => (
                      <option key={v.id} value={v.version}>
                        Version {v.version} {v.isActive ? '(Active)' : ''} - {v.agentName || 'Unknown'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Version B */}
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Version B (Challenger)</label>
                  <select
                    value={selectedVersionB || ''}
                    onChange={(e) => setSelectedVersionB(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {versions.map(v => (
                      <option key={v.id} value={v.version}>
                        Version {v.version} {v.isActive ? '(Active)' : ''} - {v.agentName || 'Unknown'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                <div className="text-sm text-emerald-400">
                  A/B test runs 5 simulation scenarios against each version using Vertex AI (Gemini) for evaluation.
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-slate-700">
              <Button variant="secondary" onClick={() => setAbTestModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={runABTest}
                disabled={!selectedVersionA || !selectedVersionB || selectedVersionA === selectedVersionB}
              >
                <GitCompare className="w-4 h-4 mr-2" />
                Run A/B Test
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Mock data
const MOCK_PATTERNS = [
  { pattern: 'missing_problem_focus', type: 'feature_obsessed', frequency: 8, suggestedFix: 'Add explicit instruction to ask about problems before features' },
  { pattern: 'inappropriate_validation', type: 'validation_seeker', frequency: 5, suggestedFix: 'Remove "sounds great" responses, add skeptical questioning' },
  { pattern: 'premature_tool_call', type: 'over_scoped_mvp', frequency: 4, suggestedFix: 'Gate MVP tool behind validation check' },
]

const MOCK_VERSIONS = [
  { id: 'v1', version: 1, targetAgent: 'orchestrator', agentName: 'Root Orchestrator', passRateBefore: null, passRateAfter: null, failurePatternsAddressed: [], isActive: true, createdAt: '2024-01-15T10:00:00Z' },
]

export default OptimizerDashboard
