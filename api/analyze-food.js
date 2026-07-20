import handler from '../netlify/functions/analyze-food.mjs';
import { createApiRoute } from './_adapter.mjs';

export default createApiRoute(handler);
