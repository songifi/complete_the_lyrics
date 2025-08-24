import { RequestWithNonce } from "./csp.middleware";

/**
 * Utility functions for CSP nonce management and template injection
 */

/**
 * Escape HTML entities to prevent XSS attacks
 * @param value - String value to escape
 * @returns Escaped string safe for HTML attributes
 */
function escapeHtml(value: string): string {
  if (value == null) return "";

  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Validate and sanitize HTML attribute names
 * @param name - Attribute name to validate
 * @returns true if valid, false otherwise
 */
function isValidAttributeName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

/**
 * Get the CSP nonce from the request object
 * @param req - Request object with CSP nonce
 * @returns CSP nonce string or empty string if not available
 */
export function getCspNonce(req: RequestWithNonce): string {
  return req.cspNonce || "";
}

/**
 * Generate a nonce attribute for HTML elements
 * @param req - Request object with CSP nonce
 * @returns nonce attribute string or empty string if not available
 */
export function getNonceAttribute(req: RequestWithNonce): string {
  const nonce = getCspNonce(req);
  return nonce ? ` nonce="${escapeHtml(nonce)}"` : "";
}

/**
 * Generate a script tag with nonce
 * @param req - Request object with CSP nonce
 * @param content - JavaScript content
 * @param attributes - Additional HTML attributes
 * @returns HTML script tag with nonce
 */
export function scriptWithNonce(
  req: RequestWithNonce,
  content: string,
  attributes: Record<string, string> = {},
): string {
  const nonce = getCspNonce(req);
  const attrString = Object.entries(attributes)
    .filter(([key, value]) => isValidAttributeName(key) && value != null)
    .map(([key, value]) => `${key}="${escapeHtml(String(value))}"`)
    .join(" ");

  const nonceAttr = nonce ? ` nonce="${escapeHtml(nonce)}"` : "";
  const allAttrs = [attrString, nonceAttr].filter(Boolean).join(" ");

  return `<script${allAttrs ? ` ${allAttrs}` : ""}>${content}</script>`;
}

/**
 * Generate a style tag with nonce
 * @param req - Request object with CSP nonce
 * @param content - CSS content
 * @param attributes - Additional HTML attributes
 * @returns HTML style tag with nonce
 */
export function styleWithNonce(
  req: RequestWithNonce,
  content: string,
  attributes: Record<string, string> = {},
): string {
  const nonce = getCspNonce(req);
  const attrString = Object.entries(attributes)
    .filter(([key, value]) => isValidAttributeName(key) && value != null)
    .map(([key, value]) => `${key}="${escapeHtml(String(value))}"`)
    .join(" ");

  const nonceAttr = nonce ? ` nonce="${escapeHtml(nonce)}"` : "";
  const allAttrs = [attrString, nonceAttr].filter(Boolean).join(" ");

  return `<style${allAttrs ? ` ${allAttrs}` : ""}>${content}</style>`;
}

/**
 * Validate that inline content is properly nonce-protected
 * @param html - HTML content to validate
 * @param nonce - Expected nonce value
 * @returns true if all inline scripts/styles have nonces, false otherwise
 */
export function validateNonceProtection(html: string, nonce: string): boolean {
  if (!nonce) return false;

  const inlineScripts = html.match(
    /<script(?![^>]*nonce=)[^>]*>[^<]*<\/script>/gi,
  );
  if (inlineScripts && inlineScripts.length > 0) {
    return false;
  }

  const inlineStyles = html.match(
    /<style(?![^>]*nonce=)[^>]*>[^<]*<\/style>/gi,
  );
  if (inlineStyles && inlineStyles.length > 0) {
    return false;
  }

  return true;
}

export async function generateCspHash(
  content: string,
  algorithm: "sha256" | "sha384" | "sha512" = "sha256",
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = new Uint8Array(hashBuffer);
  return btoa(String.fromCharCode(...hashArray));
}
