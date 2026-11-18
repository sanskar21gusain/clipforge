import { getPolar } from '../../../lib/polar';

export async function GET(request) {
  const url = new URL(request.url);
  const products = url.searchParams.getAll('products').filter(Boolean);

  if (products.length === 0) {
    return Response.json(
      { error: 'Missing required query parameter: products' },
      { status: 400 }
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
      customer_email: url.searchParams.get('customer_email') ?? undefined,
      customer_ip_address: ipAddress,
      discount_id: url.searchParams.get('discount_id') ?? undefined,
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
