/**
 * IPFS operations for OPNet CLI
 *
 * Handles pinning and fetching plugin binaries from IPFS.
 *
 * @module lib/ipfs
 */

import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as crypto from 'crypto';
import ora, { Ora } from 'ora';
import { loadConfig } from './config.js';

/**
 * IPFS pinning result
 */
export interface PinResult {
    cid: string;
    size: number;
}

/**
 * IPFS gateway fetch result
 */
export interface FetchResult {
    data: Buffer;
    size: number;
}

/**
 * HTTP request options
 */
interface RequestOptions {
    method: string;
    headers?: Record<string, string>;
    body?: Buffer | string;
    timeout?: number;
    followRedirect?: boolean;
    maxRedirects?: number;
    maxResponseSize?: number;
    onProgress?: (bytesSent: number, totalBytes: number) => void;
    onUploadComplete?: () => void;
}

const DEFAULT_MAX_REDIRECTS = 10;
const MAX_RESPONSE_SIZE = 512 * 1024 * 1024; // 512 MB

/**
 * Make an HTTP/HTTPS request with redirect support
 *
 * @param url - The URL to request
 * @param options - Request options
 * @param redirectCount - Current redirect count (internal)
 * @returns Response body buffer
 */

/**
 * Check if a URL targets a private/internal IP range (SSRF protection).
 */
function isPrivateUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname;

        // Block common private/internal ranges
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '[::1]' ||
            hostname === '0.0.0.0' ||
            hostname.endsWith('.local') ||
            hostname.endsWith('.internal')
        ) {
            return true;
        }

        // Block private IPv4 ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x
        const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        if (ipv4Match) {
            const [, a, b] = ipv4Match.map(Number);
            if (
                a === 10 ||
                a === 127 ||
                (a === 172 && b >= 16 && b <= 31) ||
                (a === 192 && b === 168) ||
                (a === 169 && b === 254) ||
                a === 0
            ) {
                return true;
            }
        }

        return false;
    } catch {
        return true; // Block unparseable URLs
    }
}

/**
 * Strip auth headers when redirecting cross-origin to prevent credential leakage.
 */
function getSafeRedirectOptions(
    options: RequestOptions,
    originalUrl: string,
    redirectUrl: string,
): RequestOptions {
    const original = new URL(originalUrl);
    const redirect = new URL(redirectUrl);

    const sameOrigin = original.origin === redirect.origin;

    if (sameOrigin) {
        return options;
    }

    // Cross-origin redirect: strip sensitive headers
    const safeHeaders: Record<string, string> = {};
    if (options.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
            const lower = key.toLowerCase();
            if (lower !== 'authorization' && lower !== 'cookie') {
                safeHeaders[key] = value;
            }
        }
    }

    return { ...options, headers: safeHeaders };
}

async function httpRequest(
    url: string,
    options: RequestOptions,
    redirectCount: number = 0,
): Promise<Buffer> {
    const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    const followRedirect = options.followRedirect ?? false;

    if (redirectCount > maxRedirects) {
        throw new Error(`Maximum redirects (${maxRedirects}) exceeded`);
    }

    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const lib = isHttps ? https : http;

        const reqOptions: https.RequestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method,
            headers: options.headers || {},
            timeout: options.timeout || 30000,
        };

        const req = lib.request(reqOptions, (res) => {
            const statusCode = res.statusCode ?? 0;

            // Handle redirects - check for location header (case-insensitive)
            if (followRedirect && statusCode >= 300 && statusCode < 400) {
                const locationHeader = res.headers.location || res.headers['Location'];
                const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
                if (location) {
                    const redirectUrl = new URL(location, url).href;
                    if (isPrivateUrl(redirectUrl)) {
                        res.resume();
                        reject(
                            new Error(
                                `Redirect blocked: target resolves to a private/internal address`,
                            ),
                        );
                        return;
                    }
                    const safeOptions = getSafeRedirectOptions(options, url, redirectUrl);
                    res.resume();
                    httpRequest(redirectUrl, safeOptions, redirectCount + 1)
                        .then(resolve)
                        .catch(reject);
                    return;
                }
            }

            const chunks: Buffer[] = [];
            let totalSize = 0;
            const maxResponseSize = options.maxResponseSize ?? MAX_RESPONSE_SIZE;

            res.on('data', (chunk: Buffer) => {
                totalSize += chunk.length;
                if (totalSize > maxResponseSize) {
                    req.destroy();
                    reject(new Error(`Response size exceeded limit (${maxResponseSize} bytes)`));
                    return;
                }
                chunks.push(chunk);
            });

            res.on('end', () => {
                const body = Buffer.concat(chunks);

                // For redirects without Location header, try to extract from HTML body
                if (followRedirect && statusCode >= 300 && statusCode < 400) {
                    const bodyStr = body.toString();
                    const hrefMatch = bodyStr.match(/href="([^"]+)"/);
                    if (hrefMatch && hrefMatch[1]) {
                        const redirectUrl = new URL(hrefMatch[1], url).href;
                        if (isPrivateUrl(redirectUrl)) {
                            reject(
                                new Error(
                                    `Redirect blocked: target resolves to a private/internal address`,
                                ),
                            );
                            return;
                        }
                        const safeOptions = getSafeRedirectOptions(options, url, redirectUrl);
                        httpRequest(redirectUrl, safeOptions, redirectCount + 1)
                            .then(resolve)
                            .catch(reject);
                        return;
                    }
                }

                if (statusCode >= 200 && statusCode < 300) {
                    resolve(body);
                } else {
                    const bodyStr = body.toString().slice(0, 200);
                    const truncated = body.length > 200 ? '...' : '';
                    reject(
                        new Error(
                            `HTTP ${statusCode}: ${res.statusMessage}${bodyStr ? ` - ${bodyStr}${truncated}` : ''}`,
                        ),
                    );
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options.body) {
            const bodyBuffer = Buffer.isBuffer(options.body)
                ? options.body
                : Buffer.from(options.body);
            const totalBytes = bodyBuffer.length;
            const chunkSize = 64 * 1024; // 64KB chunks
            let bytesSent = 0;

            const writeChunk = () => {
                while (bytesSent < totalBytes) {
                    const end = Math.min(bytesSent + chunkSize, totalBytes);
                    const chunk = bodyBuffer.subarray(bytesSent, end);
                    const canContinue = req.write(chunk);
                    bytesSent += chunk.length;

                    if (options.onProgress) {
                        options.onProgress(bytesSent, totalBytes);
                    }

                    if (!canContinue) {
                        req.once('drain', writeChunk);
                        return;
                    }
                }
                if (options.onUploadComplete) {
                    options.onUploadComplete();
                }
                req.end();
            };

            writeChunk();
        } else {
            if (options.onUploadComplete) {
                options.onUploadComplete();
            }
            req.end();
        }
    });
}

/**
 * Pin a file to IPFS using the configured pinning service
 *
 * @param data - The file data to pin
 * @param name - Optional file name for metadata
 * @returns The IPFS CID
 */
export async function pinToIPFS(data: Buffer, name?: string): Promise<PinResult> {
    try {
        const config = loadConfig();
        const endpoint = config.ipfsPinningEndpoint;

        if (!endpoint) {
            throw new Error(
                'IPFS pinning endpoint not configured. Run `opnet config set ipfsPinningEndpoint <url>`',
            );
        }

        // Build multipart form data
        const boundary = '----FormBoundary' + crypto.randomBytes(16).toString('hex');
        const fileName = name || 'plugin.opnet';

        const formParts: Buffer[] = [];

        // File part
        formParts.push(
            Buffer.from(
                `--${boundary}\r\n` +
                    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
                    `Content-Type: application/octet-stream\r\n\r\n`,
            ),
        );
        formParts.push(data);
        formParts.push(Buffer.from('\r\n'));

        // End boundary
        formParts.push(Buffer.from(`--${boundary}--\r\n`));

        const body = Buffer.concat(formParts);

        // Build headers
        const headers: Record<string, string> = {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length.toString(),
        };

        // Add authorization if configured
        if (config.ipfsPinningAuthHeader) {
            const colonIndex = config.ipfsPinningAuthHeader.indexOf(':');
            if (colonIndex > 0) {
                const headerName = config.ipfsPinningAuthHeader.substring(0, colonIndex).trim();
                const headerValue = config.ipfsPinningAuthHeader.substring(colonIndex + 1).trim();
                if (headerName && headerValue) {
                    headers[headerName] = headerValue;
                }
            }
        } else if (config.ipfsPinningApiKey) {
            headers['Authorization'] = `Bearer ${config.ipfsPinningApiKey}`;
        }

        // Detect pinning service type from URL and adjust request
        const url = new URL(endpoint);

        let requestUrl: string;
        if (url.hostname === 'ipfs.opnet.org' || url.hostname.endsWith('.ipfs.opnet.org')) {
            // OPNet IPFS gateway - uses standard IPFS API
            requestUrl = endpoint;
        } else if (url.hostname.endsWith('.pinata.cloud') || url.hostname === 'pinata.cloud') {
            // Pinata-specific endpoint
            requestUrl = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
            // Only set pinata_api_key header if using API key (not JWT)
            // JWT tokens start with "eyJ", API keys don't
            if (config.ipfsPinningApiKey && !config.ipfsPinningApiKey.startsWith('eyJ')) {
                headers['pinata_api_key'] = config.ipfsPinningApiKey;
                if (config.ipfsPinningSecret) {
                    headers['pinata_secret_api_key'] = config.ipfsPinningSecret;
                }
            }
        } else if (url.hostname.endsWith('.web3.storage') || url.hostname === 'web3.storage' || url.hostname.endsWith('.w3s.link') || url.hostname === 'w3s.link') {
            // web3.storage endpoint
            requestUrl = endpoint.endsWith('/') ? endpoint + 'upload' : endpoint + '/upload';
        } else if (url.hostname.endsWith('.nft.storage') || url.hostname === 'nft.storage') {
            // nft.storage endpoint
            requestUrl = 'https://api.nft.storage/upload';
        } else if (url.pathname.includes('/api/v0/')) {
            // Standard IPFS API endpoint
            requestUrl = endpoint;
        } else {
            // Generic IPFS pinning service (assumed to follow IPFS Pinning Services API)
            requestUrl = endpoint.endsWith('/') ? endpoint + 'pins' : endpoint + '/pins';
        }

        const response = await httpRequest(requestUrl, {
            method: 'POST',
            headers,
            body,
            timeout: 120000, // 2 minutes for upload
            followRedirect: true,
        });

        // Parse response to extract CID
        const result = JSON.parse(response.toString()) as Record<string, unknown>;

        // Handle different response formats
        let cid: string | undefined;

        if (typeof result.IpfsHash === 'string') {
            // Pinata format
            cid = result.IpfsHash;
        } else if (typeof result.cid === 'string') {
            // web3.storage / nft.storage format
            cid = result.cid;
        } else if (typeof result.Hash === 'string') {
            // IPFS API format
            cid = result.Hash;
        } else if (
            result.value &&
            typeof (result.value as Record<string, unknown>).cid === 'string'
        ) {
            // NFT.storage wrapped format
            cid = (result.value as Record<string, unknown>).cid as string;
        }

        if (!cid) {
            throw new Error(
                `Failed to extract CID from pinning response: ${JSON.stringify(result)}`,
            );
        }

        // Convert to CIDv1 if the pinning service returned CIDv0
        if (isCIDv0(cid)) {
            cid = cidV0toV1(cid);
        }

        return {
            cid,
            size: data.length,
        };
    } catch (e) {
        throw new Error(`IPFS pinning failed: ${e instanceof Error ? e.message : String(e)}`, {
            cause: e,
        });
    }
}

/**
 * Fetch a file from IPFS using configured gateways
 *
 * @param cid - The IPFS CID
 * @returns The file data
 */
export async function fetchFromIPFS(cid: string): Promise<FetchResult> {
    const config = loadConfig();
    const gateways = config.ipfsGateways.length > 0 ? config.ipfsGateways : [config.ipfsGateway];

    let lastError: Error | undefined;

    for (const gateway of gateways) {
        try {
            const url = buildGatewayUrl(gateway, cid);
            const data = await httpRequest(url, {
                headers: {
                    Accept: 'application/octet-stream',
                    'User-Agent': 'OPNet-CLI/1.0',
                },
                method: 'GET',
                timeout: 60000, // 1 minute
                followRedirect: true,
            });

            return {
                data,
                size: data.length,
            };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // Try next gateway
        }
    }

    throw new Error(`Failed to fetch from all gateways: ${lastError?.message}`);
}

/**
 * Build a gateway URL for a CID
 *
 * @param gateway - The gateway base URL
 * @param cid - The IPFS CID
 * @returns Full URL
 */
export function buildGatewayUrl(gateway: string, cid: string): string {
    // Remove trailing slash
    const base = gateway.replace(/\/$/, '');

    // Handle different gateway URL patterns
    if (base.includes('{cid}')) {
        // Template URL
        return base.replace('{cid}', cid);
    } else if (base.endsWith('/ipfs')) {
        // Gateway already ends with /ipfs
        return `${base}/${cid}`;
    } else if (base.includes('/ipfs/')) {
        // Path-style gateway with trailing content
        return `${base}${cid}`;
    } else {
        // Standard gateway
        return `${base}/ipfs/${cid}`;
    }
}

/**
 * Validate an IPFS CID
 *
 * @param cid - The CID to validate
 * @returns True if valid CID format
 */
export function isValidCid(cid: string): boolean {
    // CIDv0 (Qm...) or CIDv1 (ba...)
    if (cid.startsWith('Qm') && cid.length === 46) {
        // CIDv0 base58btc
        return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid);
    } else if (cid.startsWith('ba')) {
        // CIDv1 base32
        return /^ba[a-z2-7]{57,}$/.test(cid);
    } else if (cid.startsWith('b')) {
        // Other CIDv1 bases
        return cid.length >= 50;
    }

    return false;
}

/**
 * Check if a CID is CIDv0 format
 *
 * @param cid - The CID to check
 * @returns True if CIDv0
 */
export function isCIDv0(cid: string): boolean {
    return cid.startsWith('Qm') && cid.length === 46;
}

/**
 * Check if a CID is CIDv1 format
 *
 * @param cid - The CID to check
 * @returns True if CIDv1
 */
export function isCIDv1(cid: string): boolean {
    return cid.startsWith('baf') && cid.length >= 50;
}

// Base58 alphabet for decoding CIDv0
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// Base32 alphabet for encoding CIDv1 (RFC 4648 lowercase)
const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/**
 * Decode a base58 string to bytes
 */
function decodeBase58(str: string): Uint8Array {
    const bytes: number[] = [];

    for (const char of str) {
        const value = BASE58_ALPHABET.indexOf(char);
        if (value === -1) {
            throw new Error(`Invalid base58 character: ${char}`);
        }

        let carry = value;
        for (let i = 0; i < bytes.length; i++) {
            carry += bytes[i] * 58;
            bytes[i] = carry & 0xff;
            carry >>= 8;
        }

        while (carry > 0) {
            bytes.push(carry & 0xff);
            carry >>= 8;
        }
    }

    // Handle leading zeros (1s in base58)
    for (const char of str) {
        if (char === '1') {
            bytes.push(0);
        } else {
            break;
        }
    }

    return new Uint8Array(bytes.reverse());
}

/**
 * Encode bytes to base32 lowercase string
 */
function encodeBase32(bytes: Uint8Array): string {
    let result = '';
    let bits = 0;
    let value = 0;

    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;

        while (bits >= 5) {
            bits -= 5;
            result += BASE32_ALPHABET[(value >> bits) & 0x1f];
        }
    }

    // Handle remaining bits
    if (bits > 0) {
        result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
    }

    return result;
}

/**
 * Convert a CIDv0 to CIDv1 format (base32)
 *
 * CIDv0: base58btc-encoded multihash (Qm...)
 * CIDv1: multibase-prefix + version(1) + codec(0x70 dag-pb) + multihash
 *
 * @param cidv0 - The CIDv0 string
 * @returns CIDv1 string in base32
 */
export function cidV0toV1(cidv0: string): string {
    if (!isCIDv0(cidv0)) {
        // Already CIDv1 or invalid
        return cidv0;
    }

    // Decode the base58 CIDv0 to get the multihash
    const multihash = decodeBase58(cidv0);

    // Verify it's a valid multihash (should start with 0x12 0x20 for sha2-256)
    if (multihash[0] !== 0x12 || multihash[1] !== 0x20 || multihash.length !== 34) {
        throw new Error('Invalid CIDv0: not a valid sha2-256 multihash');
    }

    // Create CIDv1: version (1) + codec (0x70 = dag-pb) + multihash
    const cidv1Bytes = new Uint8Array(2 + multihash.length);
    cidv1Bytes[0] = 0x01; // CID version 1
    cidv1Bytes[1] = 0x70; // dag-pb codec
    cidv1Bytes.set(multihash, 2);

    // Encode as base32 lowercase with 'b' prefix
    return 'b' + encodeBase32(cidv1Bytes);
}

/**
 * Download a plugin binary from IPFS and save to file
 *
 * @param cid - The IPFS CID
 * @param outputPath - Path to save the file
 * @returns The downloaded file size
 */
export async function downloadPlugin(cid: string, outputPath: string): Promise<number> {
    const result = await fetchFromIPFS(cid);
    fs.writeFileSync(outputPath, result.data);
    return result.size;
}

/**
 * Upload a plugin binary file to IPFS
 *
 * @param filePath - Path to the plugin file
 * @returns The IPFS CID
 */
export async function uploadPlugin(filePath: string): Promise<PinResult> {
    const data = fs.readFileSync(filePath);
    const fileName = filePath.split('/').pop() || 'plugin.opnet';
    return pinToIPFS(data, fileName);
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dirPath: string, basePath: string = ''): { path: string; fullPath: string }[] {
    const files: { path: string; fullPath: string }[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;
        const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
            files.push(...getAllFiles(fullPath, relativePath));
        } else if (entry.isFile()) {
            files.push({ path: relativePath, fullPath });
        }
    }

    return files;
}

/**
 * Get MIME type for a file extension
 */
function getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
        html: 'text/html',
        htm: 'text/html',
        css: 'text/css',
        js: 'application/javascript',
        mjs: 'application/javascript',
        json: 'application/json',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        ico: 'image/x-icon',
        webp: 'image/webp',
        woff: 'font/woff',
        woff2: 'font/woff2',
        ttf: 'font/ttf',
        eot: 'application/vnd.ms-fontobject',
        txt: 'text/plain',
        xml: 'application/xml',
        pdf: 'application/pdf',
        zip: 'application/zip',
        wasm: 'application/wasm',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Directory upload result
 */
export interface DirectoryPinResult {
    cid: string;
    files: number;
    totalSize: number;
}

/**
 * Generate a random UUID for session isolation
 */
function generateSessionId(): string {
    return crypto.randomUUID();
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make an MFS API call with retry logic
 */
async function mfsCall(
    endpoint: string,
    apiPath: string,
    params: Record<string, string>,
    body?: Buffer,
    headers?: Record<string, string>,
    maxRetries: number = 3,
): Promise<Buffer> {
    const url = new URL(endpoint);
    url.pathname = apiPath;
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }

    const reqHeaders: Record<string, string> = {
        ...headers,
    };

    let formBody: Buffer | undefined;
    if (body) {
        const boundary = '----FormBoundary' + crypto.randomBytes(16).toString('hex');
        const formParts: Buffer[] = [];
        formParts.push(
            Buffer.from(
                `--${boundary}\r\n` +
                    `Content-Disposition: form-data; name="file"\r\n` +
                    `Content-Type: application/octet-stream\r\n\r\n`,
            ),
        );
        formParts.push(body);
        formParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

        formBody = Buffer.concat(formParts);
        reqHeaders['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
        reqHeaders['Content-Length'] = formBody.length.toString();
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await httpRequest(url.toString(), {
                method: 'POST',
                headers: reqHeaders,
                body: formBody,
                timeout: body ? 120000 : 60000,
                followRedirect: true,
            });
        } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));

            // Check if it's a rate limit error (429)
            if (lastError.message.includes('429')) {
                const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                await sleep(backoffMs);
                continue;
            }

            // For other errors, throw immediately
            throw lastError;
        }
    }

    throw lastError || new Error('Max retries exceeded');
}

/**
 * Upload a directory to IPFS using MFS (Mutable File System)
 * This uploads files one by one to avoid response truncation issues
 *
 * @param dirPath - Path to the directory to upload
 * @param _wrapWithDirectory - Ignored, MFS always creates a directory
 * @returns The IPFS CID of the directory
 */
export async function uploadDirectory(
    dirPath: string,
    _wrapWithDirectory: boolean = true,
): Promise<DirectoryPinResult> {
    const config = loadConfig();
    const endpoint = config.ipfsPinningEndpoint;

    if (!endpoint) {
        throw new Error(
            'IPFS pinning endpoint not configured. Run `opnet config set ipfsPinningEndpoint <url>`',
        );
    }

    // Get base URL (remove /api/v0/add if present)
    const baseUrl = endpoint.replace(/\/api\/v0\/add\/?$/, '');

    // Get all files in directory
    const files = getAllFiles(dirPath);
    if (files.length === 0) {
        throw new Error('Directory is empty');
    }

    // Calculate total size
    let totalSize = 0;
    for (const file of files) {
        const stat = fs.statSync(file.fullPath);
        totalSize += stat.size;
    }

    // Generate unique session ID to avoid conflicts
    const sessionId = generateSessionId();
    const mfsPath = `/uploads/${sessionId}`;

    // Build auth headers
    const headers: Record<string, string> = {};
    if (config.ipfsPinningApiKey) {
        headers['Authorization'] = `Bearer ${config.ipfsPinningApiKey}`;
    }

    const formatBytes = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    let uploadedBytes = 0;
    let spinner: Ora | null = null;

    try {
        // Create MFS directory
        await mfsCall(
            baseUrl,
            '/api/v0/files/mkdir',
            {
                arg: mfsPath,
                parents: 'true',
            },
            undefined,
            headers,
        );

        // Upload files one by one
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const data = fs.readFileSync(file.fullPath);
            const fileMfsPath = `${mfsPath}/${file.path}`;

            // Create parent directories if needed
            const parentDir = fileMfsPath.substring(0, fileMfsPath.lastIndexOf('/'));
            if (parentDir !== mfsPath) {
                await mfsCall(
                    baseUrl,
                    '/api/v0/files/mkdir',
                    {
                        arg: parentDir,
                        parents: 'true',
                    },
                    undefined,
                    headers,
                );
            }

            // Upload file
            await mfsCall(
                baseUrl,
                '/api/v0/files/write',
                {
                    arg: fileMfsPath,
                    create: 'true',
                    parents: 'true',
                    truncate: 'true',
                },
                data,
                headers,
            );

            uploadedBytes += data.length;

            // Show progress
            const percent = Math.round((uploadedBytes / totalSize) * 100);
            const barWidth = 30;
            const filled = Math.round((percent / 100) * barWidth);
            const empty = barWidth - filled;
            const bar = '█'.repeat(filled) + '░'.repeat(empty);

            process.stdout.write(
                `\r  Uploading: [${bar}] ${percent}% - ${i + 1}/${files.length} files (${formatBytes(uploadedBytes)}/${formatBytes(totalSize)})`,
            );
        }

        process.stdout.write('\n');

        // Get the CID of the uploaded directory
        spinner = ora({
            text: 'Getting directory CID...',
            spinner: 'dots',
        }).start();

        // Request CIDv1 format (base32) from IPFS
        const statResponse = await mfsCall(
            baseUrl,
            '/api/v0/files/stat',
            {
                arg: mfsPath,
                hash: 'true',
                'cid-base': 'base32',
            },
            undefined,
            headers,
        );

        const statResult = JSON.parse(statResponse.toString()) as { Hash: string };
        let cid = statResult.Hash;

        if (!cid) {
            spinner.fail('Failed to get directory CID');
            throw new Error('MFS stat did not return a Hash');
        }

        // Convert to CIDv1 if IPFS returned CIDv0 (some nodes don't support cid-base parameter)
        if (isCIDv0(cid)) {
            cid = cidV0toV1(cid);
        }

        // Pin the CID so it's not garbage collected
        spinner.text = 'Pinning content...';
        try {
            await mfsCall(
                baseUrl,
                '/api/v0/pin/add',
                {
                    arg: cid,
                },
                undefined,
                headers,
            );
        } catch {
            // Pin might fail if already pinned or not supported, continue anyway
        }

        spinner.succeed(`Upload complete: ${cid}`);

        // Cleanup MFS directory (best effort, don't fail if this fails)
        try {
            await mfsCall(
                baseUrl,
                '/api/v0/files/rm',
                {
                    arg: mfsPath,
                    recursive: 'true',
                },
                undefined,
                headers,
            );
        } catch {
            // Ignore cleanup errors
        }

        return {
            cid,
            files: files.length,
            totalSize,
        };
    } catch (e) {
        // Stop spinner if running
        if (spinner) {
            spinner.fail('Upload failed');
        }

        // Try to cleanup on error
        try {
            await mfsCall(
                baseUrl,
                '/api/v0/files/rm',
                {
                    arg: mfsPath,
                    recursive: 'true',
                },
                undefined,
                headers,
            );
        } catch {
            // Ignore cleanup errors
        }

        throw new Error(
            `IPFS directory upload failed: ${e instanceof Error ? e.message : String(e)}`,
            { cause: e },
        );
    }
}

/**
 * Upload a single file to IPFS (convenience wrapper)
 *
 * @param filePath - Path to the file
 * @returns The IPFS CID
 */
export async function uploadFile(filePath: string): Promise<PinResult> {
    const data = fs.readFileSync(filePath);
    const fileName = filePath.split('/').pop() || 'file';
    return pinToIPFS(data, fileName);
}
