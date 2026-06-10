/**
 * Guardrails for Founder Validation Agent
 *
 * Input validation, output safety checks, and content filtering
 * to ensure production-ready agent behavior.
 */

import { z } from 'zod';
import { tracer } from '../observability/tracing.js';

// ============================================
// INPUT GUARDRAILS
// ============================================

export interface InputValidationResult {
  valid: boolean;
  sanitizedInput?: string;
  blockedReason?: string;
  warnings: string[];
}

// Patterns to block
const BLOCKED_PATTERNS = [
  // Prompt injection attempts
  /ignore\s+(previous|all)\s+instructions?/i,
  /disregard\s+(your|the)\s+(system|initial)/i,
  /you\s+are\s+now\s+a/i,
  /pretend\s+to\s+be/i,
  /act\s+as\s+if/i,
  /forget\s+(everything|your\s+instructions)/i,
  /new\s+instructions?:/i,
  /system\s*:\s*you\s+are/i,

  // Harmful content requests
  /how\s+to\s+(hack|steal|scam)/i,
  /illegal\s+(business|scheme|activity)/i,

  // PII extraction attempts
  /what\s+is\s+your\s+(api|secret)\s*key/i,
  /reveal\s+your\s+(system|initial)\s+prompt/i,
];

// Patterns that trigger warnings (not blocked)
const WARNING_PATTERNS = [
  { pattern: /everyone|anybody|all\s+people/i, warning: 'Vague target customer detected' },
  { pattern: /million\s*dollar|billion/i, warning: 'Unrealistic revenue claims detected' },
  { pattern: /guaranteed|definitely|100%/i, warning: 'Overconfident claims detected' },
];

// Maximum input length
const MAX_INPUT_LENGTH = 10000;

/**
 * Validate and sanitize user input
 */
export function validateInput(input: string): InputValidationResult {
  const spanId = tracer.startSpan('input_validation').spanId;
  const warnings: string[] = [];

  try {
    // Check length
    if (input.length > MAX_INPUT_LENGTH) {
      tracer.addEvent(spanId, 'GUARDRAIL_BLOCK', 'Input too long', {
        length: input.length,
        maxLength: MAX_INPUT_LENGTH,
      });
      tracer.endSpan(spanId, 'ERROR');
      return {
        valid: false,
        blockedReason: `Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`,
        warnings: [],
      };
    }

    // Check for blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(input)) {
        tracer.addEvent(spanId, 'GUARDRAIL_BLOCK', 'Blocked pattern detected', {
          pattern: pattern.toString(),
        });
        tracer.endSpan(spanId, 'ERROR');
        return {
          valid: false,
          blockedReason: 'Input contains potentially harmful content',
          warnings: [],
        };
      }
    }

    // Check for warning patterns
    for (const { pattern, warning } of WARNING_PATTERNS) {
      if (pattern.test(input)) {
        warnings.push(warning);
      }
    }

    // Sanitize input
    const sanitizedInput = sanitizeInput(input);

    tracer.addEvent(spanId, 'GUARDRAIL_CHECK', 'Input validated', {
      originalLength: input.length,
      sanitizedLength: sanitizedInput.length,
      warningCount: warnings.length,
    });
    tracer.endSpan(spanId, 'OK');

    return {
      valid: true,
      sanitizedInput,
      warnings,
    };
  } catch (error) {
    tracer.addEvent(spanId, 'GUARDRAIL_BLOCK', 'Validation error', {
      error: String(error),
    });
    tracer.endSpan(spanId, 'ERROR');
    return {
      valid: false,
      blockedReason: 'Input validation failed',
      warnings: [],
    };
  }
}

/**
 * Sanitize input by removing potentially problematic content
 */
function sanitizeInput(input: string): string {
  return input
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove null bytes
    .replace(/\0/g, '')
    // Trim
    .trim();
}

// ============================================
// OUTPUT GUARDRAILS
// ============================================

export interface OutputValidationResult {
  valid: boolean;
  sanitizedOutput?: string;
  blockedReason?: string;
  modifications: string[];
}

// Output patterns to filter
const OUTPUT_BLOCKED_PATTERNS = [
  // Prevent revealing system prompts
  /my\s+(system|initial)\s+prompt\s+is/i,
  /i\s+was\s+instructed\s+to/i,

  // Block harmful advice
  /you\s+should\s+(hack|steal|scam)/i,
  /here's\s+how\s+to\s+(illegally|fraudulently)/i,
];

// Output patterns to sanitize (not block, but modify)
const OUTPUT_SANITIZE_PATTERNS = [
  // Remove any accidentally leaked keys
  { pattern: /api[_-]?key[:\s]*[a-zA-Z0-9_-]{20,}/gi, replacement: '[REDACTED_KEY]' },
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED_KEY]' },
  { pattern: /AIza[a-zA-Z0-9_-]{35}/g, replacement: '[REDACTED_KEY]' },
];

// Maximum output length
const MAX_OUTPUT_LENGTH = 50000;

/**
 * Validate and sanitize agent output
 */
export function validateOutput(output: string): OutputValidationResult {
  const spanId = tracer.startSpan('output_validation').spanId;
  const modifications: string[] = [];

  try {
    // Check for blocked patterns
    for (const pattern of OUTPUT_BLOCKED_PATTERNS) {
      if (pattern.test(output)) {
        tracer.addEvent(spanId, 'GUARDRAIL_BLOCK', 'Blocked output pattern', {
          pattern: pattern.toString(),
        });
        tracer.endSpan(spanId, 'ERROR');
        return {
          valid: false,
          blockedReason: 'Output contains prohibited content',
          modifications: [],
        };
      }
    }

    // Sanitize output
    let sanitizedOutput = output;

    // Apply sanitization patterns
    for (const { pattern, replacement } of OUTPUT_SANITIZE_PATTERNS) {
      if (pattern.test(sanitizedOutput)) {
        sanitizedOutput = sanitizedOutput.replace(pattern, replacement);
        modifications.push(`Redacted sensitive pattern: ${pattern.toString()}`);
      }
    }

    // Truncate if too long
    if (sanitizedOutput.length > MAX_OUTPUT_LENGTH) {
      sanitizedOutput = sanitizedOutput.slice(0, MAX_OUTPUT_LENGTH) + '\n\n[Output truncated due to length]';
      modifications.push('Output truncated');
    }

    tracer.addEvent(spanId, 'GUARDRAIL_CHECK', 'Output validated', {
      originalLength: output.length,
      sanitizedLength: sanitizedOutput.length,
      modificationCount: modifications.length,
    });
    tracer.endSpan(spanId, 'OK');

    return {
      valid: true,
      sanitizedOutput,
      modifications,
    };
  } catch (error) {
    tracer.addEvent(spanId, 'GUARDRAIL_BLOCK', 'Output validation error', {
      error: String(error),
    });
    tracer.endSpan(spanId, 'ERROR');
    return {
      valid: false,
      blockedReason: 'Output validation failed',
      modifications: [],
    };
  }
}

// ============================================
// TOOL CALL GUARDRAILS
// ============================================

export interface ToolCallValidationResult {
  valid: boolean;
  blockedReason?: string;
}

// Tool-specific parameter validation schemas
const TOOL_SCHEMAS: Record<string, z.ZodSchema> = {
  clarify_idea: z.object({
    ideaDescription: z.string().min(10).max(5000),
    targetCustomer: z.string().max(500).optional(),
    founderBackground: z.string().max(1000).optional(),
  }),
  save_venture: z.object({
    founderId: z.string().min(1),
    ventureName: z.string().min(1).max(200),
    clarifiedIdea: z.string().min(10).max(5000),
    targetCustomer: z.string().min(1).max(500),
    problemStatement: z.string().min(10).max(2000),
  }),
  identify_risky_assumptions: z.object({
    clarifiedIdea: z.string().min(10).max(5000),
    targetCustomer: z.string().min(1).max(500),
    coreProblem: z.string().min(10).max(2000),
    proposedSolution: z.string().max(2000).optional(),
  }),
  generate_interview_questions: z.object({
    targetCustomer: z.string().min(1).max(500),
    coreProblem: z.string().min(10).max(2000),
    assumptions: z.array(z.string()).max(20),
    interviewType: z.enum(['PROBLEM_DISCOVERY', 'SOLUTION_VALIDATION', 'PRICING_RESEARCH']).optional(),
  }),
  define_mvp_scope: z.object({
    clarifiedIdea: z.string().min(10).max(5000),
    riskiestAssumption: z.string().min(10).max(1000),
    targetCustomer: z.string().min(1).max(500),
    coreProblem: z.string().min(10).max(2000),
    validatedInsights: z.array(z.string()).max(20).optional(),
  }),
  create_7day_validation_plan: z.object({
    ventureId: z.string().min(1),
    primaryGoal: z.string().min(10).max(1000),
    riskiestAssumption: z.string().min(10).max(1000),
    mvpType: z.enum(['LANDING_PAGE', 'SMOKE_TEST', 'CONCIERGE', 'WIZARD_OF_OZ', 'PROTOTYPE', 'INTERVIEWS_ONLY']).optional(),
    targetInterviews: z.number().min(1).max(50).optional(),
  }),
};

/**
 * Validate tool call parameters
 */
export function validateToolCall(
  toolName: string,
  params: Record<string, unknown>
): ToolCallValidationResult {
  const spanId = tracer.startSpan('tool_call_validation').spanId;

  try {
    const schema = TOOL_SCHEMAS[toolName];

    if (!schema) {
      // No schema defined - allow but log
      tracer.addEvent(spanId, 'GUARDRAIL_CHECK', 'No schema for tool', { toolName });
      tracer.endSpan(spanId, 'OK');
      return { valid: true };
    }

    const result = schema.safeParse(params);

    if (!result.success) {
      tracer.addEvent(spanId, 'GUARDRAIL_BLOCK', 'Invalid tool parameters', {
        toolName,
        errors: result.error.issues,
      });
      tracer.endSpan(spanId, 'ERROR');
      return {
        valid: false,
        blockedReason: `Invalid parameters: ${result.error.issues.map((e: { message: string }) => e.message).join(', ')}`,
      };
    }

    tracer.addEvent(spanId, 'GUARDRAIL_CHECK', 'Tool call validated', { toolName });
    tracer.endSpan(spanId, 'OK');

    return { valid: true };
  } catch (error) {
    tracer.addEvent(spanId, 'GUARDRAIL_BLOCK', 'Tool validation error', {
      toolName,
      error: String(error),
    });
    tracer.endSpan(spanId, 'ERROR');
    return {
      valid: false,
      blockedReason: 'Tool call validation failed',
    };
  }
}

// ============================================
// RATE LIMITING
// ============================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimits: Map<string, RateLimitEntry> = new Map();

const RATE_LIMIT_CONFIG = {
  maxRequests: 100,
  windowMs: 60000, // 1 minute
};

/**
 * Check rate limit for a user/session
 */
export function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimits.get(userId);

  if (!entry || now > entry.resetTime) {
    rateLimits.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.windowMs,
    });
    return { allowed: true, remaining: RATE_LIMIT_CONFIG.maxRequests - 1 };
  }

  if (entry.count >= RATE_LIMIT_CONFIG.maxRequests) {
    tracer.log('WARN', 'Rate limit exceeded', { userId, count: entry.count });
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_CONFIG.maxRequests - entry.count };
}

// ============================================
// EXPORTS
// ============================================

export const guardrails = {
  validateInput,
  validateOutput,
  validateToolCall,
  checkRateLimit,
};

export default guardrails;
