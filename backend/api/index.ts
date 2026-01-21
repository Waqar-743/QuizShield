import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../src/index';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
