export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body && typeof init.body === 'string') {
    headers.set('content-type', 'application/json');
  }

  return fetch(input, {
    ...init,
    headers,
    // crucial: cookie-based auth from Next.js API
    credentials: 'include',
  });
}

