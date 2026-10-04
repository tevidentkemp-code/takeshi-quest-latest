import { allowedOrigins, expectedAuthIssuer, getUser, server, writesEnabled } from '../_shared/sc004-runtime.ts';
import { createCommentaryHandler } from '../_shared/sc004-commentary.mjs';
import { callOpenAI } from '../_shared/sc004-commentary-model.ts';
Deno.serve(createCommentaryHandler({ server, getUser, expectedAuthIssuer, allowedOrigins, writesEnabled,
  generate: (mode: 'studio_intro' | 'studio_outro', context: unknown) => {
    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key) throw new Error('model_not_configured');
    return callOpenAI(key, mode, context);
  },
}));
