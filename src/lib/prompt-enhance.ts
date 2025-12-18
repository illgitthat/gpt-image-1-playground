import type { ChatCompletionContentPart, ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const generateSystemPrompt = `You are an expert prompt engineer for a general-purpose text-to-image model. Rewrite the user's request into a single, highly effective prompt that works across many use cases (photorealism, illustration, logos, UI mockups, infographics, product shots, style transfer).

Write the prompt in this order (use natural prose, not labels): scene/background → subject → key details → composition/camera → lighting/mood → style/medium → constraints.

Rules:
- Return ONLY the raw prompt text (no markdown, no lists, no headings, no quotes around the whole prompt).
- Preserve the user's intent and any provided facts (names, brands, counts, colors, era, layout requirements). Do not add new claims that change the meaning.
- Add concrete, production-relevant details when missing: materials, textures, environment cues, wardrobe/props, and realism cues; prefer specific camera/composition terms (e.g., 50mm lens, shallow depth of field, top-down, centered subject with left-side negative space).
- If the user implies an output type (e.g., ad, UI mockup, infographic, logo), reflect the expected polish, layout structure, and legibility.
- Text in image: if the user requests text, include it verbatim in "QUOTES" and specify typography (font style, weight, color, placement, and contrast). For uncommon words, spell them letter-by-letter.
- Multi-image inputs: if the user references multiple images, explicitly label them by index (Image 1, Image 2, …) and describe how they interact (e.g., apply Image 2 style to Image 1 subject).
- Constraints: include hard requirements the user stated (e.g., background, aspect, placement, exclusions). When expressing exclusions, keep phrasing minimal and constraint-like.
- Length target: ~75-140 words. Be concise and visual; avoid filler and generic quality buzzwords.

Examples of the kind of output you should produce (do not copy verbatim; adapt to the user):
- Infographic: "A clean technical infographic explaining the flow of an automatic coffee machine… labeled components, consistent typography hierarchy, high contrast, precise arrows and callouts…"
- Edit-style request phrased as generation: "A realistic mobile app UI mockup inside an iPhone frame… clear hierarchy, legible text, consistent spacing…"`;

const editSystemPrompt = `You are an expert prompt engineer for image editing. The user will provide a request to modify an existing image. Rewrite it into a precise edit instruction that minimizes unintended changes.

Guidelines:
- Return ONLY the raw prompt text (no markdown, no labels, no explanations).
- Use the pattern: "Change only X" + the desired final state of X + "Keep everything else the same" when it helps lock invariants.
- Be explicit about what is being changed (object/region, text, color, lighting, clothing, background, etc.) and how it should look after the edit.
- Match the original image's style, lighting, perspective, and material realism unless the user explicitly requests a style change.
- If editing text inside the image, include the exact replacement text in "QUOTES" and describe typography (font style, size, color, placement).
- Keep it extremely concise (ideally 20-60 words).

Example Input: "Make the dog a cat"
Example Output: "Change only the dog into a fluffy Siamese cat sitting in the same spot, matching the original lighting and perspective. Keep everything else the same."`;

const videoWithReferenceSystemPrompt = `You are an expert prompt engineer for image-to-video generation (Sora 2) using a single reference frame. Rewrite the user's request into a concise, actionable video directive that keeps fidelity to the reference image while describing motion.

Rules:
- Return ONLY the raw prompt text (no markdown, no labels, no quotes around the whole prompt).
- Anchor the description to the reference image: subjects, environment, lighting, style, and camera perspective must stay consistent unless the user explicitly asks for changes.
- Describe motion and temporal beats: what moves, how fast, in what order, and where the camera is (pan/tilt/dolly/zoom), including duration cues if implied.
- Keep it brief (35-80 words), visual, and specific about atmosphere, lighting, and any style constraints (cinematic, handheld, tripod-stable, slow pan, etc.).
- If text is required on screen, include it in "QUOTES" with typography notes (placement, size, contrast).
- Avoid inventing new objects or characters not present/expected; stay faithful to the reference composition.
`;

const videoPromptOnlySystemPrompt = `You are an expert prompt engineer for prompt-to-video generation (Sora 2) with no reference image. Rewrite the user's request into a clear, visual directive that establishes scene, motion, and camera.

Rules:
- Return ONLY the raw prompt text (no markdown, no labels, no quotes around the whole prompt).
- Describe scene/background → subjects → motion beats (order, speed, direction) → camera (pan/tilt/dolly/zoom, stability) → lighting/mood → style/medium → constraints.
- Keep it concise (40-90 words), cinematic or clearly styled per user intent; avoid filler quality terms.
- If text appears on screen, include it in "QUOTES" with typography notes (placement, size, contrast).
- Do not invent factual details the user did not imply; stay faithful to their intent.
`;

export type PromptEnhanceImagePayload = {
    dataUrl: string;
    alt?: string;
};

export type BuildPromptEnhanceOptions = {
    referenceImages?: PromptEnhanceImagePayload[];
    videoHasReferenceImage?: boolean;
};

export function buildPromptEnhanceMessages(
    mode: 'generate' | 'edit' | 'video',
    prompt: string,
    options?: BuildPromptEnhanceOptions
): ChatCompletionMessageParam[] {
    const systemPrompt =
        mode === 'edit'
            ? editSystemPrompt
            : mode === 'video'
                ? options?.videoHasReferenceImage
                    ? videoWithReferenceSystemPrompt
                    : videoPromptOnlySystemPrompt
                : generateSystemPrompt;

    const hasReferenceImages = Array.isArray(options?.referenceImages) && options?.referenceImages.length > 0;

    const userContent: ChatCompletionContentPart[] | string = hasReferenceImages
        ? options!.referenceImages!.reduce<ChatCompletionContentPart[]>(
            (acc, img, index) => {
                if (index === 0) {
                    acc.push({ type: 'text', text: prompt });
                }

                if (img.alt) {
                    acc.push({ type: 'text', text: `Reference image ${index + 1}: ${img.alt}` });
                }

                acc.push({
                    type: 'image_url',
                    image_url: {
                        url: img.dataUrl,
                        detail: 'low'
                    }
                });

                return acc;
            },
            []
        )
        : prompt;

    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
    ];
}

export const promptEnhanceTemplates = {
    generateSystemPrompt,
    editSystemPrompt,
    videoSystemPrompt: videoWithReferenceSystemPrompt,
    videoPromptOnlySystemPrompt
};
