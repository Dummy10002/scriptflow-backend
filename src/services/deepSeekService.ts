import axios from 'axios';
import { logger } from '../utils/logger';

interface DeepSeekMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class DeepSeekService {
    private apiKey: string;
    private baseUrl: string = 'https://api.deepseek.com/chat/completions'; // Compatible with standard DeepSeek V3

    constructor() {
        this.apiKey = process.env.DEEPSEEK_API_KEY || '';
        if (!this.apiKey) {
            logger.warn('DEEPSEEK_API_KEY is not set. DeepSeek service will fail if called.');
        }
    }

    async refineScript(rawScript: string, userIdea: string, archetype: string, toneWords: string[]): Promise<string> {
        if (!this.apiKey) {
            logger.warn('Skipping DeepSeek refinement: No API Key.');
            return rawScript;
        }

        const systemPrompt = `
You are a World-Class Viral Scriptwriter (Top 1% on Reel/TikTok).
Your goal is to take a rough script and rewrite it to be insanely engaging, punchy, and human.

Archetype: ${archetype}
Tone: ${toneWords.join(', ')}

RULES:
1. **Hook Mastery**: The first line must stop the scroll. Make it controversial, surprising, or value-packed.
2. **Visuals**: Keep visual cues in (parentheses) but make them exciting.
3. **Format**: Maintain the [HOOK], [BODY], [CTA] structure.
4. **No Fluff**: Delete "In this video", "Hello guys". Just start.
5. **Humanity**: Use slang if it fits. Use short sentences. Break grammar rules for effect.

STRICT OUTPUT FORMAT:
[HOOK]
(Text)

[BODY]
(Text)

[CTA]
(Text)
`;

        const userPrompt = `
Refine this script based on the concept: "${userIdea}".

CURRENT DRAFT:
${rawScript}

Make it viral.
`;

        try {
            logger.info('Sending script to DeepSeek V3 for refinement...');
            const response = await axios.post(
                this.baseUrl,
                {
                    model: 'deepseek-chat', // DeepSeek V3
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ] as DeepSeekMessage[],
                    max_tokens: 1500,
                    temperature: 1.1, // High temperature for creativity/humor
                    stream: false
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );

            const refinedContent = response.data.choices[0]?.message?.content;
            if (!refinedContent) {
                throw new Error('Empty response from DeepSeek');
            }

            logger.info('DeepSeek refinement successful.');
            return refinedContent.trim();

        } catch (error: any) {
            logger.error('DeepSeek generation failed:', error.response?.data || error.message);
            // Graceful fallback to original script
            return rawScript; 
        }
    }
}

export const deepSeekService = new DeepSeekService();
