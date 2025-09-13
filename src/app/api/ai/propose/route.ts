import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateChatCompletion, ChatMessage } from "@/lib/ai/openai";
import { AiEditRequest, ProposeResponse, EditProposal } from "@/types";

export async function POST(req: NextRequest) {
    try {
        console.log('Propose API called');
        const session = await getServerSession(authOptions);
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const body = await req.json() as AiEditRequest;
        console.log('Propose API body:', body);
        const { docId, scope, selection, intent, docHtml, originalMessage } = body;

        if (!docId || !scope || !intent) {
            return NextResponse.json(
                { error: "Missing required fields: docId, scope, intent" },
                { status: 400 }
            )
        }

        // Build the system prompt for precise editing
        const systemPrompt = `You are a precise document editor. You can either improve existing content or create new content based on user requests.

CRITICAL: When the user asks you to write content about a specific topic (like "write an essay about Y Combinator"), you MUST generate the actual, comprehensive content about that topic. Do NOT generate placeholder text like "Content to be inserted" or "Content to be written here".

For writing requests (like "write an essay about X"), generate comprehensive, well-structured content about the specific topic mentioned.
For editing requests (like "improve this text"), enhance the existing content.

IMPORTANT JSON FORMATTING RULES:
1. All text content must be properly escaped for JSON
2. Use \\n for line breaks, not actual newlines
3. Escape all quotes with \\"
4. Keep the JSON structure valid

Output one JSON object:
- Prefer { "kind": "pm-steps", "steps": [...] } containing valid ProseMirror step JSON.
- If steps are not possible, return { "kind": "text-diff", "hunks": [...] } with absolute positions.
- Include a light { "summary": { "blocksTouched": n, "wordsAdded": x, "wordsRemoved": y, "notes": [...] } }.

For text-diff hunks, use this format:
{
  "kind": "text-diff",
  "hunks": [
    {
      "oldStart": 0,
      "oldEnd": 5,
      "newStart": 0,
      "newEnd": 13,
      "lines": [
        { "type": "delete", "text": "old content\\n" },
        { "type": "insert", "text": "ACTUAL CONTENT ABOUT THE TOPIC WITH PROPER JSON ESCAPING\\n" }
      ]
    }
  ],
  "summary": {
    "blocksTouched": 1,
    "wordsAdded": 10,
    "wordsRemoved": 5,
    "notes": ["Description of changes"]
  }
}

IMPORTANT: Replace "ACTUAL CONTENT ABOUT THE TOPIC WITH PROPER JSON ESCAPING" with the real content about the specific topic the user requested. If they ask for an essay about Y Combinator, write a real essay about Y Combinator. Make sure all quotes are escaped as \\" and newlines are \\n.

Return ONLY the JSON object, no prose.`;

        // Build user prompt based on scope and content
        const contentToEdit = docHtml || '';
        const scopeDescription = scope === 'selection' ? 'selected text' : 'document';
        const selectionInfo = selection ? ` (positions ${selection.from}-${selection.to})` : '';
        
        const userPrompt = `User's original request: "${originalMessage || intent}"

Current ${scopeDescription} content:
---
${contentToEdit}
---

CRITICAL INSTRUCTIONS:
1. If the user asks you to "write an essay about Y Combinator", you MUST generate a real, comprehensive essay about Y Combinator - not placeholder text.
2. If the user asks you to "write about [any topic]", you MUST generate actual content about that specific topic.
3. Do NOT generate placeholder text like "Content to be inserted" or "Content to be written here".
4. Generate real, substantive content that directly addresses the user's request.

Example: If the user says "Write an essay about Y Combinator", generate an actual essay with:
- Introduction about Y Combinator
- History and founding
- Business model and approach
- Notable companies and success stories
- Impact on startup ecosystem
- Conclusion

Return your response as a JSON object with the exact structure specified in the system prompt, but replace any placeholder text with the actual content about the requested topic.`;

        const messages: ChatMessage[] = [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userPrompt
            }
        ];

        console.log('Sending to AI:', {
            systemPrompt: systemPrompt.substring(0, 200) + '...',
            userPrompt: userPrompt.substring(0, 200) + '...'
        });

        // Generate AI response
        const response = await generateChatCompletion(messages, {
            model: process.env.OPENAI_CHAT_MODEL || 'gpt-4',
            temperature: 0.3,
            max_tokens: 4000,
            useWebSearch: false
        });

        const aiResponse = response.choices[0]?.message?.content || '';
        
        // Parse AI response to extract proposal
        const proposal = parseEditProposal(aiResponse);
        
        // Mint proposalId and return
        const proposalId = crypto.randomUUID();
        
        return NextResponse.json({ 
            proposalId, 
            proposal 
        } satisfies ProposeResponse);

    } catch (error) {
        console.error('AI propose API error:', error);
        return NextResponse.json(
            { error: "Failed to process edit proposal" },
            { status: 500 }
        );
    }
}

/**
 * Parse AI response to extract edit proposal
 */
function parseEditProposal(aiResponse: string): EditProposal {
    try {
        console.log('Parsing AI edit proposal response:', aiResponse);
        
        // Try to extract JSON from the response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in AI response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        console.log('Parsed edit proposal:', parsed);

        // Validate and return the proposal
        if (parsed.kind === 'pm-steps' && parsed.steps) {
            return {
                kind: 'pm-steps',
                steps: parsed.steps,
                summary: parsed.summary
            };
        } else if (parsed.kind === 'text-diff' && parsed.hunks) {
            return {
                kind: 'text-diff',
                hunks: parsed.hunks,
                summary: parsed.summary
            };
        } else {
            throw new Error('Invalid proposal format');
        }

    } catch (error) {
        console.error('Failed to parse edit proposal:', error);
        
        // Fallback: create a simple text-diff proposal
        return {
            kind: 'text-diff',
            hunks: [],
            summary: {
                blocksTouched: 0,
                wordsAdded: 0,
                wordsRemoved: 0,
                notes: ['Failed to parse AI response, no changes made']
            }
        };
    }
}
