import { handleAlert } from '../scripts/sentry-autofix/webhook.mjs';

export async function POST(request) {
  return handleAlert(request);
}

export function GET() {
  return Response.json({ error: 'POST required' }, { status: 405 });
}
