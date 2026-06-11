import React, { useState, useEffect } from 'react';
import { Edit3, Save, RotateCcw, Eye, Code, Variable, History, Clock, ChevronDown, ChevronUp, RefreshCw, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { cn } from '../../lib/utils';
import { getAuthHeaders } from '../../lib/api';

import { API_URL as BACKEND_URL } from '../../config'

export function TemplateEditor() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editedInstruction, setEditedInstruction] = useState('');
  const [variables, setVariables] = useState({});
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [defaultTemplate, setDefaultTemplate] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

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
      updatePreview(selectedTemplate.instruction, vars);
      fetchHistory(selectedTemplate.id);
      fetchDefaultTemplate(selectedTemplate.id);
      setHasChanges(false);
    }
  }, [selectedTemplate]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/agent-templates`, { headers: getAuthHeaders() });
      const data = await res.json();
      setTemplates(data);
      if (data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  const fetchHistory = async (templateId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/agent-templates/${templateId}/history`, { headers: getAuthHeaders() });
      const data = await res.json();
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setHistory([]);
    }
  };

  const fetchDefaultTemplate = async (templateId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/agent-templates/${templateId}/default`, { headers: getAuthHeaders() });
      const data = await res.json();
      setDefaultTemplate(data);
    } catch (err) {
      console.error('Failed to fetch default template:', err);
      setDefaultTemplate(null);
    }
  };

  const updatePreview = async (instruction, vars) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/agent-templates/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ agentId: selectedTemplate?.id, template: instruction, variables: vars }),
      });
      const data = await res.json();
      setPreview(data.rendered);
    } catch (err) {
      // Fallback: simple replace
      let rendered = instruction;
      Object.entries(vars).forEach(([key, value]) => {
        rendered = rendered.replace(new RegExp(`\\{\\{${key}(?::[^}]*)?\\}\\}`, 'g'), value || '');
      });
      setPreview(rendered);
    }
  };

  const handleInstructionChange = (value) => {
    setEditedInstruction(value);
    setHasChanges(value !== selectedTemplate?.instruction);
    updatePreview(value, variables);
  };

  const handleVariableChange = (name, value) => {
    const newVars = { ...variables, [name]: value };
    setVariables(newVars);
    updatePreview(editedInstruction, newVars);
  };

  const saveTemplate = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/agent-templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          ...selectedTemplate,
          instruction: editedInstruction,
        }),
      });
      const updated = await res.json();
      setSelectedTemplate(updated);
      setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
      setHasChanges(false);
      // Refresh history after save
      fetchHistory(updated.id);
    } catch (err) {
      console.error('Failed to save template:', err);
    }
    setSaving(false);
  };

  const resetSingleTemplate = async () => {
    if (!selectedTemplate) return;
    if (!confirm(`Reset "${selectedTemplate.name}" to default? This will save the current version to history.`)) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/agent-templates/${selectedTemplate.id}/reset`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTemplate(data.template);
        setEditedInstruction(data.template.instruction);
        setHasChanges(false);
        fetchHistory(selectedTemplate.id);
        await fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to reset template:', err);
    }
  };

  const resetAllTemplates = async () => {
    if (!confirm('Reset ALL templates to defaults? Current versions will be saved to history.')) return;

    try {
      await fetch(`${BACKEND_URL}/api/agent-templates/reset`, { method: 'POST', headers: getAuthHeaders() });
      await fetchTemplates();
      if (selectedTemplate) {
        fetchHistory(selectedTemplate.id);
      }
    } catch (err) {
      console.error('Failed to reset templates:', err);
    }
  };

  const applyHistoryEntry = async (historyEntry) => {
    if (!confirm(`Apply this historical prompt from ${new Date(historyEntry.timestamp).toLocaleString()}?`)) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/agent-templates/history/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ historyId: historyEntry.id }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTemplate(data.template);
        setEditedInstruction(data.template.instruction);
        setHasChanges(false);
        fetchHistory(selectedTemplate.id);
        await fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to apply history:', err);
    }
  };

  // Extract variables from instruction string
  const extractVariables = (instruction) => {
    const matches = instruction.matchAll(/\{\{(\w+)(?::([^}]*))?\}\}/g);
    return [...new Set([...matches].map(m => ({
      name: m[1],
      defaultValue: m[2] || '',
    })))];
  };

  const templateVars = selectedTemplate ? extractVariables(editedInstruction) : [];

  const isModifiedFromDefault = defaultTemplate?.instruction && editedInstruction !== defaultTemplate.instruction;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Edit3 className="w-6 h-6 text-amber-400" />
            Agent Prompt Templates
          </h1>
          <p className="text-slate-400 mt-1">
            Edit agent prompts with {'{{variable}}'} syntax. Changes are tracked in history.
          </p>
        </div>
        <Button variant="secondary" onClick={resetAllTemplates}>
          <RotateCcw className="w-4 h-4" />
          Reset All to Defaults
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Template List */}
        <Card className="col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Agents</CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[600px] overflow-y-auto">
            {templates.map(template => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={cn(
                  "p-3 border-b border-slate-800 cursor-pointer transition-colors",
                  selectedTemplate?.id === template.id
                    ? "bg-amber-500/10 border-l-2 border-l-amber-500"
                    : "hover:bg-slate-800/50"
                )}
              >
                <div className="font-medium text-slate-200 text-sm">{template.name}</div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {template.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Editor */}
        <div className="col-span-3 space-y-4">
          {selectedTemplate ? (
            <>
              {/* Template Header with Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {selectedTemplate.name}
                        {hasChanges && (
                          <Badge variant="outline" className="text-amber-400 border-amber-400">
                            Unsaved
                          </Badge>
                        )}
                        {isModifiedFromDefault && !hasChanges && (
                          <Badge variant="outline" className="text-blue-400 border-blue-400">
                            Modified
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>ID: {selectedTemplate.id}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowHistory(!showHistory)}
                        className="gap-1"
                      >
                        <History className="w-4 h-4" />
                        History
                        {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetSingleTemplate}
                        className="gap-1 text-amber-400 hover:text-amber-300"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Reset to Default
                      </Button>
                      <Button onClick={saveTemplate} disabled={saving || !hasChanges} size="sm">
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* History Panel */}
              {showHistory && (
                <Card className="border-violet-500/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-violet-400" />
                      Prompt History
                    </CardTitle>
                    <CardDescription>
                      Click on a historical version to apply it
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {history.length === 0 ? (
                      <p className="text-slate-500 text-sm">No history available yet. Save changes to create history.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {history.slice(0, 10).map((entry) => (
                          <div
                            key={entry.id}
                            onClick={() => applyHistoryEntry(entry)}
                            className="p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors border border-slate-700 hover:border-violet-500/50"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-sm font-medium text-slate-200">
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                              <Badge
                                variant={entry.source === 'optimizer' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {entry.source === 'optimizer' ? 'AI Optimized' : 'Manual'}
                              </Badge>
                            </div>
                            {entry.description && (
                              <p className="text-xs text-slate-400 mb-2">{entry.description}</p>
                            )}
                            <p className="text-xs text-slate-500 line-clamp-2 font-mono">
                              {entry.instruction.substring(0, 150)}...
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Instruction Editor */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Code className="w-4 h-4 text-amber-400" />
                    Agent Instruction
                  </CardTitle>
                  <CardDescription>
                    Use {'{{variable:default}}'} syntax. Variables will be replaced with values.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={editedInstruction}
                    onChange={(e) => handleInstructionChange(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                  />
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
                      Set values for template variables
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {templateVars.map(v => (
                        <div key={v.name}>
                          <label className="text-sm text-slate-400 mb-1 block">
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
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    Preview
                  </CardTitle>
                  <CardDescription>
                    How the instruction will appear to the agent
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-800 rounded-lg p-4 text-slate-200 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {preview || 'No preview available'}
                  </div>
                </CardContent>
              </Card>

              {/* Compare with Default */}
              {defaultTemplate && defaultTemplate.instruction && isModifiedFromDefault && (
                <Card className="border-blue-500/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-400" />
                      Default Instruction (for comparison)
                    </CardTitle>
                    <CardDescription>
                      The original default instruction before modifications
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-800/50 rounded-lg p-4 text-slate-400 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                      {defaultTemplate.instruction?.substring(0, 500) || ''}
                      {(defaultTemplate.instruction?.length || 0) > 500 && '...'}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64 text-slate-500">
                Select an agent to edit its prompt
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default TemplateEditor;
