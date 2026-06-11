#!/usr/bin/env npx ts-node
/**
 * Import existing eval cases into ADK eval set format
 *
 * Usage: npx ts-node scripts/import_eval_cases.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface LegacyEvalCase {
  eval_id: string;
  name: string;
  conversation: Array<{
    invocation_id: string;
    user_content: {
      role: string;
      parts: Array<{text: string}>;
    };
    expected_tool_use?: Array<{name: string}>;
    expected_response_contains?: string[];
  }>;
}

interface LegacyEvalSet {
  eval_set_id: string;
  name: string;
  description: string;
  eval_cases: LegacyEvalCase[];
}

interface AdkEvalCase {
  evalId: string;
  conversation: Array<{
    invocationId: string;
    userContent: {
      role: 'user' | 'model';
      parts: Array<{text?: string}>;
    };
    finalResponse?: {
      role: 'model';
      parts: Array<{text?: string}>;
    };
    intermediateData?: {
      toolUses: Array<{name: string; args: Record<string, unknown>}>;
      toolResponses: Array<{name: string; response: Record<string, unknown>}>;
    };
    creationTimestamp: number;
  }>;
  sessionInput?: {
    appName: string;
    userId: string;
    state: Record<string, unknown>;
  };
  creationTimestamp: number;
}

interface AdkEvalSet {
  evalSetId: string;
  name?: string;
  description?: string;
  evalCases: AdkEvalCase[];
  creationTimestamp: number;
}

function convertEvalCase(legacy: LegacyEvalCase): AdkEvalCase {
  const now = Date.now() / 1000;

  return {
    evalId: legacy.eval_id,
    conversation: legacy.conversation.map(inv => ({
      invocationId: inv.invocation_id,
      userContent: {
        role: 'user' as const,
        parts: inv.user_content.parts,
      },
      // Add expected tool uses as intermediate data
      intermediateData: inv.expected_tool_use ? {
        toolUses: inv.expected_tool_use.map(t => ({name: t.name, args: {}})),
        toolResponses: [],
      } : undefined,
      creationTimestamp: now,
    })),
    sessionInput: {
      appName: 'agent',
      userId: 'eval_user',
      state: {},
    },
    creationTimestamp: now,
  };
}

function convertEvalSet(legacy: LegacyEvalSet): AdkEvalSet {
  return {
    evalSetId: legacy.eval_set_id.replace(/_/g, '_'),
    name: legacy.name,
    description: legacy.description,
    evalCases: legacy.eval_cases.map(convertEvalCase),
    creationTimestamp: Date.now() / 1000,
  };
}

async function main() {
  const inputPath = path.join(process.cwd(), 'eval', 'eval_cases.json');
  const outputDir = path.join(process.cwd(), 'src', 'agent');

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`Reading eval cases from: ${inputPath}`);
  const legacyData = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as LegacyEvalSet;

  console.log(`Found ${legacyData.eval_cases.length} eval cases`);

  const adkEvalSet = convertEvalSet(legacyData);

  const outputPath = path.join(outputDir, `${adkEvalSet.evalSetId}.evalset.json`);
  fs.writeFileSync(outputPath, JSON.stringify(adkEvalSet, null, 2));

  console.log(`Wrote ADK eval set to: ${outputPath}`);
  console.log(`\nEval cases imported:`);
  for (const evalCase of adkEvalSet.evalCases) {
    console.log(`  - ${evalCase.evalId}`);
  }

  console.log(`\nYou can now use this eval set with:`);
  console.log(`  curl http://localhost:8000/apps/agent/eval_sets`);
  console.log(`  curl -X POST http://localhost:8000/apps/agent/optimize -H "Content-Type: application/json" -d '{"evalSetId": "${adkEvalSet.evalSetId}"}'`);
}

main().catch(console.error);
