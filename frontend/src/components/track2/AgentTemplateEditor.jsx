import React, { useState, useEffect } from 'react';
import { Bot, Save, RotateCcw, Eye, Code, Variable, Cpu } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { cn } from '../../lib/utils';

// Use relative URL when not in development (same-origin)
const BACKEND_URL = import.meta.env.VITE_API_URL || '';

export function AgentTemplateEditor() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editedInstruction, setEditedInstruction] = useState('');
  const [variables, setVariables] = useState({});
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      setEditedInstruction(selectedTemplate.instruction);
      // Initialize variables with defaults
      const vars = {};
      selectedTemplate.variables?.forEach(v => {
        vars[v.name] = v.defaultValue || '';
      });
      setVariables(vars);
    }
  }, [selectedTemplate]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/agent-templates`);
      const data = await res.json();
      setTemplates(data);
      if (data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch agent templates:', err);
    }
  };

  const updatePreview = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/agent-templates/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedTemplate.id,
          variables
        }),
      });
      const data = await res.json();
      setPreview(data.rendered);
      setShowPreview(true);
    } catch (err) {
      // Fallback: simple replace
      let rendered = editedInstruction;
      Object.entries(variables).forEach(([key, value]) => {
        rendered = rendered.replace(new RegExp(`\\{\\{${key}(?::[^}]*)?\\}\\}`, 'g'), value || '');
      });
      setPreview(rendered);
      setShowPreview(true);
    }
  };

  const handleVariableChange = (name, value) => {
    setVariables(prev => ({ ...prev, [name]: value }));
  };

  const saveTemplate = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/agent-templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedTemplate,
          instruction: editedInstruction,
        }),
      });
      const updated = await res.json();
      setSelectedTemplate(updated);
      setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (err) {
      console.error('Failed to save template:', err);
    }
    setSaving(false);
  };

  const resetTemplates = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/agent-templates/reset`, { method: 'POST' });
      await fetchTemplates();
    } catch (err) {
      console.error('Failed to reset templates:', err);
    }
  };

  const resetSingleTemplate = async (templateId) => {
    if (!confirm(`Reset ${selectedTemplate?.name || templateId} to default? This will restore the original instruction.`)) {
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/agent-templates/${templateId}/reset`, { method: 'POST' });
      const updated = await res.json();
      if (updated.success !== false) {
        setSelectedTemplate(updated.template || updated);
        setEditedInstruction(updated.template?.instruction || updated.instruction);
        await fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to reset template:', err);
    }
  };

  // Extract variables from instruction string
  const extractVariables = (instruction) => {
    const matches = instruction.matchAll(/\{\{(\w+)(?::([^}]*))?\}\}/g);
    const vars = [];
    const seen = new Set();
    for (const m of matches) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        vars.push({
          name: m[1],
          defaultValue: m[2] || '',
        });
      }
    }
    return vars;
  };

  const templateVars = selectedTemplate ? extractVariables(editedInstruction) : [];

  // Live rendered instruction (auto-updates when variables change)
  const renderedInstruction = React.useMemo(() => {
    let rendered = editedInstruction;
    Object.entries(variables).forEach(([key, value]) => {
      // Replace {{variable:default}} with the value (or default if empty)
      rendered = rendered.replace(
        new RegExp(`\\{\\{${key}(?::([^}]*))?\\}\\}`, 'g'),
        (match, defaultVal) => value || defaultVal || ''
      );
    });
    return rendered;
  }, [editedInstruction, variables]);

  const getAgentColor = (id) => {
    const colors = {
      orchestrator: 'from-violet-500 to-purple-600',
      problem_clarifier: 'from-blue-500 to-cyan-500',
      assumption_hunter: 'from-amber-500 to-orange-500',
      customer_researcher: 'from-emerald-500 to-teal-500',
      experiment_designer: 'from-rose-500 to-pink-500',
    };
    return colors[id] || 'from-slate-500 to-slate-600';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Bot className="w-6 h-6 text-violet-400" />
            Agent Prompts
          </h1>
          <p className="text-slate-400 mt-1">
            Edit agent instructions with {'{{variable}}'} syntax
          </p>
        </div>
        <Button variant="secondary" onClick={resetTemplates}>
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Agent List */}
        <Card className="col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Agents</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {templates.map(template => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={cn(
                  "p-3 border-b border-slate-800 cursor-pointer transition-colors",
                  selectedTemplate?.id === template.id
                    ? "bg-violet-500/10 border-l-2 border-l-violet-500"
                    : "hover:bg-slate-800/50"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-md bg-gradient-to-br flex items-center justify-center",
                    getAgentColor(template.id)
                  )}>
                    <Cpu className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-200 text-sm">{template.name}</div>
                    <div className="text-xs text-slate-500">{template.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Editor */}
        <div className="col-span-3 space-y-4">
          {selectedTemplate ? (
            <>
              {/* Agent Header */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center",
                        getAgentColor(selectedTemplate.id)
                      )}>
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle>{selectedTemplate.name}</CardTitle>
                        <CardDescription>{selectedTemplate.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={updatePreview}>
                        <Eye className="w-4 h-4" />
                        Preview
                      </Button>
                      <Button variant="secondary" onClick={() => resetSingleTemplate(selectedTemplate.id)}>
                        <RotateCcw className="w-4 h-4" />
                        Reset to Default
                      </Button>
                      <Button onClick={saveTemplate} disabled={saving}>
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Instruction Editor */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Code className="w-4 h-4 text-violet-400" />
                    Agent Instruction
                  </CardTitle>
                  <CardDescription>
                    Use {'{{variable:default}}'} syntax. Variables will be replaced with values.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Live Rendered Preview */}
                  <div className="bg-slate-800 rounded-lg p-4 text-slate-200 text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto font-mono mb-4 border border-slate-700">
                    {renderedInstruction || 'Enter instruction template above...'}
                  </div>

                  {/* Collapsible Raw Template Editor */}
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-300 flex items-center gap-2 mb-2">
                      <Code className="w-4 h-4" />
                      Edit Raw Template
                    </summary>
                    <Textarea
                      value={editedInstruction}
                      onChange={(e) => setEditedInstruction(e.target.value)}
                      rows={12}
                      className="font-mono text-sm"
                    />
                  </details>
                </CardContent>
              </Card>

              {/* Variables */}
              {templateVars.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Variable className="w-4 h-4 text-indigo-400" />
                      Variables ({templateVars.length})
                    </CardTitle>
                    <CardDescription>
                      Customize template values
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto">
                      {templateVars.map(v => (
                        <div key={v.name}>
                          <label className="text-sm text-slate-400 mb-1 block font-mono">
                            {'{{'}{v.name}{'}}'}
                          </label>
                          <Input
                            value={variables[v.name] || ''}
                            onChange={(e) => handleVariableChange(v.name, e.target.value)}
                            placeholder={v.defaultValue || 'Enter value...'}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Preview */}
              {showPreview && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Eye className="w-4 h-4 text-emerald-400" />
                        Rendered Preview
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                        Hide
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-800 rounded-lg p-4 text-slate-200 text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto font-mono">
                      {preview || 'No preview available'}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64 text-slate-500">
                Select an agent to edit its instruction
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentTemplateEditor;
