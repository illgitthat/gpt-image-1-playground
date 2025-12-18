import crypto from 'crypto';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import sharp from 'sharp';

const outputDir = path.resolve(process.cwd(), 'generated-images');

const azureConfig = {
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION
};

const soraModel = process.env.AZURE_OPENAI_SORA_MODEL || 'sora-2';
const validSizes = new Set(['1280x720', '720x1280']);

function parseSize(size: string): { width: number; height: number } {
    const [w, h] = size.split('x').map((v) => parseInt(v, 10));
    if (!w || !h) {
        throw new Error('Invalid size format. Expected WIDTHxHEIGHT.');
    }
    return { width: w, height: h };
}

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

async function ensureOutputDirExists() {
    try {
        await fs.access(outputDir);
    } catch (error: unknown) {
        const isENOENT = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ENOENT';
        if (isENOENT) {
            await fs.mkdir(outputDir, { recursive: true });
            console.log(`Created output directory: ${outputDir}`);
        } else {
            console.error(`Error accessing output directory ${outputDir}:`, error);
            throw new Error('Failed to access output directory');
        }
    }
}

function getAzureBaseUrl(): string {
    const endpoint = azureConfig.endpoint?.replace(/\/$/, '');
    if (!endpoint) {
        throw new Error('Azure endpoint is not configured.');
    }
    return `${endpoint}/openai/v1`;
}

async function pollVideoStatus(jobId: string) {
    const baseUrl = getAzureBaseUrl();
    // Sora endpoints require the "preview" api-version regardless of other Azure image/chat versions
    const apiVersion = 'preview';
    const statusUrl = `${baseUrl}/videos/${jobId}?api-version=${apiVersion}`;

    let attempt = 0;
    // Allow up to ~3 minutes (90 * 2s) for long-running Sora generations
    const maxAttempts = 90;

    while (attempt < maxAttempts) {
        const statusResp = await fetch(statusUrl, {
            method: 'GET',
            headers: {
                'api-key': azureConfig.apiKey || ''
            }
        });

        if (!statusResp.ok) {
            const errorText = await statusResp.text().catch(() => '');
            throw new Error(`Failed to poll video status: ${statusResp.status} ${statusResp.statusText} ${errorText}`);
        }

        const statusJson = await statusResp.json();
        const status = statusJson.status as string;

        if (!status || status === 'queued' || status === 'in_progress' || status === 'running') {
            attempt += 1;
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
        }

        return statusJson;
    }

    throw new Error('Video generation timed out after ~3 minutes while waiting for completion.');
}

export async function POST(request: NextRequest) {
    if (!azureConfig.apiKey || !azureConfig.endpoint) {
        console.error('Azure OpenAI credentials are missing for Sora video generation.');
        return NextResponse.json({ error: 'Server configuration error: Azure OpenAI credentials are incomplete.' }, { status: 500 });
    }

    try {
        await ensureOutputDirExists();

        const formData = await request.formData();

        if (process.env.APP_PASSWORD) {
            const clientPasswordHash = formData.get('passwordHash') as string | null;
            if (!clientPasswordHash) {
                return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
            }
            const serverPasswordHash = sha256(process.env.APP_PASSWORD);
            if (clientPasswordHash !== serverPasswordHash) {
                return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
            }
        }

        const prompt = (formData.get('prompt') as string | null)?.trim();
        const size = (formData.get('size') as string | null) || '1280x720';
        const secondsInput = parseInt((formData.get('seconds') as string) || '8', 10);
        const allowedSeconds = [4, 8, 12];
        const seconds = allowedSeconds.includes(secondsInput)
            ? secondsInput
            : allowedSeconds.reduce((prev, curr) => (Math.abs(curr - secondsInput) < Math.abs(prev - secondsInput) ? curr : prev), 8);
        const referenceImage = formData.get('reference_image');

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
        }

        if (!validSizes.has(size)) {
            return NextResponse.json({ error: 'Invalid size. Supported sizes are 1280x720 and 720x1280.' }, { status: 400 });
        }

        if (!(referenceImage instanceof File)) {
            return NextResponse.json({ error: 'Reference image is required and must be a file.' }, { status: 400 });
        }

        const baseUrl = getAzureBaseUrl();
        const apiVersion = 'preview';
        const createUrl = `${baseUrl}/videos?api-version=${apiVersion}`;

        const { width, height } = parseSize(size);

        const refArrayBuffer = await referenceImage.arrayBuffer();
        const refBuffer = Buffer.from(refArrayBuffer);

        const resizedBuffer = await sharp(refBuffer)
            .resize(width, height, { fit: 'cover', position: 'center' })
            .png()
            .toBuffer();

        const resizedFile = new File([new Uint8Array(resizedBuffer)], 'reference.png', { type: 'image/png' });

        const requestForm = new FormData();
        requestForm.append('model', soraModel);
        requestForm.append('prompt', prompt);
        requestForm.append('size', size);
        requestForm.append('seconds', seconds.toString());
        requestForm.append('input_reference', resizedFile, resizedFile.name);

        const createResp = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'api-key': azureConfig.apiKey
            },
            body: requestForm
        });

        if (!createResp.ok) {
            const errorData = await createResp.text().catch(() => '');
            console.error('Azure create video error:', errorData);
            return NextResponse.json(
                { error: `Azure video creation failed: ${createResp.status} ${createResp.statusText}` },
                { status: createResp.status }
            );
        }

        const creationJson = await createResp.json();
        const jobId = creationJson.id as string | undefined;

        if (!jobId) {
            return NextResponse.json({ error: 'Video creation did not return a job id.' }, { status: 500 });
        }

        const statusJson = await pollVideoStatus(jobId);
        const status = (statusJson.status as string | undefined)?.toLowerCase();

        if (status !== 'succeeded' && status !== 'completed') {
            const failureReason = (statusJson.error && statusJson.error.message) || 'Video generation did not complete successfully.';
            return NextResponse.json({ error: failureReason }, { status: 500 });
        }

        const downloadUrl = `${baseUrl}/videos/${jobId}/content?api-version=${apiVersion}&variant=video`;
        const downloadResp = await fetch(downloadUrl, {
            method: 'GET',
            headers: {
                'api-key': azureConfig.apiKey,
                Accept: 'application/octet-stream'
            }
        });

        if (!downloadResp.ok) {
            const errorData = await downloadResp.text().catch(() => '');
            return NextResponse.json(
                { error: `Failed to download video content: ${downloadResp.status} ${downloadResp.statusText} ${errorData}` },
                { status: downloadResp.status }
            );
        }

        const arrayBuffer = await downloadResp.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const filename = `${Date.now()}-sora.mp4`;
        const filepath = path.join(outputDir, filename);
        await fs.writeFile(filepath, buffer);

        return NextResponse.json({
            videos: [{ filename, path: `/api/image/${filename}` }],
            model: soraModel
        });
    } catch (error: unknown) {
        console.error('Error in /api/video:', error);
        const message = error instanceof Error ? error.message : 'Unexpected server error.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
