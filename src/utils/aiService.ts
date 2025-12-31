// AI Provider Service
// Supports OpenAI and Google Gemini APIs

export type AIProvider = 'openai' | 'gemini';

export interface AISettings {
    provider: AIProvider;
    openaiKey: string;
    geminiKey: string;
}

const STORAGE_KEY = 'po-translator-ai-settings';

// Load API keys from environment variables (.env file)
const ENV_OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const ENV_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export function loadSettings(): AISettings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const settings = JSON.parse(stored);
            // Use env keys as fallback if localStorage keys are empty
            return {
                ...settings,
                openaiKey: settings.openaiKey || ENV_OPENAI_KEY,
                geminiKey: settings.geminiKey || ENV_GEMINI_KEY,
            };
        }
    } catch (e) {
        console.error('Failed to load AI settings:', e);
    }
    // Default: use keys from .env file
    return {
        provider: 'gemini',
        openaiKey: ENV_OPENAI_KEY,
        geminiKey: ENV_GEMINI_KEY
    };
}

export function saveSettings(settings: AISettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function getAISuggestions(
    text: string,
    targetLanguage: string,
    settings: AISettings,
    context?: string
): Promise<string[]> {
    const { provider, openaiKey, geminiKey } = settings;

    if (provider === 'openai' && !openaiKey) {
        throw new Error('OpenAI API key not configured');
    }
    if (provider === 'gemini' && !geminiKey) {
        throw new Error('Gemini API key not configured');
    }

    // Build prompt with optional context
    let prompt = `Translate the following text to ${targetLanguage}. Provide exactly 3 different translation variations, each on a new line. Only output the translations, no numbers, no explanations.`;

    if (context) {
        prompt += `\n\nContext: ${context}`;
    }

    prompt += `\n\nText: "${text}"`;

    if (provider === 'openai') {
        return await callOpenAI(prompt, openaiKey);
    } else {
        return await callGemini(prompt, geminiKey);
    }
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string[]> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-5-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional translator. Provide accurate, natural translations.',
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_completion_tokens: 200,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return parseTranslations(content);
}

async function callGemini(prompt: string, apiKey: string): Promise<string[]> {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 200,
                },
            }),
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return parseTranslations(content);
}

function parseTranslations(content: string): string[] {
    return content
        .split('\n')
        .map((line) => {
            let cleaned = line
                .replace(/^\d+[\.\)]\s*/, '')  // Remove numbering like "1." or "1)"
                .replace(/^[-•*]\s*/, '')       // Remove bullet points
                .trim();

            // Remove surrounding quotes (single or double)
            if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
                (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
                cleaned = cleaned.slice(1, -1);
            }

            return cleaned;
        })
        .filter((line) => line.length > 0)
        .slice(0, 3); // Max 3 suggestions
}
