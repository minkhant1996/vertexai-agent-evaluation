/**
 * Track 2: Prompt Templates System
 *
 * Templates use {{variable}} syntax for dynamic values.
 * If variable is not provided, it renders as empty string.
 */

export interface TemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required?: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: TemplateVariable[];
  category: string;
}

/**
 * Render a template with variables
 * {{variable}} - replaced with value or ""
 * {{variable:default}} - replaced with value or default
 */
export function renderTemplate(template: string, variables: Record<string, string> = {}): string {
  return template.replace(/\{\{(\w+)(?::([^}]*))?\}\}/g, (match, varName, defaultValue) => {
    const value = variables[varName];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
    return defaultValue ?? '';
  });
}

/**
 * Extract variable names from a template
 */
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)(?::[^}]*)?\}\}/g);
  return [...new Set([...matches].map(m => m[1]))];
}

/**
 * Default prompt templates for edge case scenarios
 */
export const DEFAULT_TEMPLATES: Record<string, PromptTemplate> = {
  validation_seeker: {
    id: 'validation_seeker',
    name: 'Validation Seeker',
    category: 'mindset',
    template: `I've already decided to build {{product:a social network for left-handed people}}. I just need help with the MVP. {{extra_context}}Don't try to change my mind.`,
    variables: [
      { name: 'product', description: 'The product idea', defaultValue: 'a social network for left-handed people' },
      { name: 'extra_context', description: 'Additional context', defaultValue: '' },
    ],
  },
  feature_obsessed: {
    id: 'feature_obsessed',
    name: 'Feature-First Thinker',
    category: 'mindset',
    template: `I want to build an app with {{features:AI that analyzes documents and has a dashboard with charts and integrates with Slack and has team collaboration features and real-time sync}}.`,
    variables: [
      { name: 'features', description: 'List of features', defaultValue: 'AI that analyzes documents and has a dashboard with charts and integrates with Slack and has team collaboration features and real-time sync' },
    ],
  },
  contradictory_data: {
    id: 'contradictory_data',
    name: 'Contradictory Interview Data',
    category: 'validation',
    template: `I did {{interview_count:10}} interviews. {{positive_count:3}} loved my {{product:scheduling app}} idea, {{neutral_count:4}} were neutral, and {{negative_count:3}} said they wouldn't use it. {{additional_details:The 3 who loved it want mobile-first, but the neutral ones said they'd only use it on desktop.}} What should I do?`,
    variables: [
      { name: 'interview_count', description: 'Total interviews', defaultValue: '10' },
      { name: 'positive_count', description: 'Positive responses', defaultValue: '3' },
      { name: 'neutral_count', description: 'Neutral responses', defaultValue: '4' },
      { name: 'negative_count', description: 'Negative responses', defaultValue: '3' },
      { name: 'product', description: 'Product idea', defaultValue: 'scheduling app' },
      { name: 'additional_details', description: 'Extra details', defaultValue: '' },
    ],
  },
  refuses_customers: {
    id: 'refuses_customers',
    name: 'Refuses Customer Conversations',
    category: 'mindset',
    template: `I don't need to talk to customers. I've been in {{industry:this industry}} for {{years:10}} years. I know exactly what they need. {{extra_claim}}Just help me build the MVP.`,
    variables: [
      { name: 'industry', description: 'Industry name', defaultValue: 'this industry' },
      { name: 'years', description: 'Years of experience', defaultValue: '10' },
      { name: 'extra_claim', description: 'Additional claim', defaultValue: '' },
    ],
  },
  pivot_mid_conversation: {
    id: 'pivot_mid_conversation',
    name: 'Pivot Mid-Conversation',
    category: 'behavior',
    template: `I want to build {{idea1:a scheduling app for dentists}}.`,
    variables: [
      { name: 'idea1', description: 'First idea', defaultValue: 'a scheduling app for dentists' },
    ],
  },
  over_scoped_mvp: {
    id: 'over_scoped_mvp',
    name: 'Over-Scoped MVP',
    category: 'scope',
    template: `For my MVP I need: {{features:user auth, payments, admin dashboard, AI recommendations, analytics, multi-language support, mobile app, API, integrations with 10 tools, marketplace, and a community forum}}.`,
    variables: [
      { name: 'features', description: 'Feature list', defaultValue: 'user auth, payments, admin dashboard, AI recommendations, analytics, multi-language support, mobile app, API, integrations with 10 tools, marketplace, and a community forum' },
    ],
  },
  weak_validation: {
    id: 'weak_validation',
    name: 'Weak Interview Results',
    category: 'validation',
    template: `I did {{count:5}} interviews. Everyone said '{{response1:sounds interesting}}' and '{{response2:keep me posted}}' and '{{response3:I could see myself using that}}'. Is that good validation to start building?`,
    variables: [
      { name: 'count', description: 'Interview count', defaultValue: '5' },
      { name: 'response1', description: 'First response type', defaultValue: 'sounds interesting' },
      { name: 'response2', description: 'Second response type', defaultValue: 'keep me posted' },
      { name: 'response3', description: 'Third response type', defaultValue: 'I could see myself using that' },
    ],
  },
  technical_only: {
    id: 'technical_only',
    name: 'Technical Founder Syndrome',
    category: 'mindset',
    template: `I'm a {{role:senior engineer at Google}}. I want to build something with {{tech:the latest AI tech - maybe RAG with vector databases, fine-tuned LLMs, and real-time inference}}. What cool product should I build?`,
    variables: [
      { name: 'role', description: 'Technical role', defaultValue: 'senior engineer at Google' },
      { name: 'tech', description: 'Technology stack', defaultValue: 'the latest AI tech - maybe RAG with vector databases, fine-tuned LLMs, and real-time inference' },
    ],
  },
  already_built: {
    id: 'already_built',
    name: 'Already Built Product',
    category: 'timing',
    template: `I already spent {{time:6 months}} building my product. I have {{features:user auth, payments, the whole thing}}. Now I need help finding customers. Can you help me validate that people want it?`,
    variables: [
      { name: 'time', description: 'Time spent building', defaultValue: '6 months' },
      { name: 'features', description: 'Built features', defaultValue: 'user auth, payments, the whole thing' },
    ],
  },
  b2b_b2c_confusion: {
    id: 'b2b_b2c_confusion',
    name: 'B2B vs B2C Confusion',
    category: 'strategy',
    template: `My app helps {{value_prop:people manage their finances better}}. It could work for {{b2c_segment:individuals managing personal budgets}} or for {{b2b_segment:small businesses tracking expenses}}. Which should I target?`,
    variables: [
      { name: 'value_prop', description: 'Value proposition', defaultValue: 'people manage their finances better' },
      { name: 'b2c_segment', description: 'B2C segment', defaultValue: 'individuals managing personal budgets' },
      { name: 'b2b_segment', description: 'B2B segment', defaultValue: 'small businesses tracking expenses' },
    ],
  },
  vague_customer: {
    id: 'vague_customer',
    name: 'Vague Customer Definition',
    category: 'customer',
    template: `I'm building a {{product_type:productivity tool}}. My target customer is {{target:anyone who wants to be more productive - so basically everyone who works}}.`,
    variables: [
      { name: 'product_type', description: 'Product type', defaultValue: 'productivity tool' },
      { name: 'target', description: 'Target description', defaultValue: 'anyone who wants to be more productive - so basically everyone who works' },
    ],
  },
  solution_searching: {
    id: 'solution_searching',
    name: 'Solution Searching for Problem',
    category: 'mindset',
    template: `I have access to {{technology:a really powerful computer vision API}}. What product should I build with it? I'm thinking maybe something for {{domain1:retail}} or {{domain2:healthcare}}.`,
    variables: [
      { name: 'technology', description: 'Technology available', defaultValue: 'a really powerful computer vision API' },
      { name: 'domain1', description: 'First domain', defaultValue: 'retail' },
      { name: 'domain2', description: 'Second domain', defaultValue: 'healthcare' },
    ],
  },
  competitor_obsessed: {
    id: 'competitor_obsessed',
    name: 'Competitor Obsessed',
    category: 'strategy',
    template: `I want to build a better {{competitor:Notion}}. {{competitor}} is missing {{missing_features:these 5 features}} and I'll add them all. Plus I'll be {{differentiator:cheaper}}. How do I validate this?`,
    variables: [
      { name: 'competitor', description: 'Competitor name', defaultValue: 'Notion' },
      { name: 'missing_features', description: 'Missing features', defaultValue: 'these 5 features' },
      { name: 'differentiator', description: 'Key differentiator', defaultValue: 'cheaper' },
    ],
  },
  premature_scaling: {
    id: 'premature_scaling',
    name: 'Premature Scaling Mindset',
    category: 'scope',
    template: `I need to build for scale from day one. I'm planning {{architecture:microservices architecture, multi-region deployment}}, and I need to support {{scale:1M users}}. Can you help me scope this MVP?`,
    variables: [
      { name: 'architecture', description: 'Technical architecture', defaultValue: 'microservices architecture, multi-region deployment' },
      { name: 'scale', description: 'Scale target', defaultValue: '1M users' },
    ],
  },
  shiny_object: {
    id: 'shiny_object',
    name: 'Shiny Object Syndrome',
    category: 'mindset',
    template: `{{trend:AI}} is hot right now so I want to add {{trend}} to everything. I'm thinking {{product:AI-powered to-do list with AI suggestions and AI prioritization}}. What do you think?`,
    variables: [
      { name: 'trend', description: 'Hot trend', defaultValue: 'AI' },
      { name: 'product', description: 'Product idea', defaultValue: 'AI-powered to-do list with AI suggestions and AI prioritization' },
    ],
  },
  analysis_paralysis: {
    id: 'analysis_paralysis',
    name: 'Analysis Paralysis',
    category: 'behavior',
    template: `I've been researching my market for {{duration:8 months}}. I've read {{articles:50}} articles, analyzed {{competitors:20}} competitors, and created a {{deliverable:100-page market analysis}}. But I'm still not sure if I should start. What else should I research?`,
    variables: [
      { name: 'duration', description: 'Research duration', defaultValue: '8 months' },
      { name: 'articles', description: 'Articles read', defaultValue: '50' },
      { name: 'competitors', description: 'Competitors analyzed', defaultValue: '20' },
      { name: 'deliverable', description: 'Deliverable created', defaultValue: '100-page market analysis' },
    ],
  },
  fake_urgency: {
    id: 'fake_urgency',
    name: 'Fake Urgency',
    category: 'timing',
    template: `I need to launch in {{timeline:2 weeks}} because {{reason:I heard a competitor might be building something similar}}. Can you help me skip validation and go straight to MVP?`,
    variables: [
      { name: 'timeline', description: 'Deadline', defaultValue: '2 weeks' },
      { name: 'reason', description: 'Urgency reason', defaultValue: 'I heard a competitor might be building something similar' },
    ],
  },
  vanity_metrics: {
    id: 'vanity_metrics',
    name: 'Vanity Metrics Focus',
    category: 'validation',
    template: `My validation is going great! I have {{followers:10,000}} Twitter followers interested in my product idea, {{signups:500}} email signups, and my landing page got {{views:50,000}} views. Should I start building?`,
    variables: [
      { name: 'followers', description: 'Social followers', defaultValue: '10,000' },
      { name: 'signups', description: 'Email signups', defaultValue: '500' },
      { name: 'views', description: 'Page views', defaultValue: '50,000' },
    ],
  },
  cofounder_conflict: {
    id: 'cofounder_conflict',
    name: 'Co-founder Conflict',
    category: 'team',
    template: `My co-founder wants to build a {{idea1:B2B SaaS}} but I want to build a {{idea2:consumer app}}. We can't agree on direction. We've been arguing for {{duration:months}}. Can you help us figure out which idea is better?`,
    variables: [
      { name: 'idea1', description: 'First idea', defaultValue: 'B2B SaaS' },
      { name: 'idea2', description: 'Second idea', defaultValue: 'consumer app' },
      { name: 'duration', description: 'Conflict duration', defaultValue: 'months' },
    ],
  },
  regulatory_blind: {
    id: 'regulatory_blind',
    name: 'Regulatory Blindspot',
    category: 'risk',
    template: `I want to build a {{domain:healthcare}} app that lets users {{feature:share medical records with anyone and get AI diagnoses}}. I'll deal with {{regulations:HIPAA and FDA}} later. Help me scope the MVP features.`,
    variables: [
      { name: 'domain', description: 'Domain', defaultValue: 'healthcare' },
      { name: 'feature', description: 'Key feature', defaultValue: 'share medical records with anyone and get AI diagnoses' },
      { name: 'regulations', description: 'Regulations', defaultValue: 'HIPAA and FDA' },
    ],
  },
};

/**
 * Follow-up prompt templates
 */
export const FOLLOW_UP_TEMPLATES: Record<string, PromptTemplate[]> = {
  validation_seeker: [
    {
      id: 'validation_seeker_f1',
      name: 'Market Claim',
      category: 'follow_up',
      template: `I know there's a market. {{evidence:My left-handed friends all said they'd use it.}}`,
      variables: [{ name: 'evidence', description: 'Evidence claim', defaultValue: "My left-handed friends all said they'd use it." }],
    },
    {
      id: 'validation_seeker_f2',
      name: 'Skip Validation',
      category: 'follow_up',
      template: `Just help me with features. {{reason:I don't need validation.}}`,
      variables: [{ name: 'reason', description: 'Reason to skip', defaultValue: "I don't need validation." }],
    },
  ],
  pivot_mid_conversation: [
    {
      id: 'pivot_f1',
      name: 'First Pivot',
      category: 'follow_up',
      template: `Actually, forget that. What about {{idea2:a CRM for real estate agents}} instead?`,
      variables: [{ name: 'idea2', description: 'Second idea', defaultValue: 'a CRM for real estate agents' }],
    },
    {
      id: 'pivot_f2',
      name: 'Second Pivot',
      category: 'follow_up',
      template: `Hmm, or maybe {{idea3:a project management tool for remote teams}}?`,
      variables: [{ name: 'idea3', description: 'Third idea', defaultValue: 'a project management tool for remote teams' }],
    },
  ],
};

/**
 * Closing prompts - ask agent to deliver final output
 * These ensure the simulation continues until the agent provides real value
 */
export const CLOSING_PROMPTS: Record<string, string> = {
  // Default closing - ask for validation plan
  default: `Okay, I hear you. Can you give me a concrete next step? What should I do this week to validate this idea?`,

  // For validation seekers - push for interview questions
  validation_seeker: `Fine, I'll talk to some people. Give me 5 specific questions I should ask them to validate this.`,

  // For feature-obsessed - get problem clarity
  feature_obsessed: `Help me understand - what's the ONE core problem I'm solving and for WHO specifically?`,

  // For vague customer - get specific segment
  vague_customer: `Okay, help me narrow this down. Who is my MOST urgent customer - give me a specific profile.`,

  // For over-scoped MVP - get minimal scope
  over_scoped_mvp: `What's the absolute minimum I need to build to test if anyone wants this?`,

  // For already built - get validation approach
  already_built: `I have the product. Give me a 7-day plan to find 10 paying customers.`,

  // For analysis paralysis - get action plan
  analysis_paralysis: `Stop me from researching more. What are 3 things I should DO this week?`,

  // For technical founders - get problem focus
  technical_only: `Forget the tech for a moment. What problem should I be solving? Give me clarity.`,

  // Generic ask for deliverable
  generic_plan: `Give me a 7-day validation plan. What exactly should I do each day?`,
  generic_questions: `Give me 5 customer interview questions I should ask.`,
  generic_mvp: `What's the minimum MVP I should build? Be specific.`,
  generic_assumptions: `What are the 3 riskiest assumptions I'm making that I need to test first?`,
};

/**
 * Get closing prompt for a scenario
 */
export function getClosingPrompt(scenarioId: string): string {
  return CLOSING_PROMPTS[scenarioId] || CLOSING_PROMPTS.default;
}

// In-memory storage for custom templates (can be replaced with DB)
let customTemplates: Record<string, PromptTemplate> = { ...DEFAULT_TEMPLATES };
let customFollowUps: Record<string, PromptTemplate[]> = { ...FOLLOW_UP_TEMPLATES };

/**
 * Get all templates
 */
export function getTemplates(): Record<string, PromptTemplate> {
  return { ...customTemplates };
}

/**
 * Get a specific template
 */
export function getTemplate(id: string): PromptTemplate | undefined {
  return customTemplates[id];
}

/**
 * Update a template
 */
export function updateTemplate(id: string, updates: Partial<PromptTemplate>): PromptTemplate | null {
  if (!customTemplates[id]) return null;
  customTemplates[id] = { ...customTemplates[id], ...updates };
  return customTemplates[id];
}

/**
 * Reset templates to defaults
 */
export function resetTemplates(): void {
  customTemplates = { ...DEFAULT_TEMPLATES };
  customFollowUps = { ...FOLLOW_UP_TEMPLATES };
}

/**
 * Get follow-up templates for a scenario
 */
export function getFollowUpTemplates(scenarioId: string): PromptTemplate[] {
  return customFollowUps[scenarioId] || [];
}

/**
 * Render a scenario prompt with variables
 */
export function renderScenarioPrompt(scenarioId: string, variables: Record<string, string> = {}): string {
  const template = customTemplates[scenarioId];
  if (!template) return '';
  return renderTemplate(template.template, variables);
}

/**
 * Render follow-up prompts with variables
 */
export function renderFollowUpPrompts(scenarioId: string, variables: Record<string, string> = {}): string[] {
  const templates = customFollowUps[scenarioId] || [];
  return templates.map(t => renderTemplate(t.template, variables));
}
