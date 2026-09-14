export function buildCheckoutUrl(baseUrl: string, visitorId: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid checkout URL: ${baseUrl}`);
  }

  url.searchParams.set('client_reference_id', visitorId);
  return url.toString();
}
