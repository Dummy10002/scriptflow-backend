import { z } from 'zod';

export const scriptGenerationSchema = z.object({
  subscriber_id: z.string().min(1, "Subscriber ID is required"),
  reel_url: z.string().url("Invalid URL").refine((url) => url.includes('instagram.com/reel'), {
    message: "URL must be an Instagram Reel URL"
  }),
  user_idea: z.string().min(4, "User idea must be longer than 3 characters")
});

export type ScriptGenerationRequest = z.infer<typeof scriptGenerationSchema>;

