/**
 * Semantic Template Library for Intent Routing
 * Each template defines an intent with examples, schema, and guardrails
 */

export interface Template {
  id: string
  name: string
  definition: string
  ioSchema: object
  guardrails: string[]
  examples: Array<{
    ask: string
    instruction: object
  }>
  preconditions?: string[]
  qualityChecks?: string[]
}

export const TEMPLATES: Template[] = [
  {
    id: 'rewrite',
    name: 'Rewrite Content',
    definition: 'Improve, enhance, or rewrite existing text content for better clarity, style, or quality',
    ioSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', const: 'rewrite' },
        inputs: {
          type: 'object',
          properties: {
            target_text: { type: 'string', description: 'The text to be rewritten' },
            style: {
              type: 'object',
              properties: {
                tone: { type: 'string', enum: ['formal', 'casual', 'professional', 'creative', 'academic'] },
                grade_level: { type: 'string', description: 'Target reading level' },
                voice: { type: 'string', description: 'Author voice to maintain' }
              }
            },
            constraints: {
              type: 'object',
              properties: {
                max_words: { type: 'number' },
                min_words: { type: 'number' },
                preserve_key_points: { type: 'boolean' },
                maintain_structure: { type: 'boolean' }
              }
            }
          },
          required: ['target_text']
        },
        context_refs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              doc_id: { type: 'string' },
              anchor: { type: 'string' },
              why: { type: 'string' }
            }
          }
        }
      },
      required: ['task', 'inputs']
    },
    guardrails: [
      'Preserve the core meaning and key information',
      'Maintain appropriate tone and voice',
      'Ensure output is grammatically correct',
      'Respect word count constraints if specified',
      'Keep the same document structure unless requested otherwise'
    ],
    examples: [
      {
        ask: 'Make this paragraph more professional',
        instruction: {
          task: 'rewrite',
          inputs: {
            target_text: 'The selected paragraph text',
            style: { tone: 'professional', grade_level: '12' },
            constraints: { preserve_key_points: true, maintain_structure: true }
          },
          context_refs: []
        }
      },
      {
        ask: 'Rewrite this to be more concise',
        instruction: {
          task: 'rewrite',
          inputs: {
            target_text: 'The selected text',
            style: { tone: 'formal' },
            constraints: { max_words: 100, preserve_key_points: true }
          },
          context_refs: []
        }
      }
    ]
  },
  {
    id: 'summarize',
    name: 'Summarize Content',
    definition: 'Create a concise summary of longer content, extracting key points and main ideas',
    ioSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', const: 'summarize' },
        inputs: {
          type: 'object',
          properties: {
            target_text: { type: 'string', description: 'The content to summarize' },
            summary_type: { type: 'string', enum: ['brief', 'detailed', 'executive', 'academic'] },
            length: { type: 'string', enum: ['short', 'medium', 'long'] },
            focus_areas: { type: 'array', items: { type: 'string' } },
            constraints: {
              type: 'object',
              properties: {
                max_sentences: { type: 'number' },
                include_bullet_points: { type: 'boolean' },
                preserve_quotes: { type: 'boolean' }
              }
            }
          },
          required: ['target_text']
        },
        context_refs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              doc_id: { type: 'string' },
              anchor: { type: 'string' },
              why: { type: 'string' }
            }
          }
        }
      },
      required: ['task', 'inputs']
    },
    guardrails: [
      'Capture all essential information and key points',
      'Maintain accuracy and avoid adding new information',
      'Use clear, concise language',
      'Preserve important quotes or data when relevant',
      'Structure the summary logically'
    ],
    examples: [
      {
        ask: 'Summarize this section',
        instruction: {
          task: 'summarize',
          inputs: {
            target_text: 'The selected section text',
            summary_type: 'brief',
            length: 'medium',
            constraints: { max_sentences: 3, include_bullet_points: false }
          },
          context_refs: []
        }
      },
      {
        ask: 'Give me a bullet point summary',
        instruction: {
          task: 'summarize',
          inputs: {
            target_text: 'The selected content',
            summary_type: 'executive',
            length: 'short',
            constraints: { include_bullet_points: true }
          },
          context_refs: []
        }
      }
    ]
  },
  {
    id: 'outline',
    name: 'Create Outline',
    definition: 'Generate a structured outline or table of contents from content or topic',
    ioSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', const: 'outline' },
        inputs: {
          type: 'object',
          properties: {
            target_text: { type: 'string', description: 'Content to outline or topic to structure' },
            outline_type: { type: 'string', enum: ['hierarchical', 'flat', 'numbered', 'bulleted'] },
            depth: { type: 'number', minimum: 1, maximum: 6 },
            include_descriptions: { type: 'boolean' },
            focus_areas: { type: 'array', items: { type: 'string' } }
          },
          required: ['target_text']
        },
        context_refs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              doc_id: { type: 'string' },
              anchor: { type: 'string' },
              why: { type: 'string' }
            }
          }
        }
      },
      required: ['task', 'inputs']
    },
    guardrails: [
      'Create logical, hierarchical structure',
      'Use clear, descriptive headings',
      'Maintain consistent formatting',
      'Ensure all major topics are covered',
      'Follow standard outline conventions'
    ],
    examples: [
      {
        ask: 'Create an outline for this content',
        instruction: {
          task: 'outline',
          inputs: {
            target_text: 'The selected content',
            outline_type: 'hierarchical',
            depth: 3,
            include_descriptions: true
          },
          context_refs: []
        }
      },
      {
        ask: 'Make a bullet point outline',
        instruction: {
          task: 'outline',
          inputs: {
            target_text: 'The content to outline',
            outline_type: 'bulleted',
            depth: 2,
            include_descriptions: false
          },
          context_refs: []
        }
      }
    ]
  },
  {
    id: 'extend',
    name: 'Extend Content',
    definition: 'Add more detail, examples, or elaboration to existing content',
    ioSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', const: 'extend' },
        inputs: {
          type: 'object',
          properties: {
            target_text: { type: 'string', description: 'The content to extend' },
            extension_type: { type: 'string', enum: ['examples', 'details', 'explanations', 'analysis', 'all'] },
            length: { type: 'string', enum: ['short', 'medium', 'long'] },
            style: {
              type: 'object',
              properties: {
                tone: { type: 'string', enum: ['formal', 'casual', 'professional', 'academic'] },
                voice: { type: 'string', description: 'Maintain existing voice' }
              }
            },
            constraints: {
              type: 'object',
              properties: {
                max_additional_words: { type: 'number' },
                include_citations: { type: 'boolean' },
                maintain_flow: { type: 'boolean' }
              }
            }
          },
          required: ['target_text']
        },
        context_refs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              doc_id: { type: 'string' },
              anchor: { type: 'string' },
              why: { type: 'string' }
            }
          }
        }
      },
      required: ['task', 'inputs']
    },
    guardrails: [
      'Maintain the original tone and style',
      'Add relevant, valuable content',
      'Ensure smooth transitions and flow',
      'Avoid redundancy or repetition',
      'Keep additions focused and coherent'
    ],
    examples: [
      {
        ask: 'Add more examples to this section',
        instruction: {
          task: 'extend',
          inputs: {
            target_text: 'The selected text',
            extension_type: 'examples',
            length: 'medium',
            constraints: { max_additional_words: 200, maintain_flow: true }
          },
          context_refs: []
        }
      },
      {
        ask: 'Expand this with more details',
        instruction: {
          task: 'extend',
          inputs: {
            target_text: 'The content to expand',
            extension_type: 'details',
            length: 'long',
            style: { tone: 'professional' },
            constraints: { include_citations: true }
          },
          context_refs: []
        }
      }
    ]
  },
  {
    id: 'critique',
    name: 'Critique Content',
    definition: 'Provide constructive feedback, analysis, or evaluation of content quality',
    ioSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', const: 'critique' },
        inputs: {
          type: 'object',
          properties: {
            target_text: { type: 'string', description: 'The content to critique' },
            critique_focus: { type: 'array', items: { type: 'string', enum: ['clarity', 'structure', 'grammar', 'style', 'logic', 'completeness'] } },
            feedback_style: { type: 'string', enum: ['constructive', 'detailed', 'brief', 'academic'] },
            include_suggestions: { type: 'boolean' },
            constraints: {
              type: 'object',
              properties: {
                max_feedback_length: { type: 'number' },
                prioritize_issues: { type: 'boolean' },
                include_examples: { type: 'boolean' }
              }
            }
          },
          required: ['target_text']
        },
        context_refs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              doc_id: { type: 'string' },
              anchor: { type: 'string' },
              why: { type: 'string' }
            }
          }
        }
      },
      required: ['task', 'inputs']
    },
    guardrails: [
      'Provide constructive, helpful feedback',
      'Be specific about issues and improvements',
      'Maintain a professional, supportive tone',
      'Focus on actionable suggestions',
      'Balance criticism with positive observations'
    ],
    examples: [
      {
        ask: 'Critique this paragraph',
        instruction: {
          task: 'critique',
          inputs: {
            target_text: 'The selected paragraph',
            critique_focus: ['clarity', 'structure', 'grammar'],
            feedback_style: 'constructive',
            include_suggestions: true,
            constraints: { include_examples: true }
          },
          context_refs: []
        }
      },
      {
        ask: 'Review this for grammar and style',
        instruction: {
          task: 'critique',
          inputs: {
            target_text: 'The content to review',
            critique_focus: ['grammar', 'style'],
            feedback_style: 'detailed',
            include_suggestions: true,
            constraints: { prioritize_issues: true }
          },
          context_refs: []
        }
      }
    ]
  },
  {
    id: 'extract',
    name: 'Extract Information',
    definition: 'Pull out specific information, data, or key points from content',
    ioSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', const: 'extract' },
        inputs: {
          type: 'object',
          properties: {
            target_text: { type: 'string', description: 'The content to extract from' },
            extraction_type: { type: 'string', enum: ['key_points', 'data', 'quotes', 'names', 'dates', 'numbers', 'custom'] },
            custom_criteria: { type: 'string', description: 'Specific extraction criteria if custom' },
            format: { type: 'string', enum: ['list', 'table', 'paragraph', 'json'] },
            constraints: {
              type: 'object',
              properties: {
                max_items: { type: 'number' },
                include_context: { type: 'boolean' },
                preserve_formatting: { type: 'boolean' }
              }
            }
          },
          required: ['target_text']
        },
        context_refs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              doc_id: { type: 'string' },
              anchor: { type: 'string' },
              why: { type: 'string' }
            }
          }
        }
      },
      required: ['task', 'inputs']
    },
    guardrails: [
      'Extract only relevant, accurate information',
      'Maintain original meaning and context',
      'Use clear, consistent formatting',
      'Avoid duplication or redundancy',
      'Preserve important details and nuances'
    ],
    examples: [
      {
        ask: 'Extract the key points from this',
        instruction: {
          task: 'extract',
          inputs: {
            target_text: 'The selected content',
            extraction_type: 'key_points',
            format: 'list',
            constraints: { max_items: 5, include_context: true }
          },
          context_refs: []
        }
      },
      {
        ask: 'Pull out all the numbers and data',
        instruction: {
          task: 'extract',
          inputs: {
            target_text: 'The content with data',
            extraction_type: 'data',
            format: 'table',
            constraints: { preserve_formatting: true }
          },
          context_refs: []
        }
      }
    ]
  },
  {
    id: 'fact_check',
    name: 'Fact Check',
    definition: 'Verify facts, claims, or statements against reliable sources',
    ioSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', const: 'fact_check' },
        inputs: {
          type: 'object',
          properties: {
            target_text: { type: 'string', description: 'The content to fact-check' },
            check_scope: { type: 'string', enum: ['all_claims', 'specific_facts', 'statistics', 'quotes', 'dates'] },
            verification_level: { type: 'string', enum: ['basic', 'thorough', 'academic'] },
            include_sources: { type: 'boolean' },
            constraints: {
              type: 'object',
              properties: {
                max_checks: { type: 'number' },
                require_multiple_sources: { type: 'boolean' },
                include_confidence_levels: { type: 'boolean' }
              }
            }
          },
          required: ['target_text']
        },
        context_refs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              doc_id: { type: 'string' },
              anchor: { type: 'string' },
              why: { type: 'string' }
            }
          }
        }
      },
      required: ['task', 'inputs']
    },
    guardrails: [
      'Use reliable, authoritative sources',
      'Clearly distinguish between verified and unverified claims',
      'Provide source citations when available',
      'Indicate confidence levels for uncertain facts',
      'Maintain objectivity and accuracy'
    ],
    examples: [
      {
        ask: 'Fact check this paragraph',
        instruction: {
          task: 'fact_check',
          inputs: {
            target_text: 'The selected paragraph',
            check_scope: 'all_claims',
            verification_level: 'thorough',
            include_sources: true,
            constraints: { require_multiple_sources: true }
          },
          context_refs: []
        }
      }
    ]
  },
  {
    id: 'compare',
    name: 'Compare Content',
    definition: 'Compare two or more pieces of content, concepts, or items',
    ioSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', const: 'compare' },
        inputs: {
          type: 'object',
          properties: {
            target_text: { type: 'string', description: 'Primary content to compare' },
            comparison_text: { type: 'string', description: 'Secondary content to compare against' },
            comparison_aspects: { type: 'array', items: { type: 'string' } },
            format: { type: 'string', enum: ['table', 'paragraph', 'list', 'side_by_side'] },
            include_similarities: { type: 'boolean' },
            include_differences: { type: 'boolean' },
            constraints: {
              type: 'object',
              properties: {
                max_comparison_points: { type: 'number' },
                include_examples: { type: 'boolean' },
                maintain_objectivity: { type: 'boolean' }
              }
            }
          },
          required: ['target_text', 'comparison_text']
        },
        context_refs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              doc_id: { type: 'string' },
              anchor: { type: 'string' },
              why: { type: 'string' }
            }
          }
        }
      },
      required: ['task', 'inputs']
    },
    guardrails: [
      'Maintain objectivity and fairness',
      'Focus on relevant comparison points',
      'Provide balanced analysis',
      'Use clear, structured format',
      'Avoid bias or subjective judgments'
    ],
    examples: [
      {
        ask: 'Compare these two approaches',
        instruction: {
          task: 'compare',
          inputs: {
            target_text: 'First approach',
            comparison_text: 'Second approach',
            comparison_aspects: ['effectiveness', 'cost', 'complexity'],
            format: 'table',
            include_similarities: true,
            include_differences: true
          },
          context_refs: []
        }
      }
    ]
  },
  {
    id: 'plan',
    name: 'Create Plan',
    definition: 'Generate a structured plan, roadmap, or strategy for a task or project',
    ioSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', const: 'plan' },
        inputs: {
          type: 'object',
          properties: {
            target_text: { type: 'string', description: 'The goal or topic to plan for' },
            plan_type: { type: 'string', enum: ['project', 'essay', 'presentation', 'research', 'workflow'] },
            timeline: { type: 'string', enum: ['short', 'medium', 'long', 'flexible'] },
            detail_level: { type: 'string', enum: ['high_level', 'detailed', 'step_by_step'] },
            include_milestones: { type: 'boolean' },
            constraints: {
              type: 'object',
              properties: {
                max_steps: { type: 'number' },
                include_time_estimates: { type: 'boolean' },
                include_resources: { type: 'boolean' }
              }
            }
          },
          required: ['target_text']
        },
        context_refs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              doc_id: { type: 'string' },
              anchor: { type: 'string' },
              why: { type: 'string' }
            }
          }
        }
      },
      required: ['task', 'inputs']
    },
    guardrails: [
      'Create logical, sequential steps',
      'Include realistic time estimates',
      'Consider dependencies and prerequisites',
      'Make steps actionable and specific',
      'Include checkpoints and milestones'
    ],
    examples: [
      {
        ask: 'Create a plan for this project',
        instruction: {
          task: 'plan',
          inputs: {
            target_text: 'Project description',
            plan_type: 'project',
            timeline: 'medium',
            detail_level: 'detailed',
            include_milestones: true,
            constraints: { include_time_estimates: true, include_resources: true }
          },
          context_refs: []
        }
      }
    ]
  },
  {
    id: 'reference_insert',
    name: 'Insert Reference',
    definition: 'Add citations, references, or source attributions to content',
    ioSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', const: 'reference_insert' },
        inputs: {
          type: 'object',
          properties: {
            target_text: { type: 'string', description: 'The content to add references to' },
            reference_type: { type: 'string', enum: ['academic', 'web', 'book', 'article', 'mixed'] },
            citation_style: { type: 'string', enum: ['apa', 'mla', 'chicago', 'harvard', 'ieee'] },
            include_bibliography: { type: 'boolean' },
            constraints: {
              type: 'object',
              properties: {
                max_references: { type: 'number' },
                require_doi: { type: 'boolean' },
                include_page_numbers: { type: 'boolean' }
              }
            }
          },
          required: ['target_text']
        },
        context_refs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              doc_id: { type: 'string' },
              anchor: { type: 'string' },
              why: { type: 'string' }
            }
          }
        }
      },
      required: ['task', 'inputs']
    },
    guardrails: [
      'Use appropriate citation format',
      'Ensure all claims are properly cited',
      'Maintain consistent citation style',
      'Include complete bibliographic information',
      'Verify reference accuracy'
    ],
    examples: [
      {
        ask: 'Add proper citations to this',
        instruction: {
          task: 'reference_insert',
          inputs: {
            target_text: 'The content needing citations',
            reference_type: 'academic',
            citation_style: 'apa',
            include_bibliography: true,
            constraints: { require_doi: true }
          },
          context_refs: []
        }
      }
    ]
  }
]

/**
 * Get template by ID
 */
export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find(template => template.id === id)
}

/**
 * Get all template IDs
 */
export function getAllTemplateIds(): string[] {
  return TEMPLATES.map(template => template.id)
}

/**
 * Get template names for display
 */
export function getTemplateNames(): Array<{id: string, name: string}> {
  return TEMPLATES.map(template => ({ id: template.id, name: template.name }))
}
