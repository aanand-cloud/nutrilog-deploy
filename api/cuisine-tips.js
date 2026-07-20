import handler from '../netlify/functions/cuisine-tips.mjs';
import { createApiRoute } from './_adapter.mjs';

export default createApiRoute(handler);
