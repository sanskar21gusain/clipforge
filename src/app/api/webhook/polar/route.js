import { webhooks } from '@polar-sh/sdk/2026-10';

export async function POST(request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ received: false }, { status: 500 });
  }

  const body = await request.text();
  const headers = {
    'webhook-id': request.headers.get('webhook-id') ?? '',
    'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
    'webhook-signature': request.headers.get('webhook-signature') ?? '',
  };

  let event;
  try {
    event = await webhooks.validateEvent(body, headers, secret);
  } catch (error) {
    if (error instanceof webhooks.PolarWebhookVerificationError) {
      return Response.json({ received: false }, { status: 403 });
    }
    if (error instanceof webhooks.PolarWebhookUnknownTypeError) {
      return Response.json({ received: true }, { status: 202 });
    }
    if (error instanceof webhooks.PolarWebhookError) {
      return Response.json({ received: false }, { status: 400 });
    }
    throw error;
  }

  switch (event.type) {
    case 'order.paid':
      // TODO: Record paid annual subscription order using headers['webhook-id'] for idempotency.
      break;
    case 'customer.state_changed':
      // TODO: Reconcile annual entitlements from event.data.granted_benefits.
      break;
    default:
      break;
  }

  return Response.json({ received: true }, { status: 202 });
}
