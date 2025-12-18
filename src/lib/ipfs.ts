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
}

const DEFAULT_MAX_REDIRECTS = 10;

/**
 * Make an HTTP/HTTPS request with redirect support
 *
 * @param url - The URL to request
 * @param options - Request options
 * @param redirectCount - Current redirect count (internal)
 * @returns Response body buffer
 */
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
                    res.resume();
                    httpRequest(redirectUrl, options, redirectCount + 1)
                        .then(resolve)
                        .catch(reject);
                    return;
                }
            }

            const chunks: Buffer[] = [];

            res.on('data', (chunk: Buffer) => {
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
                        httpRequest(redirectUrl, options, redirectCount + 1)
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
            req.write(options.body);
        }

        req.end();
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
        const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
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
            const [headerName, headerValue] = config.ipfsPinningAuthHeader
                .split(':')
                .map((s) => s.trim());
            if (headerName && headerValue) {
                headers[headerName] = headerValue;
            }
        } else if (config.ipfsPinningApiKey) {
            headers['Authorization'] = `Bearer ${config.ipfsPinningApiKey}`;
        }

        // Detect pinning service type from URL and adjust request
        const url = new URL(endpoint);

        let requestUrl: string;
        if (url.hostname.includes('ipfs.opnet.org')) {
            // OPNet IPFS gateway - uses standard IPFS API
            requestUrl = endpoint;
        } else if (url.hostname.includes('pinata')) {
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
        } else if (url.hostname.includes('web3.storage') || url.hostname.includes('w3s.link')) {
            // web3.storage endpoint
            requestUrl = endpoint.endsWith('/') ? endpoint + 'upload' : endpoint + '/upload';
        } else if (url.hostname.includes('nft.storage')) {
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

        return {
            cid,
            size: data.length,
        };
    } catch (e) {
        throw new Error(`IPFS pinning failed: ${e instanceof Error ? e.message : String(e)}`);
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
 * Upload a directory to IPFS
 *
 * @param dirPath - Path to the directory to upload
 * @param wrapWithDirectory - Whether to wrap files in a directory (default: true)
 * @returns The IPFS CID of the directory
 */
export async function uploadDirectory(
    dirPath: string,
    wrapWithDirectory: boolean = true,
): Promise<DirectoryPinResult> {
    try {
        const config = loadConfig();
        const endpoint = config.ipfsPinningEndpoint;

        if (!endpoint) {
            throw new Error(
                'IPFS pinning endpoint not configured. Run `opnet config set ipfsPinningEndpoint <url>`',
            );
        }

        // Get all files in directory
        const files = getAllFiles(dirPath);
        if (files.length === 0) {
            throw new Error('Directory is empty');
        }

        // Build multipart form data with all files
        const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
        const formParts: Buffer[] = [];
        let totalSize = 0;

        for (const file of files) {
            const data = fs.readFileSync(file.fullPath);
            totalSize += data.length;
            const mimeType = getMimeType(file.path);

            // Add file part
            formParts.push(
                Buffer.from(
                    `--${boundary}\r\n` +
                        `Content-Disposition: form-data; name="file"; filename="${file.path}"\r\n` +
                        `Content-Type: ${mimeType}\r\n\r\n`,
                ),
            );
            formParts.push(data);
            formParts.push(Buffer.from('\r\n'));
        }

        // End boundary
        formParts.push(Buffer.from(`--${boundary}--\r\n`));

        const body = Buffer.concat(formParts);

        // Build headers
        const headers: Record<string, string> = {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length.toString(),
        };

        // Add authorization if configured
        if (config.ipfsPinningApiKey) {
            headers['Authorization'] = `Bearer ${config.ipfsPinningApiKey}`;
        }

        // Build URL with wrap-with-directory parameter
        const url = new URL(endpoint);
        if (wrapWithDirectory) {
            url.searchParams.set('wrap-with-directory', 'true');
        }
        // Enable CIDv1 for better compatibility
        url.searchParams.set('cid-version', '1');

        const response = await httpRequest(url.toString(), {
            method: 'POST',
            headers,
            body,
            timeout: 300000, // 5 minutes for directory upload
            followRedirect: true,
        });

        // Parse NDJSON response (IPFS returns one JSON object per line)
        const lines = response.toString().trim().split('\n');
        let rootCid: string | undefined;

        for (const line of lines) {
            if (!line.trim()) continue;
            const result = JSON.parse(line) as Record<string, unknown>;

            // The last entry with empty Name is the root directory
            if (result.Hash && (result.Name === '' || !result.Name)) {
                rootCid = result.Hash as string;
            } else if (result.Hash && !rootCid) {
                // Fallback to last hash if no empty name found
                rootCid = result.Hash as string;
            }
        }

        if (!rootCid) {
            throw new Error(`Failed to extract root CID from response`);
        }

        return {
            cid: rootCid,
            files: files.length,
            totalSize,
        };
    } catch (e) {
        throw new Error(`IPFS directory upload failed: ${e instanceof Error ? e.message : String(e)}`);
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
