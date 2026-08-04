import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { checkRateLimit, detectLoop, detectMassOperation } from "./lib/security";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

/**
 * Extrai IP da requisição (considerando proxies)
 */
function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  return cfConnectingIp || realIp || forwarded?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Middleware de segurança
 */
function securityMiddleware(request: Request): { allowed: boolean; error?: string } {
  const ip = getClientIp(request);
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Aplicar segurança APENAS para webhooks específicos
  // Não bloquear requisições normais do cardápio (assets, páginas, etc)
  const webhookPaths = ['/webhook/pracinha', '/webhook/cidadela', '/webhook/games', '/webhook/admin-trial'];
  const isWebhook = webhookPaths.some(path => pathname.includes(path));

  if (!isWebhook) {
    return { allowed: true }; // Não aplicar segurança para requisições normais
  }

  // Rate limiting por endpoint
  let rateLimitType: 'webhook' | 'auth' | 'games' | 'default' = 'default';
  
  if (pathname.includes('/pracinha')) rateLimitType = 'webhook';
  else if (pathname.includes('/cidadela')) rateLimitType = 'auth';
  else if (pathname.includes('/games')) rateLimitType = 'games';

  const rateLimit = checkRateLimit(ip, rateLimitType);
  if (!rateLimit.allowed) {
    console.error(`[SECURITY] Rate limit exceeded for IP: ${ip}, endpoint: ${pathname}`);
    return { allowed: false, error: 'Rate limit exceeded' };
  }

  // Detectar loops em operações repetidas
  if (detectLoop(ip, pathname, 20, 10000)) {
    console.error(`[SECURITY] Loop detected for IP: ${ip}, endpoint: ${pathname}`);
    return { allowed: false, error: 'Too many requests' };
  }

  // Detectar disparo em massa
  if (detectMassOperation(ip, 200, 60000)) {
    console.error(`[SECURITY] Mass operation detected for IP: ${ip}`);
    return { allowed: false, error: 'Mass operation blocked' };
  }

  return { allowed: true };
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = request.url;
    const method = request.method;
    const ip = getClientIp(request);
    console.log(`[SERVER REQUEST] ${method} ${url} - IP: ${ip}`);
    console.log(`[SERVER] Headers:`, Object.fromEntries(request.headers.entries()));

    // Aplicar middleware de segurança
    const securityCheck = securityMiddleware(request);
    if (!securityCheck.allowed) {
      console.error(`[SECURITY BLOCK] ${method} ${url} - ${securityCheck.error}`);
      return new Response(
        JSON.stringify({ error: securityCheck.error, retryAfter: 60 }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "60",
          },
        },
      );
    }

    try {
      console.log(`[SERVER] Getting server entry...`);
      const handler = await getServerEntry();
      console.log(`[SERVER] Server entry obtained, calling handler.fetch...`);
      const response = await handler.fetch(request, env, ctx);
      console.log(`[SERVER] Handler response received, status: ${response.status}`);

      // Clone response to read body without consuming it
      const clonedResponse = response.clone();
      const bodyText = await clonedResponse.text();
      console.log(`[SERVER] Response body length: ${bodyText.length}`);
      console.log(`[SERVER] Response body preview (first 500 chars):`, bodyText.substring(0, 500));

      // Log detailed response info
      console.log(`[SERVER RESPONSE] ${method} ${url} - Status: ${response.status}`);
      if (response.status === 404) {
        console.error(`[404 ERROR] URL not found: ${url}`);
        console.error(
          `[404 ERROR] Request headers:`,
          Object.fromEntries(request.headers.entries()),
        );
      }

      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(`[SERVER ERROR] ${method} ${url}:`, error);
      console.error(`[SERVER ERROR] Stack:`, error instanceof Error ? error.stack : 'No stack');
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
