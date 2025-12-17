type ApiUsage = {
    input_tokens_details?: {
        text_tokens?: number;
        image_tokens?: number;
        cached_tokens?: number;
    };
    output_tokens?: number;
};

export type CostDetails = {
    estimated_cost_usd: number;
    text_input_tokens: number;
    image_input_tokens: number;
    cached_input_tokens: number;
    billable_input_tokens: number;
    image_output_tokens: number;
};

// Pricing for gpt-image-1
const GPT_IMAGE_1_TEXT_INPUT_COST_PER_TOKEN = 0.000005; // $5.00/1M
const GPT_IMAGE_1_IMAGE_INPUT_COST_PER_TOKEN = 0.00001; // $10.00/1M
const GPT_IMAGE_1_IMAGE_OUTPUT_COST_PER_TOKEN = 0.00004; // $40.00/1M
const GPT_IMAGE_1_CACHED_INPUT_COST_PER_TOKEN = 0.000002; // approximate, aligns with previous cached pricing

// Pricing for gpt-image-1-mini
const GPT_IMAGE_1_MINI_TEXT_INPUT_COST_PER_TOKEN = 0.000002; // $2.00/1M
const GPT_IMAGE_1_MINI_IMAGE_INPUT_COST_PER_TOKEN = 0.0000025; // $2.50/1M
const GPT_IMAGE_1_MINI_IMAGE_OUTPUT_COST_PER_TOKEN = 0.000008; // $8.00/1M
const GPT_IMAGE_1_MINI_CACHED_INPUT_COST_PER_TOKEN = 0.0000008; // rough parity with cached discount

// Pricing for gpt-image-1.5
const GPT_IMAGE_1_5_TEXT_INPUT_COST_PER_TOKEN = 0.000005; // $5.00/1M
const GPT_IMAGE_1_5_IMAGE_INPUT_COST_PER_TOKEN = 0.000008; // $8.00/1M
const GPT_IMAGE_1_5_IMAGE_OUTPUT_COST_PER_TOKEN = 0.000032; // $32.00/1M
const GPT_IMAGE_1_5_CACHED_INPUT_COST_PER_TOKEN = 0.000002; // from prior implementation

/**
 * Estimates the cost of a GPT image model API call based on token usage.
 * @param usage - The usage object from the OpenAI API response.
 * @param model - The model used ('gpt-image-1', 'gpt-image-1-mini', or 'gpt-image-1.5').
 * @returns CostDetails object or null if usage data is invalid.
 */
export function calculateApiCost(
    usage: ApiUsage | undefined | null,
    model: 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5' = 'gpt-image-1.5'
): CostDetails | null {
    if (!usage || !usage.input_tokens_details || usage.output_tokens === undefined || usage.output_tokens === null) {
        console.warn('Invalid or missing usage data for cost calculation:', usage);
        return null;
    }

    const textInT = usage.input_tokens_details.text_tokens ?? 0;
    const imgInT = usage.input_tokens_details.image_tokens ?? 0;
    const cachedInT = usage.input_tokens_details.cached_tokens ?? 0;
    const imgOutT = usage.output_tokens ?? 0;

    if (typeof textInT !== 'number' || typeof imgInT !== 'number' || typeof cachedInT !== 'number' || typeof imgOutT !== 'number') {
        console.error('Invalid token types in usage data:', usage);
        return null;
    }

    let textInputCost: number;
    let imageInputCost: number;
    let imageOutputCost: number;
    let cachedInputCost: number;

    if (model === 'gpt-image-1-mini') {
        textInputCost = GPT_IMAGE_1_MINI_TEXT_INPUT_COST_PER_TOKEN;
        imageInputCost = GPT_IMAGE_1_MINI_IMAGE_INPUT_COST_PER_TOKEN;
        imageOutputCost = GPT_IMAGE_1_MINI_IMAGE_OUTPUT_COST_PER_TOKEN;
        cachedInputCost = GPT_IMAGE_1_MINI_CACHED_INPUT_COST_PER_TOKEN;
    } else if (model === 'gpt-image-1.5') {
        textInputCost = GPT_IMAGE_1_5_TEXT_INPUT_COST_PER_TOKEN;
        imageInputCost = GPT_IMAGE_1_5_IMAGE_INPUT_COST_PER_TOKEN;
        imageOutputCost = GPT_IMAGE_1_5_IMAGE_OUTPUT_COST_PER_TOKEN;
        cachedInputCost = GPT_IMAGE_1_5_CACHED_INPUT_COST_PER_TOKEN;
    } else {
        textInputCost = GPT_IMAGE_1_TEXT_INPUT_COST_PER_TOKEN;
        imageInputCost = GPT_IMAGE_1_IMAGE_INPUT_COST_PER_TOKEN;
        imageOutputCost = GPT_IMAGE_1_IMAGE_OUTPUT_COST_PER_TOKEN;
        cachedInputCost = GPT_IMAGE_1_CACHED_INPUT_COST_PER_TOKEN;
    }

    const effectiveTextTokens = Math.max(textInT - cachedInT, 0);
    const billableInputTokens = effectiveTextTokens + imgInT;

    const costUSD =
        effectiveTextTokens * textInputCost + cachedInT * cachedInputCost + imgInT * imageInputCost + imgOutT * imageOutputCost;

    const costRounded = Math.round(costUSD * 10000) / 10000;

    return {
        estimated_cost_usd: costRounded,
        text_input_tokens: textInT,
        image_input_tokens: imgInT,
        cached_input_tokens: cachedInT,
        billable_input_tokens: billableInputTokens,
        image_output_tokens: imgOutT
    };
}
