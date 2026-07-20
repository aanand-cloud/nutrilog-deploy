import handler from '../netlify/functions/stripe-webhook.mjs';
import { createApiRoute } from './_adapter.mjs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default createApiRoute(handler, { rawBody: true });
