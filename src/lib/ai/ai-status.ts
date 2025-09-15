// AI Status monitoring utilities

export interface AIStatus {
  isHealthy: boolean
  lastCheck: Date
  services: {
    openai: boolean
    pinecone: boolean
    langgraph: boolean
  }
  errors: string[]
}

export async function checkAIStatus(): Promise<AIStatus> {
  const status: AIStatus = {
    isHealthy: true,
    lastCheck: new Date(),
    services: {
      openai: false,
      pinecone: false,
      langgraph: false
    },
    errors: []
  }

  // Check OpenAI
  try {
    // Simple check - if we can import the module, it's available
    const { ChatOpenAI } = await import('@langchain/openai')
    status.services.openai = true
  } catch (error) {
    status.errors.push('OpenAI service unavailable')
    status.isHealthy = false
  }

  // Check Pinecone
  try {
    const { Pinecone } = await import('@pinecone-database/pinecone')
    status.services.pinecone = true
  } catch (error) {
    status.errors.push('Pinecone service unavailable')
    status.isHealthy = false
  }

  // Check LangGraph
  try {
    const { StateGraph } = await import('@langchain/langgraph')
    status.services.langgraph = true
  } catch (error) {
    status.errors.push('LangGraph service unavailable')
    status.isHealthy = false
  }

  return status
}

export function getAIStatusMessage(status: AIStatus): string {
  if (status.isHealthy) {
    return 'All AI services are operational'
  }

  const unavailableServices = Object.entries(status.services)
    .filter(([_, isAvailable]) => !isAvailable)
    .map(([service, _]) => service)

  return `AI services unavailable: ${unavailableServices.join(', ')}`
}
