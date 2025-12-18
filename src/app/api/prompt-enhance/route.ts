import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { AzureOpenAI } from 'openai';
import { buildPromptEnhanceMessages, type PromptEnhanceImagePayload } from '@/lib/prompt-enhance';

const azureConfig = {
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    enhanceDeployment: process.env.AZURE_OPENAI_PROMPT_ENHANCE_DEPLOYMENT_NAME
};

const promptEnhanceModel = process.env.PROMPT_ENHANCE_MODEL || 'gpt-5.2-chat';

// Fall back: AZURE_OPENAI_PROMPT_ENHANCE_DEPLOYMENT_NAME -> PROMPT_ENHANCE_MODEL (assumes deployment name matches model)
const azureDeploymentForEnhance = azureConfig.enhanceDeployment || promptEnhanceModel;
const useAzure = Boolean(
    azureConfig.apiKey && azureConfig.endpoint && azureConfig.apiVersion && azureDeploymentForEnhance
);

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function extractText(content: unknown): string {
    if (typeof content === 'string') {
        return content.trim();
    }

    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (typeof part === 'string') return part;
                if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: string }).text === 'string') {
                    return (part as { text?: string }).text ?? '';
                }
                return '';
            })
            .join('')
            .trim();
    }

    return '';
}

function sanitizeReferenceImages(input: unknown): PromptEnhanceImagePayload[] {
    if (!Array.isArray(input)) return [];

    const maxImages = 5;
    const sanitized: PromptEnhanceImagePayload[] = [];

    for (const candidate of input) {
        if (sanitized.length >= maxImages) break;

        if (typeof candidate === 'string') {
            if (candidate.startsWith('data:image')) {
                sanitized.push({ dataUrl: candidate });
            }
            continue;
        }

        if (candidate && typeof candidate === 'object') {
            const dataUrl = typeof (candidate as { dataUrl?: string }).dataUrl === 'string'
                ? (candidate as { dataUrl?: string }).dataUrl
                : undefined;
            const alt = typeof (candidate as { alt?: string }).alt === 'string'
                ? (candidate as { alt?: string }).alt
                : undefined;

            if (dataUrl && dataUrl.startsWith('data:image')) {
                sanitized.push({ dataUrl, alt });
            }
        }
    }

    return sanitized;
}

export async function POST(request: NextRequest) {
    if (useAzure) {
        if (!azureConfig.apiKey || !azureConfig.endpoint || !azureConfig.apiVersion || !azureDeploymentForEnhance) {
            return NextResponse.json(
                { error: 'Server configuration error: Azure OpenAI credentials are incomplete.' },
                { status: 500 }
            );
        }
    } else if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'Server configuration error: API key not found.' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const prompt = (body?.prompt as string | undefined)?.trim();
        const mode = body?.mode as 'generate' | 'edit' | 'video' | undefined;
        const referenceImages = sanitizeReferenceImages(body?.referenceImages);
        const videoHasReferenceImage = Boolean(body?.videoHasReferenceImage) || referenceImages.length > 0;
        const clientPasswordHash = body?.passwordHash as string | undefined;

        if (!prompt || !mode) {
            return NextResponse.json({ error: 'Missing required parameters: prompt and mode.' }, { status: 400 });
        }

        if (process.env.APP_PASSWORD) {
            if (!clientPasswordHash) {
                return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
            }
            const serverPasswordHash = sha256(process.env.APP_PASSWORD);
            if (clientPasswordHash !== serverPasswordHash) {
                return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
            }
        }

        const messages = buildPromptEnhanceMessages(mode, prompt, {
            referenceImages,
            videoHasReferenceImage
        });
        const modelToUse = useAzure ? azureDeploymentForEnhance! : promptEnhanceModel;

        const apiClient = useAzure
            ? new AzureOpenAI({
                apiKey: azureConfig.apiKey!,
                endpoint: azureConfig.endpoint!,
                apiVersion: azureConfig.apiVersion!,
                deployment: azureDeploymentForEnhance!
            })
            : new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
                baseURL: process.env.OPENAI_API_BASE_URL
            });

        const completion = await apiClient.chat.completions.create({
            model: modelToUse,
            messages,
            max_completion_tokens: 320
        });

        const message = completion.choices?.[0]?.message;
        const enhanced = message ? extractText(message.content) : '';

        if (!enhanced) {
            return NextResponse.json({ error: 'Failed to enhance prompt.' }, { status: 502 });
        }

        return NextResponse.json({ prompt: enhanced });
    } catch (error: unknown) {
        console.error('Error in /api/prompt-enhance:', error);

        if (error instanceof Error && 'status' in error && typeof (error as { status?: number }).status === 'number') {
            return NextResponse.json({ error: error.message }, { status: (error as { status: number }).status });
        }

        return NextResponse.json({ error: 'An unexpected error occurred while enhancing the prompt.' }, { status: 500 });
    }
}
