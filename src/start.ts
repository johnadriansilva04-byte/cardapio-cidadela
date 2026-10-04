import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Cabeçalhos de segurança aplicados a toda resposta do servidor (SSR e rotas
// de API). A CSP é conservadora de propósito — restringe enquadramento/base/
// objetos sem mexer em script/style/connect, que quebrariam o app (inline
// scripts do SSR, fontes do Google, Supabase).
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy":
    'camera=(), microphone=(), geolocation=(), payment=(self "https://www.mercadopago.com.br")',
  "Content-Security-Policy":
    "base-uri 'self'; object-src 'none'; frame-ancestors 'self'; upgrade-insecure-requests",
};

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  // Em dev (http) o HSTS/upgrade atrapalharia; só aplicamos em produção.
  const isProd = typeof process !== "undefined" && process.env?.NODE_ENV === "production";
  if (!isProd) return result;

  const response = result.response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return {
    ...result,
    response: new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  };
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware, csrfMiddleware],
}));
