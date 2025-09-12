import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { message = 'who is brian chesky' } = body

        console.log('Testing query detection with message:', message)

        // Copy the isGeneralKnowledgeQuery function for testing
        function isGeneralKnowledgeQuery(message: string): boolean {
            const generalKnowledgePatterns = [
                /^who is/i,
                /^what is/i,
                /^when did/i,
                /^where is/i,
                /^how does/i,
                /^why did/i,
                /^tell me about/i,
                /^explain/i,
                /^define/i,
                /^describe/i,
                /^what are/i,
                /^who are/i,
                /^when was/i,
                /^where are/i,
                /^how are/i,
                /^why are/i,
                /^can you tell me/i,
                /^do you know/i,
                /^what do you know about/i,
                /^who was/i,
                /^what was/i,
                /^when was/i,
                /^where was/i,
                /^how was/i,
                /^why was/i
            ]

            const messageLower = message.toLowerCase().trim()
            
            // Check for general knowledge patterns
            for (const pattern of generalKnowledgePatterns) {
                if (pattern.test(messageLower)) {
                    return true
                }
            }

            // Check for specific entity types that are likely general knowledge
            const entityPatterns = [
                /\b(celebrity|person|politician|actor|musician|scientist|inventor|author|artist)\b/i,
                /\b(company|corporation|organization|brand|product)\b/i,
                /\b(place|city|country|state|continent|landmark)\b/i,
                /\b(event|war|battle|discovery|invention|movement)\b/i,
                /\b(concept|theory|principle|law|rule|method)\b/i,
                /\b(technology|software|platform|service|tool)\b/i
            ]

            for (const pattern of entityPatterns) {
                if (pattern.test(messageLower)) {
                    return true
                }
            }

            return false
        }

        const isGeneralQuery = isGeneralKnowledgeQuery(message)
        const messageLower = message.toLowerCase().trim()

        // Test individual patterns
        const patternTests = {
            'who is': /^who is/i.test(messageLower),
            'what is': /^what is/i.test(messageLower),
            'who was': /^who was/i.test(messageLower),
            'person': /\b(celebrity|person|politician|actor|musician|scientist|inventor|author|artist)\b/i.test(messageLower)
        }

        return NextResponse.json({
            success: true,
            message,
            messageLower,
            isGeneralQuery,
            patternTests,
            detectedPatterns: Object.entries(patternTests).filter(([_, match]) => match).map(([pattern, _]) => pattern)
        })
    } catch (error) {
        console.error('Query detection test error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Query detection test failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
