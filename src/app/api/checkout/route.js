import { getPolar } from '../../../lib/polar';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request) {
  const url = new URL(request.url);
  const products = url.searchParams.getAll('products').map((p) => p.trim()).filter(Boolean);

  if (products.length === 0) {
    return Response.json(
      { error: 'Missing required query parameter: products' },
      { status: 400 }
    );
  }

  const allowedProductId = process.env.NEXT_PUBLIC_POLAR_ANNUAL_PRODUCT_ID?.trim();
  if (allowedProductId && products.some((id) => id !== allowedProductId)) {
    return Response.json(
      { error: 'Invalid or unsupported product ID' },
      { status: 400 }
    );
  }

  const rawEmail = url.searchParams.get('customer_email')?.trim();
  if (rawEmail && !EMAIL_RE.test(rawEmail)) {
    return Response.json(
      { error: 'Invalid customer_email format' },
      { status: 400 }
    );
  }

  if (!process.env.POLAR_ACCESS_TOKEN) {
    return Response.json(
      { error: 'Checkout is not configured on this server yet' },
      { status: 503 }
    );
  }

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    request.headers.get('cf-connecting-ip') ??
    undefined;

  try {
    const polar = getPolar();
    const checkout = await polar.checkouts.create({
      products,
      success_url: `${url.origin}/?checkout=success`,
      customer_email: rawEmail || undefined,
      customer_ip_address: ipAddress,
      discount_id: url.searchParams.get('discount_id')?.trim() || undefined,
    });

    return Response.redirect(checkout.url, 302);
  } catch (error) {
    console.error('Polar checkout error:', error);
    return Response.json(
      { error: 'Unable to create checkout session' },
      { status: 500 }
    );
  }
}
