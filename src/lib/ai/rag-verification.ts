import Ajv from 'ajv'
import { InstructionJSON, ContextRef } from './instruction-json'
import { RagChunk } from './rag-adapter'

// JSON Schema for instruction validation
const instructionSchema = {
  type: 'object',
  required: ['task', 'inputs', 'context_refs', 'policies', 'telemetry'],
  properties: {
    task: { type: 'string' },
    inputs: { type: 'object' },
    context_refs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'id', 'why'],
        properties: {
          type: { type: 'string', enum: ['doc', 'web'] },
          id: { type: 'string' },
          anchor: { type: 'string' },
          why: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 1 }
        }
      }
    },
    policies: {
      type: 'object',
      required: ['cite_every_claim', 'no_external_sources'],
      properties: {
        cite_every_claim: { type: 'boolean' },
        no_external_sources: { type: 'boolean' },
        max_tokens: { type: 'number', minimum: 1 },
        format: { type: 'string', enum: ['text', 'markdown', 'html'] }
      }
    },
    telemetry: {
      type: 'object',
      required: ['route_conf', 'rag_conf', 'coverage', 'total_tokens'],
      properties: {
        route_conf: { type: 'number', minimum: 0, maximum: 1 },
        rag_conf: { type: 'number', minimum: 0, maximum: 1 },
        coverage: { type: 'number', minimum: 0, maximum: 1 },
        total_tokens: { type: 'number', minimum: 0 }
      }
    }
  }
}

const ajv = new Ajv()
const validateInstruction = ajv.compile(instructionSchema)

export interface VerificationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  citationsValid: boolean
  coverageAdequate: boolean
}

export interface VerificationOptions {
  checkChunkHash?: boolean
  requireMinCoverage?: boolean
  minCoverageThreshold?: number
  maxRepairAttempts?: number
}

/**
 * Verify instruction JSON and citations
 */
export async function verifyInstruction(
  instruction: InstructionJSON,
  availableChunks: RagChunk[],
  options: VerificationOptions = {}
): Promise<VerificationResult> {
  const {
    checkChunkHash = true,
    requireMinCoverage = true,
    minCoverageThreshold = 0.5,
    maxRepairAttempts = 1
  } = options

  const result: VerificationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    citationsValid: true,
    coverageAdequate: true
  }

  try {
    // 1. Validate JSON schema
    const schemaValid = validateInstruction(instruction)
    if (!schemaValid) {
      result.isValid = false
      result.errors.push(`Schema validation failed: ${ajv.errorsText(validateInstruction.errors)}`)
    }

    // 2. Verify citations
    const citationResult = await verifyCitations(instruction.context_refs, availableChunks, checkChunkHash)
    result.citationsValid = citationResult.isValid
    if (!citationResult.isValid) {
      result.errors.push(...citationResult.errors)
    }
    result.warnings.push(...citationResult.warnings)

    // 3. Check coverage
    const coverageResult = checkCoverage(instruction, minCoverageThreshold)
    result.coverageAdequate = coverageResult.adequate
    
    // For writing tasks, be more lenient with coverage requirements
    const isWritingTask = instruction.task === 'write' || ['create', 'generate', 'compose', 'draft', 'report', 'document'].some(task => 
      instruction.task.toLowerCase().includes(task)
    )
    
    if (!coverageResult.adequate && requireMinCoverage && !isWritingTask) {
      result.errors.push(`Inadequate coverage: ${coverageResult.coverage.toFixed(2)} < ${minCoverageThreshold}`)
    } else if (!coverageResult.adequate && isWritingTask) {
      result.warnings.push(`Low coverage for writing task: ${coverageResult.coverage.toFixed(2)} < ${minCoverageThreshold} (using web sources)`)
    }

    // 4. Check for factual tasks with single domain
    const domainResult = checkDomainDiversity(instruction)
    if (!domainResult.diverse && ['fact_check', 'summarize'].includes(instruction.task)) {
      result.warnings.push('Only one domain in context for factual task - consider expanding web search')
    }

    // Overall validity
    result.isValid = result.isValid && result.citationsValid && (result.coverageAdequate || !requireMinCoverage || isWritingTask)

  } catch (error) {
    result.isValid = false
    result.errors.push(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return result
}

/**
 * Verify citations against available chunks
 */
async function verifyCitations(
  contextRefs: ContextRef[],
  availableChunks: RagChunk[],
  checkChunkHash: boolean
): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = []
  const warnings: string[] = []
  
  const availableChunkIds = new Set(availableChunks.map(chunk => chunk.id))
  const docRefs = contextRefs.filter(ref => ref.type === 'doc')
  
  // Check if all doc references exist in available chunks
  for (const ref of docRefs) {
    if (!availableChunkIds.has(ref.id)) {
      errors.push(`Citation [${ref.id}] not found in available chunks`)
    }
  }

  // Check for chunk hash drift if enabled
  if (checkChunkHash) {
    for (const ref of docRefs) {
      const chunk = availableChunks.find(c => c.id === ref.id)
      if (chunk) {
        // In a real implementation, you'd check content hash here
        // For now, we'll just check if the chunk exists and has content
        if (!chunk.text || chunk.text.trim().length === 0) {
          warnings.push(`Citation [${ref.id}] has empty or invalid content`)
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Check if coverage is adequate
 */
function checkCoverage(instruction: InstructionJSON, threshold: number): {
  adequate: boolean
  coverage: number
} {
  const coverage = instruction.telemetry.coverage
  return {
    adequate: coverage >= threshold,
    coverage
  }
}

/**
 * Check domain diversity for factual tasks
 */
function checkDomainDiversity(instruction: InstructionJSON): {
  diverse: boolean
  domainCount: number
} {
  const docRefs = instruction.context_refs.filter(ref => ref.type === 'doc')
  const webRefs = instruction.context_refs.filter(ref => ref.type === 'web')
  
  // Extract unique domains from doc references (by docId)
  const docDomains = new Set(docRefs.map(ref => ref.id.split('-')[0])) // Assuming docId-chunk format
  
  // Extract unique domains from web references (by URL domain)
  const webDomains = new Set(webRefs.map(ref => {
    try {
      return new URL(ref.id).hostname
    } catch {
      return ref.id // Fallback to full ID if not a valid URL
    }
  }))
  
  const totalDomains = docDomains.size + webDomains.size
  
  return {
    diverse: totalDomains > 1,
    domainCount: totalDomains
  }
}

/**
 * Auto-expand web search for insufficient coverage
 */
export async function autoExpandWeb(
  instruction: InstructionJSON,
  originalQuery: string
): Promise<ContextRef[]> {
  try {
    console.log(`Auto-expanding web search for query: ${originalQuery}`)
    
    // Use native GPT search for auto-expansion
    const contextRefs = await performNativeGPTSearch(originalQuery)
    
    return contextRefs
  } catch (error) {
    console.error('Error in auto-expand web:', error)
    return []
  }
}

/**
 * Perform native GPT search for web information
 */
async function performNativeGPTSearch(query: string): Promise<ContextRef[]> {
  try {
    const { generateChatCompletion } = await import('./openai')
    const { getRoutingModel } = await import('./core/models')
    
    const searchPrompt = `Search for current information about: "${query}"

Provide a comprehensive response with current facts, recent developments, and key information.`

    const response = await generateChatCompletion([
      { role: 'user', content: searchPrompt }
    ], {
      model: getRoutingModel(),
      temperature: 0.3,
      max_tokens: 500
    })

    const content = response.choices[0]?.message?.content?.trim()
    
    if (!content) {
      return []
    }

    // Create context references from the GPT response
    const contextRefs: ContextRef[] = []
    
    // Split content into sections and create references
    const sections = content.split('\n\n').filter(section => section.trim().length > 0)
    
    sections.forEach((section, index) => {
      if (section.trim().length > 20) {
        const lines = section.split('\n')
        const title = lines[0]?.replace(/^#+\s*/, '') || `Search Result ${index + 1}`
        
        contextRefs.push({
          type: 'web',
          id: `gpt-search-${index}`,
          why: title,
          score: 0.9 - (index * 0.1)
        })
      }
    })
    
    return contextRefs.slice(0, 3) // Limit to 3 results
  } catch (error) {
    console.error('Native GPT search error:', error)
    return []
  }
}

/**
 * Validate response against instruction
 */
export function validateResponse(
  response: string,
  instruction: InstructionJSON
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if response cites required sources
  if (instruction.policies.cite_every_claim) {
    const citationPattern = /\[\d+\]/g
    const citations = response.match(citationPattern) || []
    
    if (citations.length === 0) {
      errors.push('Response must include citations but none found')
    }

    // Check if citations reference valid context_refs
    const validRefIndices = instruction.context_refs.map((_, index) => index + 1)
    const foundRefIndices = citations.map(c => parseInt(c.replace(/[\[\]]/g, '')))
    
    const invalidCitations = foundRefIndices.filter(index => !validRefIndices.includes(index))
    if (invalidCitations.length > 0) {
      errors.push(`Invalid citations found: [${invalidCitations.join(', ')}]`)
    }
  }

  // Check token limits
  const responseTokens = Math.ceil(response.length / 4)
  if (instruction.policies.max_tokens && responseTokens > instruction.policies.max_tokens) {
    warnings.push(`Response exceeds token limit: ${responseTokens} > ${instruction.policies.max_tokens}`)
  }

  // Check format compliance
  if (instruction.policies.format === 'markdown' && !response.includes('#')) {
    warnings.push('Response should be in markdown format but no headers found')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Generate verification report
 */
export function generateVerificationReport(
  instruction: InstructionJSON,
  verificationResult: VerificationResult,
  responseValidation?: { isValid: boolean; errors: string[]; warnings: string[] }
): string {
  let report = `# Verification Report\n\n`
  
  report += `## Instruction Validation\n`
  report += `- Valid: ${verificationResult.isValid ? '✅' : '❌'}\n`
  report += `- Citations Valid: ${verificationResult.citationsValid ? '✅' : '❌'}\n`
  report += `- Coverage Adequate: ${verificationResult.coverageAdequate ? '✅' : '❌'}\n\n`

  if (verificationResult.errors.length > 0) {
    report += `## Errors\n`
    verificationResult.errors.forEach(error => {
      report += `- ❌ ${error}\n`
    })
    report += '\n'
  }

  if (verificationResult.warnings.length > 0) {
    report += `## Warnings\n`
    verificationResult.warnings.forEach(warning => {
      report += `- ⚠️ ${warning}\n`
    })
    report += '\n'
  }

  if (responseValidation) {
    report += `## Response Validation\n`
    report += `- Valid: ${responseValidation.isValid ? '✅' : '❌'}\n`
    
    if (responseValidation.errors.length > 0) {
      report += `### Response Errors\n`
      responseValidation.errors.forEach(error => {
        report += `- ❌ ${error}\n`
      })
    }
    
    if (responseValidation.warnings.length > 0) {
      report += `### Response Warnings\n`
      responseValidation.warnings.forEach(warning => {
        report += `- ⚠️ ${warning}\n`
      })
    }
  }

  report += `\n## Telemetry\n`
  report += `- Route Confidence: ${instruction.telemetry.route_conf.toFixed(2)}\n`
  report += `- RAG Confidence: ${instruction.telemetry.rag_conf.toFixed(2)}\n`
  report += `- Coverage: ${instruction.telemetry.coverage.toFixed(2)}\n`
  report += `- Total Tokens: ${instruction.telemetry.total_tokens}\n`

  return report
}
