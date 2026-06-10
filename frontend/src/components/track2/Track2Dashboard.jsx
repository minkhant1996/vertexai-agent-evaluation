import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { SimulationDashboard } from './SimulationDashboard';
import { TraceViewer } from './TraceViewer';
import { OptimizerDashboard } from './OptimizerDashboard';
import { AgentArchitecture } from './AgentArchitecture';
import { TemplateEditor } from './TemplateEditor';
import {
  FlaskConical,
  Activity,
  Sparkles,
  Network,
  Trophy,
  CheckCircle,
  Edit3,
  ArrowRight,
  Play,
  Eye,
  Zap,
  HelpCircle,
} from 'lucide-react';
import { Button } from '../ui/button';

// Track 2 requirements checklist
const requirements = [
  { id: 'simulation', label: 'Agent Simulation', description: 'Automated test suite for agent behavior with synthetic edge cases', completed: true },
  { id: 'observability', label: 'Agent Observability', description: 'Cloud Trace integration for tracing agent decisions', completed: true },
  { id: 'optimizer', label: 'Agent Optimizer', description: 'Automatic instruction refinement based on simulation results', completed: true },
  { id: 'a2a', label: 'A2A Protocol', description: 'Multi-agent orchestration with specialist sub-agents', completed: true },
];

// Workflow Guide Component
function WorkflowGuide({ onNavigate }) {
  const steps = [
    {
      step: 1,
      title: 'Run Simulations',
      description: 'Test agent against 20+ edge cases',
      tab: 'simulation',
      icon: Play,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      step: 2,
      title: 'View Traces',
      description: 'Analyze agent reasoning & tool calls',
      tab: 'observability',
      icon: Eye,
      color: 'from-violet-500 to-purple-500',
    },
    {
      step: 3,
      title: 'Optimize Prompts',
      description: 'Fix failures with AI suggestions',
      tab: 'optimizer',
      icon: Zap,
      color: 'from-amber-500 to-orange-500',
    },
  ];

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle className="w-5 h-5 text-indigo-400" />
        <h3 className="font-semibold text-white">Track 2 Workflow</h3>
        <span className="text-xs text-slate-500">Follow these steps in order</span>
      </div>

      <div className="flex items-center gap-4">
        {steps.map((s, i) => (
          <React.Fragment key={s.step}>
            <button
              onClick={() => onNavigate(s.tab)}
              className="flex-1 group"
            >
              <div className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 rounded-lg p-4 transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center",
                    s.color
                  )}>
                    <s.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">STEP {s.step}</span>
                    </div>
                    <span className="font-medium text-white group-hover:text-indigo-300 transition-colors">
                      {s.title}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{s.description}</p>
              </div>
            </button>
            {i < steps.length - 1 && (
              <ArrowRight className="w-5 h-5 text-slate-600 flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function RequirementsBanner() {
  const completedCount = requirements.filter(r => r.completed).length;

  return (
    <div className="bg-gradient-to-r from-violet-950/50 to-indigo-950/50 border border-violet-500/30 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Track 2: Optimize</h2>
            <p className="text-sm text-slate-400">
              Rigorous engineering discipline for edge cases
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-violet-400">
            {completedCount}/{requirements.length}
          </div>
          <div className="text-sm text-slate-400">Requirements Met</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {requirements.map(req => (
          <div
            key={req.id}
            className={cn(
              'p-3 rounded-lg border transition-all',
              req.completed
                ? 'bg-emerald-950/30 border-emerald-500/30'
                : 'bg-slate-900/50 border-slate-700/50'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {req.completed ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-slate-600" />
              )}
              <span className={cn(
                'font-medium text-sm',
                req.completed ? 'text-emerald-300' : 'text-slate-400'
              )}>
                {req.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 ml-6">
              {req.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Track2Dashboard() {
  const [activeTab, setActiveTab] = useState('architecture');

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Workflow Guide */}
      <WorkflowGuide onNavigate={setActiveTab} />

      {/* Requirements Banner */}
      <RequirementsBanner />

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="architecture" className="gap-2">
            <Network className="w-4 h-4" />
            A2A Architecture
          </TabsTrigger>
          <TabsTrigger value="simulation" className="gap-2">
            <FlaskConical className="w-4 h-4" />
            Simulation
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Edit3 className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="observability" className="gap-2">
            <Activity className="w-4 h-4" />
            Observability
          </TabsTrigger>
          <TabsTrigger value="optimizer" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Optimizer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="architecture">
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <AgentArchitecture />
          </div>
        </TabsContent>

        <TabsContent value="simulation">
          <SimulationDashboard />
        </TabsContent>

        <TabsContent value="templates">
          <TemplateEditor />
        </TabsContent>

        <TabsContent value="observability">
          <TraceViewer />
        </TabsContent>

        <TabsContent value="optimizer">
          <OptimizerDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Track2Dashboard;
