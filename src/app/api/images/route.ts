import crypto from 'crypto';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { AzureOpenAI } from 'openai';
import path from 'path';

type StreamingEvent = {
  type: 'partial_image' | 'completed' | 'error' | 'done';
  index?: number;
  partial_image_index?: number;
  b64_json?: string;
  filename?: string;
  path?: string;
  output_format?: string;
  usage?: OpenAI.Images.ImagesResponse['usage'];
  images?: Array<{
    filename: string;
    b64_json: string;
    path?: string;
    output_format: string;
  }>;
  error?: string;
};

const azureConfig = {
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME
};

const useAzure = Boolean(azureConfig.apiKey && azureConfig.endpoint && azureConfig.apiVersion && azureConfig.deployment);

const apiClient = useAzure
  ? new AzureOpenAI({
    apiKey: azureConfig.apiKey!,
    endpoint: azureConfig.endpoint!,
    apiVersion: azureConfig.apiVersion!,
    deployment: azureConfig.deployment!
  })
  : new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL
  });

const outputDir = path.resolve(process.cwd(), 'generated-images');

const VALID_OUTPUT_FORMATS = ['png', 'jpeg', 'webp'] as const;
type ValidOutputFormat = (typeof VALID_OUTPUT_FORMATS)[number];

function validateOutputFormat(format: unknown): ValidOutputFormat {
  const normalized = String(format || 'png').toLowerCase();
  const mapped = normalized === 'jpg' ? 'jpeg' : normalized;

  if (VALID_OUTPUT_FORMATS.includes(mapped as ValidOutputFormat)) {
    return mapped as ValidOutputFormat;
  }

  return 'png';
}

async function ensureOutputDirExists() {
  try {
    await fs.access(outputDir);
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
      await fs.mkdir(outputDir, { recursive: true });
      console.log(`Created output directory: ${outputDir}`);
    } else {
      console.error(`Error accessing output directory ${outputDir}:`, error);
      throw new Error(
        `Failed to access or ensure image output directory exists. Original error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function azureOpenAIImageEdit(params: OpenAI.Images.ImageEditParams): Promise<OpenAI.Images.ImagesResponse> {
  const endpoint = azureConfig.endpoint!.replace(/\/$/, '');
  const editUrl = `${endpoint}/openai/deployments/${azureConfig.deployment}/images/edits?api-version=${azureConfig.apiVersion}`;

  const formData = new FormData();
  formData.append('prompt', params.prompt);

  if (Array.isArray(params.image)) {
    for (const image of params.image) {
      if (image instanceof File) {
        formData.append('image', image);
      }
    }
  } else if (params.image instanceof File) {
    formData.append('image', params.image);
  }

  if (params.mask && params.mask instanceof File) {
    formData.append('mask', params.mask);
  }

  if (params.n) formData.append('n', params.n.toString());
  if (params.size) formData.append('size', params.size);
  if (params.quality) formData.append('quality', params.quality);

  const response = await fetch(editUrl, {
    method: 'POST',
    headers: {
      'api-key': azureConfig.apiKey!
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      `Azure OpenAI API error: ${response.status} ${response.statusText} ${errorData ? JSON.stringify(errorData) : ''}`
    );
  }

  return (await response.json()) as OpenAI.Images.ImagesResponse;
}

export async function POST(request: NextRequest) {
  console.log('Received POST request to /api/images');

  if (useAzure) {
    if (!azureConfig.apiKey || !azureConfig.endpoint || !azureConfig.apiVersion || !azureConfig.deployment) {
      console.error('Azure OpenAI environment variables are missing.');
      return NextResponse.json(
        { error: 'Server configuration error: Azure OpenAI credentials are incomplete.' },
        { status: 500 }
      );
    }
  } else if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set.');
    return NextResponse.json({ error: 'Server configuration error: API key not found.' }, { status: 500 });
  }

  try {
    let effectiveStorageMode: 'fs' | 'indexeddb';
    const explicitMode = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
    const isOnVercel = process.env.VERCEL === '1';

    if (explicitMode === 'fs') {
      effectiveStorageMode = 'fs';
    } else if (explicitMode === 'indexeddb') {
      effectiveStorageMode = 'indexeddb';
    } else if (isOnVercel) {
      effectiveStorageMode = 'indexeddb';
    } else {
      effectiveStorageMode = 'fs';
    }
    console.log(
      `Effective Image Storage Mode: ${effectiveStorageMode} (Explicit: ${explicitMode || 'unset'}, Vercel: ${isOnVercel})`
    );

    if (effectiveStorageMode === 'fs') {
      await ensureOutputDirExists();
    }

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

    const mode = formData.get('mode') as 'generate' | 'edit' | null;
    const prompt = formData.get('prompt') as string | null;
    const requestedModel =
      (formData.get('model') as 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5' | null) || 'gpt-image-1.5';
    const model = useAzure ? azureConfig.deployment! : requestedModel;

    if (!mode || !prompt) {
      return NextResponse.json({ error: 'Missing required parameters: mode and prompt' }, { status: 400 });
    }

    const streamEnabled = formData.get('stream') === 'true';
    const partialImagesCount = parseInt((formData.get('partial_images') as string) || '2', 10);

    let result: OpenAI.Images.ImagesResponse;

    if (mode === 'generate') {
      const n = parseInt((formData.get('n') as string) || '1', 10);
      const size = (formData.get('size') as OpenAI.Images.ImageGenerateParams['size']) || '1024x1024';
      const quality = (formData.get('quality') as OpenAI.Images.ImageGenerateParams['quality']) || 'auto';
      const output_format =
        (formData.get('output_format') as OpenAI.Images.ImageGenerateParams['output_format']) || 'png';
      const output_compression_str = formData.get('output_compression') as string | null;
      const background =
        (formData.get('background') as OpenAI.Images.ImageGenerateParams['background']) || 'auto';
      const moderation =
        (formData.get('moderation') as OpenAI.Images.ImageGenerateParams['moderation']) || 'auto';

      const baseParams = {
        model,
        prompt,
        n: Math.max(1, Math.min(n || 1, 10)),
        size,
        quality,
        output_format,
        background,
        moderation
      };

      if ((output_format === 'jpeg' || output_format === 'webp') && output_compression_str) {
        const compression = parseInt(output_compression_str, 10);
        if (!isNaN(compression) && compression >= 0 && compression <= 100) {
          (baseParams as OpenAI.Images.ImageGenerateParams).output_compression = compression;
        }
      }

      if (streamEnabled) {
        const actualPartialImages = Math.max(1, Math.min(partialImagesCount, 3)) as 1 | 2 | 3;

        const streamParams = {
          ...baseParams,
          stream: true as const,
          partial_images: actualPartialImages
        };

        const stream = await (apiClient as OpenAI).images.generate(streamParams);

        const encoder = new TextEncoder();
        const timestamp = Date.now();
        const fileExtension = validateOutputFormat(output_format);

        const readableStream = new ReadableStream({
          async start(controller) {
            try {
              const completedImages: Array<{
                filename: string;
                b64_json: string;
                path?: string;
                output_format: string;
              }> = [];
              let finalUsage: OpenAI.Images.ImagesResponse['usage'] | undefined;
              let imageIndex = 0;

              for await (const event of stream) {
                if (event.type === 'image_generation.partial_image') {
                  const partialEvent: StreamingEvent = {
                    type: 'partial_image',
                    index: imageIndex,
                    partial_image_index: event.partial_image_index,
                    b64_json: event.b64_json
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(partialEvent)}\n\n`));
                } else if (event.type === 'image_generation.completed') {
                  const currentIndex = imageIndex;
                  const filename = `${timestamp}-${currentIndex}.${fileExtension}`;

                  if (effectiveStorageMode === 'fs' && event.b64_json) {
                    const buffer = Buffer.from(event.b64_json, 'base64');
                    const filepath = path.join(outputDir, filename);
                    await fs.writeFile(filepath, buffer);
                  }

                  const imageData = {
                    filename,
                    b64_json: event.b64_json || '',
                    output_format: fileExtension,
                    ...(effectiveStorageMode === 'fs' ? { path: `/api/image/${filename}` } : {})
                  };
                  completedImages.push(imageData);

                  const completedEvent: StreamingEvent = {
                    type: 'completed',
                    index: currentIndex,
                    filename,
                    b64_json: event.b64_json,
                    path: effectiveStorageMode === 'fs' ? `/api/image/${filename}` : undefined,
                    output_format: fileExtension
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(completedEvent)}\n\n`));

                  imageIndex++;

                  if ('usage' in event && event.usage) {
                    finalUsage = event.usage as OpenAI.Images.ImagesResponse['usage'];
                  }
                }
              }

              const doneEvent: StreamingEvent = {
                type: 'done',
                images: completedImages,
                usage: finalUsage
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));
              controller.close();
            } catch (error) {
              const errorEvent: StreamingEvent = {
                type: 'error',
                error: error instanceof Error ? error.message : 'Streaming error occurred'
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
              controller.close();
            }
          }
        });

        return new Response(readableStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive'
          }
        });
      }

      const params: OpenAI.Images.ImageGenerateParams = baseParams;
      result = await apiClient.images.generate(params);
    } else if (mode === 'edit') {
      const n = parseInt((formData.get('n') as string) || '1', 10);
      const size = (formData.get('size') as OpenAI.Images.ImageEditParams['size']) || 'auto';
      const quality = (formData.get('quality') as OpenAI.Images.ImageEditParams['quality']) || 'auto';

      const imageFiles: File[] = [];
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('image_') && value instanceof File) {
          imageFiles.push(value);
        }
      }

      if (imageFiles.length === 0) {
        return NextResponse.json({ error: 'No image file provided for editing.' }, { status: 400 });
      }

      const maskFile = formData.get('mask') as File | null;

      const baseEditParams = {
        model,
        prompt,
        image: imageFiles,
        n: Math.max(1, Math.min(n || 1, 10)),
        size: size === 'auto' ? undefined : size,
        quality: quality === 'auto' ? undefined : quality
      };

      if (streamEnabled) {
        const streamEditParams = {
          ...baseEditParams,
          stream: true as const,
          partial_images: Math.max(1, Math.min(partialImagesCount, 3)) as 1 | 2 | 3,
          ...(maskFile ? { mask: maskFile } : {})
        };

        const stream = await (apiClient as OpenAI).images.edit(streamEditParams);

        const encoder = new TextEncoder();
        const timestamp = Date.now();
        const fileExtension = 'png';

        const readableStream = new ReadableStream({
          async start(controller) {
            try {
              const completedImages: Array<{
                filename: string;
                b64_json: string;
                path?: string;
                output_format: string;
              }> = [];
              let finalUsage: OpenAI.Images.ImagesResponse['usage'] | undefined;
              let imageIndex = 0;

              for await (const event of stream) {
                if (event.type === 'image_edit.partial_image') {
                  const partialEvent: StreamingEvent = {
                    type: 'partial_image',
                    index: imageIndex,
                    partial_image_index: event.partial_image_index,
                    b64_json: event.b64_json
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(partialEvent)}\n\n`));
                } else if (event.type === 'image_edit.completed') {
                  const currentIndex = imageIndex;
                  const filename = `${timestamp}-${currentIndex}.${fileExtension}`;

                  if (effectiveStorageMode === 'fs' && event.b64_json) {
                    const buffer = Buffer.from(event.b64_json, 'base64');
                    const filepath = path.join(outputDir, filename);
                    await fs.writeFile(filepath, buffer);
                  }

                  const imageData = {
                    filename,
                    b64_json: event.b64_json || '',
                    output_format: fileExtension,
                    ...(effectiveStorageMode === 'fs' ? { path: `/api/image/${filename}` } : {})
                  };
                  completedImages.push(imageData);

                  const completedEvent: StreamingEvent = {
                    type: 'completed',
                    index: currentIndex,
                    filename,
                    b64_json: event.b64_json,
                    path: effectiveStorageMode === 'fs' ? `/api/image/${filename}` : undefined,
                    output_format: fileExtension
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(completedEvent)}\n\n`));

                  imageIndex++;

                  if ('usage' in event && event.usage) {
                    finalUsage = event.usage as OpenAI.Images.ImagesResponse['usage'];
                  }
                }
              }

              const doneEvent: StreamingEvent = {
                type: 'done',
                images: completedImages,
                usage: finalUsage
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));
              controller.close();
            } catch (error) {
              const errorEvent: StreamingEvent = {
                type: 'error',
                error: error instanceof Error ? error.message : 'Streaming error occurred'
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
              controller.close();
            }
          }
        });

        return new Response(readableStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive'
          }
        });
      }

      const params: OpenAI.Images.ImageEditParams = {
        ...baseEditParams,
        ...(maskFile ? { mask: maskFile } : {})
      };

      if (useAzure) {
        result = await azureOpenAIImageEdit(params);
      } else {
        result = await apiClient.images.edit(params);
      }
    } else {
      return NextResponse.json({ error: 'Invalid mode specified' }, { status: 400 });
    }

    if (!result || !Array.isArray(result.data) || result.data.length === 0) {
      return NextResponse.json({ error: 'Failed to retrieve image data from API.' }, { status: 500 });
    }

    const savedImagesData = await Promise.all(
      result.data.map(async (imageData, index) => {
        if (!imageData.b64_json) {
          throw new Error(`Image data at index ${index} is missing base64 data.`);
        }
        const buffer = Buffer.from(imageData.b64_json, 'base64');
        const timestamp = Date.now();

        const fileExtension = mode === 'edit' ? 'png' : validateOutputFormat(formData.get('output_format'));
        const filename = `${timestamp}-${index}.${fileExtension}`;

        if (effectiveStorageMode === 'fs') {
          const filepath = path.join(outputDir, filename);
          await fs.writeFile(filepath, buffer);
        }

        const imageResult: { filename: string; b64_json: string; path?: string; output_format: string } = {
          filename,
          b64_json: imageData.b64_json,
          output_format: fileExtension
        };

        if (effectiveStorageMode === 'fs') {
          imageResult.path = `/api/image/${filename}`;
        }

        return imageResult;
      })
    );

    return NextResponse.json({ images: savedImagesData, usage: result.usage });
  } catch (error: unknown) {
    console.error('Error in /api/images:', error);

    let errorMessage = 'An unexpected error occurred.';
    let status = 500;

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'model_not_found' &&
      'status' in error &&
      (error as { status?: number }).status === 404 &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string' &&
      (error as { message?: string }).message?.includes('gpt-image-1.5')
    ) {
      errorMessage =
        'gpt-image-1.5 is not yet available. Please select gpt-image-1 or gpt-image-1-mini or try gpt-image-1.5 again later.';
      status = 404;
      return NextResponse.json({ error: errorMessage }, { status });
    }

    if (error instanceof Error) {
      errorMessage = error.message;
      if (typeof (error as { status?: number }).status === 'number') {
        status = (error as { status?: number }).status as number;
      }
    }

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
