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

export const INPUT_COST_PER_TOKEN = 0.000008;
export const CACHED_INPUT_COST_PER_TOKEN = 0.000002;
export const IMAGE_OUTPUT_COST_PER_TOKEN = 0.000032;

/**
 * Estimates the cost of a gpt-image-1.5 API call based on token usage.
 * @param usage - The usage object from the OpenAI API response.
 * @returns CostDetails object or null if usage data is invalid.
 */
export function calculateApiCost(usage: ApiUsage | undefined | null): CostDetails | null {
  if (!usage || !usage.input_tokens_details || usage.output_tokens === undefined || usage.output_tokens === null) {
    console.warn("Invalid or missing usage data for cost calculation:", usage);
    return null;
  }

  const textInT = usage.input_tokens_details.text_tokens ?? 0;
  const imgInT = usage.input_tokens_details.image_tokens ?? 0;
  const cachedInT = usage.input_tokens_details.cached_tokens ?? 0;
  const imgOutT = usage.output_tokens ?? 0;

  // Basic validation for token types
  if (typeof textInT !== 'number' || typeof imgInT !== 'number' || typeof cachedInT !== 'number' || typeof imgOutT !== 'number') {
      console.error("Invalid token types in usage data:", usage);
      return null;
  }

  const billableInputTokens = Math.max(textInT + imgInT - cachedInT, 0);

  const costUSD =
    (billableInputTokens * INPUT_COST_PER_TOKEN) +
    (cachedInT * CACHED_INPUT_COST_PER_TOKEN) +
    (imgOutT * IMAGE_OUTPUT_COST_PER_TOKEN);

  // Round to 4 decimal places
  const costRounded = Math.round(costUSD * 10000) / 10000;

  return {
    estimated_cost_usd: costRounded,
    text_input_tokens: textInT,
    image_input_tokens: imgInT,
    cached_input_tokens: cachedInT,
    billable_input_tokens: billableInputTokens,
    image_output_tokens: imgOutT,
  };
}
