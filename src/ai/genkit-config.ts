/**
 * Client-safe Genkit / Google AI configuration flag.
 *
 * Set NEXT_PUBLIC_GENKIT_CONFIGURED=true in your .env.local (or deployment
 * environment) alongside GOOGLE_GENAI_API_KEY so Client Components can detect
 * whether AI narrative generation is available without importing
 * Node.js-only Genkit modules.
 *
 * Usage:
 *   import { IS_GENKIT_CONFIGURED } from "@/ai/genkit-config";
 */
export const IS_GENKIT_CONFIGURED: boolean =
  process.env.NEXT_PUBLIC_GENKIT_CONFIGURED === "true";
