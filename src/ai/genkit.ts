import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Re-export the client-safe flag so server-side code can also import it from
// this module without needing the separate genkit-config.ts file.
export { IS_GENKIT_CONFIGURED } from '@/ai/genkit-config';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});
