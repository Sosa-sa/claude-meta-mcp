/**
 * Thin wrapper around the Meta Graph API.
 *
 * Handles auth, base URL, and turns Graph API errors into useful messages
 * before they propagate up to MCP tool handlers.
 */

import axios, { AxiosError, AxiosInstance } from "axios";

export interface MetaErrorPayload {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

export class MetaApiError extends Error {
  readonly httpStatus: number;
  readonly meta: MetaErrorPayload;
  constructor(httpStatus: number, meta: MetaErrorPayload) {
    super(`Meta Graph API error ${meta.code ?? "?"}: ${meta.message}`);
    this.name = "MetaApiError";
    this.httpStatus = httpStatus;
    this.meta = meta;
  }
}

export class MetaClient {
  private readonly http: AxiosInstance;
  private readonly accessToken: string;

  constructor(accessToken: string, apiVersion: string) {
    this.accessToken = accessToken;
    this.http = axios.create({
      baseURL: `https://graph.facebook.com/${apiVersion}`,
      timeout: 30_000,
      headers: { "User-Agent": "claude-meta-mcp/0.1.0" },
    });
  }

  /**
   * GET a Graph API endpoint with the access_token appended automatically.
   */
  async get<T = unknown>(
    path: string,
    params: Record<string, string | number | boolean | undefined> = {}
  ): Promise<T> {
    const finalParams: Record<string, string | number | boolean> = {
      access_token: this.accessToken,
    };
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) finalParams[key] = value;
    }
    try {
      const response = await this.http.get<T>(path, { params: finalParams });
      return response.data;
    } catch (err) {
      throw this.wrap(err);
    }
  }

  /**
   * POST to a Graph API endpoint. Body fields are sent as
   * application/x-www-form-urlencoded (Graph's native format).
   * Pass `access_token` in `params` to override the default token —
   * useful for Page tokens.
   */
  async post<T = unknown>(
    path: string,
    body: Record<string, string | number | boolean | undefined> = {},
    params: Record<string, string | number | boolean | undefined> = {}
  ): Promise<T> {
    const finalParams: Record<string, string | number | boolean> = {
      access_token: this.accessToken,
    };
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) finalParams[key] = value;
    }
    const finalBody = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) finalBody.append(key, String(value));
    }
    try {
      const response = await this.http.post<T>(path, finalBody, {
        params: finalParams,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      return response.data;
    } catch (err) {
      throw this.wrap(err);
    }
  }

  /**
   * DELETE a Graph API resource. Returns Graph's `{ success: true }` payload.
   */
  async delete<T = unknown>(
    path: string,
    params: Record<string, string | number | boolean | undefined> = {}
  ): Promise<T> {
    const finalParams: Record<string, string | number | boolean> = {
      access_token: this.accessToken,
    };
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) finalParams[key] = value;
    }
    try {
      const response = await this.http.delete<T>(path, { params: finalParams });
      return response.data;
    } catch (err) {
      throw this.wrap(err);
    }
  }

  /**
   * Fetch the Page Access Token for a Page the authenticated user manages.
   * Required for Page-scoped writes (creating posts, etc.).
   */
  async getPageAccessToken(pageId: string): Promise<string> {
    const result = await this.get<{ access_token?: string }>(`/${pageId}`, {
      fields: "access_token",
    });
    if (!result.access_token) {
      throw new Error(
        `No Page Access Token returned for page ${pageId}. ` +
          "Check that the System User has 'Manage Page' rights on this Page."
      );
    }
    return result.access_token;
  }

  /**
   * Convenience: list all pages of a paginated edge into a flat array.
   * Stops at `maxPages` to avoid runaway queries.
   */
  async listAll<T = unknown>(
    path: string,
    params: Record<string, string | number | boolean | undefined> = {},
    maxPages = 5
  ): Promise<T[]> {
    const all: T[] = [];
    let nextPath: string | null = path;
    let nextParams: Record<string, string | number | boolean | undefined> = {
      ...params,
    };
    let pages = 0;

    interface Page<U> {
      data: U[];
      paging?: { next?: string };
    }

    while (nextPath && pages < maxPages) {
      const page: Page<T> = await this.get<Page<T>>(nextPath, nextParams);
      if (Array.isArray(page.data)) all.push(...page.data);
      if (page.paging?.next) {
        // The "next" URL is absolute and includes query params + token.
        // Strip the base + token to feed back into our axios instance.
        const url: URL = new URL(page.paging.next);
        nextPath = url.pathname.replace(/^\/v\d+\.\d+/, "");
        const next: Record<string, string> = Object.fromEntries(
          url.searchParams
        );
        delete next.access_token;
        nextParams = next;
      } else {
        nextPath = null;
      }
      pages += 1;
    }
    return all;
  }

  private wrap(err: unknown): Error {
    if (err instanceof AxiosError && err.response?.data?.error) {
      const meta = err.response.data.error as MetaErrorPayload;
      return new MetaApiError(err.response.status, meta);
    }
    if (err instanceof AxiosError) {
      return new Error(`Network error calling Meta Graph API: ${err.message}`);
    }
    return err as Error;
  }
}
