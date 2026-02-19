import axios from 'axios';

export interface AIRequestConfig {
    provider: string;
    apiKey: string;
    model: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}

export interface AIResponse {
    text: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
}

function extractAPIError(error: any): string {
    if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        const msg = data?.error?.message || data?.error?.type || '';

        if (status === 401) return 'Invalid API key';
        if (status === 403) return 'Access denied';
        if (status === 404) return 'Model not found';
        if (status === 429) return 'Rate limit exceeded';
        if (status === 500 || status === 502 || status === 503) return 'API server error';
        if (msg) return msg.slice(0, 60);
        return `HTTP ${status}`;
    }
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) return 'Request timed out';
    if (error.code === 'ENOTFOUND') return 'Cannot reach API';
    return error.message?.slice(0, 60) || 'Unknown error';
}

export async function callAI(
    systemPrompt: string,
    userPrompt: string,
    config: AIRequestConfig
): Promise<AIResponse> {
    const { provider, apiKey, model, baseUrl, temperature = 0.7, maxTokens = 4096, timeout = 30 } = config;

    const timeoutMs = timeout * 1000;

    try {
        if (provider === 'openai' || provider === 'custom' || provider === 'openrouter') {
            const url = baseUrl ||
                (provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' :
                    provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : '');

            const response = await axios.post(
                url,
                {
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature,
                    max_tokens: maxTokens
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://github.com/dzarlax/streamdeck-ai-plugin', 'X-Title': 'Stream Deck AI Assistant' } : {})
                    },
                    timeout: timeoutMs
                }
            );

            return {
                text: response.data.choices[0].message.content,
                usage: {
                    promptTokens: response.data.usage?.prompt_tokens,
                    completionTokens: response.data.usage?.completion_tokens
                }
            };
        } else if (provider === 'anthropic') {
            const url = baseUrl || 'https://api.anthropic.com/v1/messages';

            const response = await axios.post(
                url,
                {
                    model,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: userPrompt }],
                    max_tokens: maxTokens,
                    temperature
                },
                {
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    },
                    timeout: timeoutMs
                }
            );

            return {
                text: response.data.content[0].text,
                usage: {
                    promptTokens: response.data.usage?.input_tokens,
                    completionTokens: response.data.usage?.output_tokens
                }
            };
        } else if (provider === 'gemini') {
            const url = baseUrl || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

            const response = await axios.post(
                url,
                {
                    contents: [
                        {
                            parts: [{ text: userPrompt }]
                        }
                    ],
                    systemInstruction: {
                        parts: [{ text: systemPrompt }]
                    },
                    generationConfig: {
                        temperature,
                        maxOutputTokens: maxTokens
                    }
                },
                {
                    params: {
                        key: apiKey
                    },
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: timeoutMs
                }
            );

            return {
                text: response.data.candidates[0].content.parts[0].text,
                usage: {
                    promptTokens: response.data.usageMetadata?.promptTokenCount,
                    completionTokens: response.data.usageMetadata?.candidatesTokenCount
                }
            };
        }

        throw new Error(`Unsupported provider: ${provider}`);
    } catch (error: any) {
        if (error.message?.startsWith('Unsupported provider')) throw error;
        throw new Error(extractAPIError(error));
    }
}
