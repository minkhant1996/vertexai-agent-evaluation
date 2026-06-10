import React, { useState } from 'react';
import { cn } from '../../lib/utils';

// Agent data with A2A metadata
const agents = [
  {
    id: 'orchestrator',
    name: 'Root Orchestrator',
    stage: 0,
    color: 'from-violet-500 to-purple-600',
    borderColor: 'border-violet-500/50',
    description: 'A2A coordinator that routes to specialist agents',
    tools: ['detect_validation_stage', 'delegate_to_agent', 'synthesize_outputs', 'discover_agents'],
    isOrchestrator: true,
  },
  {
    id: 'problem_clarifier',
    name: 'Problem Clarifier',
    stage: 1,
    color: 'from-blue-500 to-cyan-500',
    borderColor: 'border-blue-500/50',
    description: 'Extract specific problem & customer segment',
    tools: ['structure_problem'],
    triggers: ['vague idea', 'everyone as customer', 'unclear problem'],
    outputs: ['specific segment', 'problem statement', 'anger assessment'],
  },
  {
    id: 'assumption_hunter',
    name: 'Assumption Hunter',
    stage: 2,
    color: 'from-amber-500 to-orange-500',
    borderColor: 'border-amber-500/50',
    description: 'Identify risky assumptions to test first',
    tools: ['identify_assumptions'],
    triggers: ['clarified idea ready', 'need to identify risks'],
    outputs: ['assumption list', 'top 3 to test', 'test methods'],
  },
  {
    id: 'customer_researcher',
    name: 'Customer Researcher',
    stage: 3,
    color: 'from-emerald-500 to-teal-500',
    borderColor: 'border-emerald-500/50',
    description: 'Design interviews & analyze feedback',
    tools: ['generate_interview_script', 'analyze_interview_results'],
    triggers: ['need interview questions', 'have interview data'],
    outputs: ['interview script', 'analysis results', 'validation strength'],
  },
  {
    id: 'experiment_designer',
    name: 'Experiment Designer',
    stage: 4,
    color: 'from-rose-500 to-pink-500',
    borderColor: 'border-rose-500/50',
    description: 'Design cheapest validation experiment',
    tools: ['design_experiment'],
    triggers: ['ready to build', 'need MVP scope', 'validated assumptions'],
    outputs: ['experiment design', 'scope', 'timeline', 'success metrics'],
  },
];

function AgentCard({ agent, isActive, onClick }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300',
        'bg-slate-900/50 backdrop-blur-sm hover:scale-105',
        agent.borderColor,
        isActive && 'ring-2 ring-white/30 scale-105'
      )}
    >
      {/* Stage badge */}
      {agent.stage > 0 && (
        <div className={cn(
          'absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center',
          'bg-gradient-to-br text-white font-bold text-sm shadow-lg',
          agent.color
        )}>
          {agent.stage}
        </div>
      )}

      {/* A2A badge for orchestrator */}
      {agent.isOrchestrator && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold shadow-lg">
          A2A
        </div>
      )}

      {/* Agent name */}
      <h3 className={cn(
        'text-lg font-semibold bg-gradient-to-r bg-clip-text text-transparent',
        agent.color
      )}>
        {agent.name}
      </h3>

      {/* Description */}
      <p className="text-slate-400 text-sm mt-1">
        {agent.description}
      </p>

      {/* Tools count */}
      <div className="mt-3 flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs">
          {agent.tools.length} tools
        </span>
        {agent.outputs && (
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs">
            {agent.outputs.length} outputs
          </span>
        )}
      </div>
    </div>
  );
}

function AgentDetail({ agent }) {
  if (!agent) return null;

  return (
    <div className={cn(
      'p-6 rounded-xl border-2 bg-slate-900/80 backdrop-blur-sm',
      agent.borderColor
    )}>
      <div className="flex items-center gap-4 mb-4">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          'bg-gradient-to-br text-white font-bold text-xl shadow-lg',
          agent.color
        )}>
          {agent.isOrchestrator ? '⚡' : agent.stage}
        </div>
        <div>
          <h2 className={cn(
            'text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent',
            agent.color
          )}>
            {agent.name}
          </h2>
          <p className="text-slate-400">{agent.description}</p>
        </div>
      </div>

      {/* Tools */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">Tools</h4>
        <div className="flex flex-wrap gap-2">
          {agent.tools.map(tool => (
            <span
              key={tool}
              className={cn(
                'px-3 py-1 rounded-lg text-sm font-mono',
                'bg-slate-800 text-slate-200'
              )}
            >
              {tool}
            </span>
          ))}
        </div>
      </div>

      {/* Triggers */}
      {agent.triggers && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Triggers</h4>
          <div className="flex flex-wrap gap-2">
            {agent.triggers.map(trigger => (
              <span
                key={trigger}
                className="px-3 py-1 rounded-lg text-sm bg-slate-800/50 text-slate-400"
              >
                {trigger}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Outputs */}
      {agent.outputs && (
        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Outputs</h4>
          <div className="flex flex-wrap gap-2">
            {agent.outputs.map(output => (
              <span
                key={output}
                className={cn(
                  'px-3 py-1 rounded-lg text-sm',
                  'bg-gradient-to-r text-white',
                  agent.color
                )}
              >
                {output}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectionLine({ from, to }) {
  return (
    <div className="flex items-center justify-center">
      <svg width="40" height="24" viewBox="0 0 40 24" className="text-slate-600">
        <path
          d="M0 12 L30 12 M25 6 L35 12 L25 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function AgentArchitecture({ className }) {
  const [selectedAgent, setSelectedAgent] = useState(agents[0]);

  const orchestrator = agents[0];
  const subAgents = agents.slice(1);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">
          A2A Multi-Agent Architecture
        </h2>
        <p className="text-slate-400">
          Agent-to-Agent protocol for coordinated validation flow
        </p>
      </div>

      {/* Architecture diagram */}
      <div className="relative">
        {/* Orchestrator */}
        <div className="flex justify-center mb-8">
          <div className="w-64">
            <AgentCard
              agent={orchestrator}
              isActive={selectedAgent?.id === orchestrator.id}
              onClick={() => setSelectedAgent(orchestrator)}
            />
          </div>
        </div>

        {/* Connection lines from orchestrator */}
        <div className="flex justify-center mb-4">
          <svg width="600" height="40" viewBox="0 0 600 40" className="text-slate-600">
            {/* Main vertical line */}
            <path d="M300 0 L300 20" stroke="currentColor" strokeWidth="2" fill="none" />
            {/* Horizontal line */}
            <path d="M75 20 L525 20" stroke="currentColor" strokeWidth="2" fill="none" />
            {/* Vertical drops */}
            <path d="M75 20 L75 40" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M225 20 L225 40" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M375 20 L375 40" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M525 20 L525 40" stroke="currentColor" strokeWidth="2" fill="none" />
            {/* Arrow heads */}
            <path d="M70 35 L75 40 L80 35" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M220 35 L225 40 L230 35" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M370 35 L375 40 L380 35" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M520 35 L525 40 L530 35" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </div>

        {/* Sub-agents */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {subAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isActive={selectedAgent?.id === agent.id}
              onClick={() => setSelectedAgent(agent)}
            />
          ))}
        </div>

        {/* Flow arrows between sub-agents */}
        <div className="hidden lg:flex justify-center mt-4 px-12">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">Stage 1</span>
            <span>→</span>
            <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-400">Stage 2</span>
            <span>→</span>
            <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">Stage 3</span>
            <span>→</span>
            <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-400">Stage 4</span>
          </div>
        </div>
      </div>

      {/* Selected agent detail */}
      <div className="mt-8">
        <AgentDetail agent={selectedAgent} />
      </div>

      {/* A2A Protocol info */}
      <div className="mt-6 p-4 rounded-xl border border-violet-500/30 bg-violet-950/20">
        <h4 className="text-violet-400 font-semibold mb-2">A2A Protocol Features</h4>
        <ul className="text-slate-400 text-sm space-y-1">
          <li>• <strong>Agent Discovery</strong>: Orchestrator discovers available specialists</li>
          <li>• <strong>Structured Delegation</strong>: Tasks routed with context and metadata</li>
          <li>• <strong>Sequential Flow</strong>: Outputs pass from one stage to the next</li>
          <li>• <strong>Synthesis</strong>: Combined outputs create unified recommendations</li>
        </ul>
      </div>
    </div>
  );
}

export default AgentArchitecture;
