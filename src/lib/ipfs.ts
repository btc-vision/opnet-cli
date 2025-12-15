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
}

/**
 * Make an HTTP/HTTPS request
 *
 * @param url - The URL to request
 * @param options - Request options
 * @returns Response body buffer
 */
async function httpRequest(url: string, options: RequestOptions): Promise<Buffer> {
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
            const chunks: Buffer[] = [];

            res.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });

            res.on('end', () => {
                const body = Buffer.concat(chunks);

                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(body);
                } else {
                    reject(
                        new Error(
                            `HTTP ${res.statusCode}: ${res.statusMessage} - ${body.toString()}`,
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
        const [headerName, headerValue] = config.ipfsPinningAuthHeader.split(':').map((s) => s.trim());
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
        if (config.ipfsPinningApiKey) {
            headers['pinata_api_key'] = config.ipfsPinningApiKey;
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
    } else if (result.value && typeof (result.value as Record<string, unknown>).cid === 'string') {
        // NFT.storage wrapped format
        cid = (result.value as Record<string, unknown>).cid as string;
    }

    if (!cid) {
        throw new Error(`Failed to extract CID from pinning response: ${JSON.stringify(result)}`);
    }

    return {
        cid,
        size: data.length,
    };
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
                method: 'GET',
                timeout: 60000, // 1 minute
            });

            return {
                data,
                size: data.length,
            };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // Try next gateway
            continue;
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
    } else if (base.includes('/ipfs/')) {
        // Path-style gateway
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
 * Check if a CID is available on any gateway
 *
 * @param cid - The IPFS CID
 * @returns True if the file is accessible
 */
export async function checkAvailability(cid: string): Promise<boolean> {
    try {
        await fetchFromIPFS(cid);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get IPFS gateway status
 *
 * @returns Object with gateway availability status
 */
export async function getGatewayStatus(): Promise<Record<string, boolean>> {
    const config = loadConfig();
    const gateways = config.ipfsGateways.length > 0 ? config.ipfsGateways : [config.ipfsGateway];

    // Use a well-known CID for testing (empty directory)
    const testCid = 'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn';

    const status: Record<string, boolean> = {};

    await Promise.all(
        gateways.map(async (gateway) => {
            try {
                const url = buildGatewayUrl(gateway, testCid);
                await httpRequest(url, {
                    method: 'HEAD',
                    timeout: 10000,
                });
                status[gateway] = true;
            } catch {
                status[gateway] = false;
            }
        }),
    );

    return status;
}
