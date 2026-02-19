/**
 * .opnet Binary Format Parser/Writer
 *
 * Implements the OIP-0003 binary format for compiled plugins.
 *
 * @module lib/binary
 */

import * as crypto from 'crypto';
import {
    IParsedPluginFile,
    IPluginMetadata,
    MLDSA_PUBLIC_KEY_SIZES,
    MLDSA_SIGNATURE_SIZES,
    MLDSALevel,
    PLUGIN_FORMAT_VERSION,
    PLUGIN_MAGIC_BYTES,
} from '@btc-vision/plugin-sdk';

import { cliLevelToMLDSALevel, CLIMldsaLevel, mldsaLevelToCLI } from '../types/index.js';

const HEX_CHARS = '0123456789abcdef';

/**
 * Convert a Uint8Array to a hex string
 */
export function toHex(data: Uint8Array): string {
    let hex = '';
    for (let i = 0; i < data.length; i++) {
        hex += HEX_CHARS[data[i] >> 4] + HEX_CHARS[data[i] & 0xf];
    }
    return hex;
}

/**
 * Parse a .opnet binary file
 *
 * @param data - The binary file contents
 * @returns Parsed binary structure
 * @throws Error if the binary is malformed
 */
export function parseOpnetBinary(data: Uint8Array): IParsedPluginFile {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    // Check minimum size
    if (data.length < 8 + 4 + 1) {
        throw new Error('Binary too small: missing header');
    }

    // Magic bytes (8 bytes)
    const magic = data.subarray(offset, offset + 8);
    offset += 8;

    if (!PLUGIN_MAGIC_BYTES.every((b, i) => magic[i] === b)) {
        throw new Error(
            `Invalid magic bytes: expected ${toHex(PLUGIN_MAGIC_BYTES)}, got ${toHex(magic)}`,
        );
    }

    // Format version (uint32 LE)
    const formatVersion = view.getUint32(offset, true);
    offset += 4;

    if (formatVersion !== PLUGIN_FORMAT_VERSION) {
        throw new Error(
            `Unsupported format version: ${formatVersion} (expected ${PLUGIN_FORMAT_VERSION})`,
        );
    }

    // MLDSA level (uint8)
    const mldsaLevelValue = view.getUint8(offset);
    offset += 1;

    if (mldsaLevelValue > 2) {
        throw new Error(`Invalid MLDSA level: ${mldsaLevelValue} (must be 0, 1, or 2)`);
    }

    const mldsaLevel = mldsaLevelValue as MLDSALevel;

    // Get sizes based on level
    const publicKeySize = MLDSA_PUBLIC_KEY_SIZES[mldsaLevel];
    const signatureSize = MLDSA_SIGNATURE_SIZES[mldsaLevel];

    // Check we have enough data
    const minSize = offset + publicKeySize + signatureSize + 4 + 4 + 4 + 32;
    if (data.length < minSize) {
        throw new Error(`Binary truncated: expected at least ${minSize} bytes, got ${data.length}`);
    }

    // Public key
    const publicKey = data.slice(offset, offset + publicKeySize);
    offset += publicKeySize;

    // Signature
    const signature = data.slice(offset, offset + signatureSize);
    offset += signatureSize;

    // Metadata length (uint32 LE)
    const metadataLength = view.getUint32(offset, true);
    offset += 4;

    if (offset + metadataLength > data.length) {
        throw new Error(`Metadata section truncated at offset ${offset}`);
    }

    // Metadata
    const metadataBytes = data.subarray(offset, offset + metadataLength);
    offset += metadataLength;

    const decoder = new TextDecoder();
    let rawMetadata: string;
    let metadata: IPluginMetadata;
    try {
        rawMetadata = decoder.decode(metadataBytes);
        metadata = JSON.parse(rawMetadata) as IPluginMetadata;
    } catch {
        throw new Error('Malformed JSON metadata');
    }

    // Bytecode length (uint32 LE)
    const bytecodeLength = view.getUint32(offset, true);
    offset += 4;

    if (offset + bytecodeLength > data.length) {
        throw new Error(`Bytecode section truncated at offset ${offset}`);
    }

    // Bytecode
    const bytecode = data.slice(offset, offset + bytecodeLength);
    offset += bytecodeLength;

    // Proto length (uint32 LE)
    const protoLength = view.getUint32(offset, true);
    offset += 4;

    if (offset + protoLength > data.length) {
        throw new Error(`Proto section truncated at offset ${offset}`);
    }

    // Proto
    const proto =
        protoLength > 0 ? data.slice(offset, offset + protoLength) : undefined;
    offset += protoLength;

    // Checksum (32 bytes)
    if (offset + 32 > data.length) {
        throw new Error('Checksum truncated');
    }

    const checksum = data.slice(offset, offset + 32);

    return {
        formatVersion,
        mldsaLevel,
        publicKey,
        signature,
        metadata,
        rawMetadata,
        bytecode,
        proto,
        checksum,
    };
}

/**
 * Compute the checksum for plugin data
 *
 * @param metadata - JSON metadata bytes
 * @param bytecode - V8 bytecode bytes
 * @param proto - Proto bytes (can be empty)
 * @returns SHA-256 hash
 */
export function computeChecksum(
    metadata: Uint8Array,
    bytecode: Uint8Array,
    proto: Uint8Array,
): Uint8Array {
    const hash = crypto.createHash('sha256');
    hash.update(metadata);
    hash.update(bytecode);
    hash.update(proto);
    return hash.digest();
}

/**
 * Verify the checksum of parsed binary
 *
 * @param parsed - The parsed binary structure
 * @returns True if checksum matches
 */
export function verifyChecksum(parsed: IParsedPluginFile): boolean {
    const encoder = new TextEncoder();
    const metadataBytes = encoder.encode(parsed.rawMetadata);
    const computed = computeChecksum(
        metadataBytes,
        parsed.bytecode,
        parsed.proto ?? new Uint8Array(0),
    );
    if (computed.length !== parsed.checksum.length) {
        return false;
    }
    return crypto.timingSafeEqual(computed, parsed.checksum);
}

/**
 * Build a .opnet binary file
 *
 * @param options - Build options
 * @returns The assembled binary and the checksum that was signed
 */
export function buildOpnetBinary(options: {
    mldsaLevel: CLIMldsaLevel;
    publicKey: Uint8Array;
    metadata: IPluginMetadata;
    bytecode: Uint8Array;
    proto?: Uint8Array;
    signFn?: (checksum: Uint8Array) => Uint8Array;
}): { binary: Uint8Array; checksum: Uint8Array } {
    const {
        mldsaLevel,
        publicKey,
        metadata,
        bytecode,
        proto = new Uint8Array(0),
        signFn,
    } = options;

    const sdkLevel = cliLevelToMLDSALevel(mldsaLevel);

    // Validate public key size
    const expectedPkSize = MLDSA_PUBLIC_KEY_SIZES[sdkLevel];
    const expectedSigSize = MLDSA_SIGNATURE_SIZES[sdkLevel];

    if (publicKey.length !== expectedPkSize) {
        throw new Error(
            `Public key size mismatch: expected ${expectedPkSize}, got ${publicKey.length}`,
        );
    }

    const encoder = new TextEncoder();

    // First pass: compute checksum without the checksum field set
    const tempMetadata = { ...metadata, checksum: '' };
    const tempMetadataBytes = encoder.encode(JSON.stringify(tempMetadata));
    const checksum = computeChecksum(tempMetadataBytes, bytecode, proto);
    const checksumHex = `sha256:${toHex(checksum)}`;

    // Second pass: serialize metadata with checksum included
    const finalMetadata = { ...metadata, checksum: checksumHex };
    const metadataBytes = encoder.encode(JSON.stringify(finalMetadata));

    // Recompute checksum with the final metadata (includes checksum field)
    const finalChecksum = computeChecksum(metadataBytes, bytecode, proto);

    // Sign the final checksum (this is what gets verified)
    const signature = signFn ? signFn(finalChecksum) : new Uint8Array(expectedSigSize);

    if (signature.length !== expectedSigSize) {
        throw new Error(
            `Signature size mismatch: expected ${expectedSigSize}, got ${signature.length}`,
        );
    }

    // Calculate total size
    const totalSize =
        8 + // magic
        4 + // version
        1 + // mldsa level
        publicKey.length +
        signature.length +
        4 +
        metadataBytes.length + // metadata
        4 +
        bytecode.length + // bytecode
        4 +
        proto.length + // proto
        32; // checksum

    // Build buffer
    const buffer = new Uint8Array(totalSize);
    const view = new DataView(buffer.buffer);
    let offset = 0;

    // Magic bytes
    buffer.set(PLUGIN_MAGIC_BYTES, offset);
    offset += 8;

    // Format version
    view.setUint32(offset, PLUGIN_FORMAT_VERSION, true);
    offset += 4;

    // MLDSA level (enum value 0, 1, or 2)
    view.setUint8(offset, sdkLevel);
    offset += 1;

    // Public key
    buffer.set(publicKey, offset);
    offset += publicKey.length;

    // Signature
    buffer.set(signature, offset);
    offset += signature.length;

    // Metadata length
    view.setUint32(offset, metadataBytes.length, true);
    offset += 4;

    // Metadata
    buffer.set(metadataBytes, offset);
    offset += metadataBytes.length;

    // Bytecode length
    view.setUint32(offset, bytecode.length, true);
    offset += 4;

    // Bytecode
    buffer.set(bytecode, offset);
    offset += bytecode.length;

    // Proto length
    view.setUint32(offset, proto.length, true);
    offset += 4;

    // Proto
    buffer.set(proto, offset);
    offset += proto.length;

    // Checksum (use finalChecksum which was computed with metadata containing checksum hex)
    buffer.set(finalChecksum, offset);

    return { binary: buffer, checksum: finalChecksum };
}

/**
 * Extract just the metadata from a .opnet file without full validation
 *
 * @param data - The binary file contents
 * @returns The parsed metadata or null if invalid
 */
export function extractMetadata(data: Uint8Array): IPluginMetadata | null {
    try {
        const parsed = parseOpnetBinary(data);
        return parsed.metadata;
    } catch {
        return null;
    }
}

/**
 * Get the CLI MLDSA level from parsed binary
 */
export function getParsedMldsaLevel(parsed: IParsedPluginFile): CLIMldsaLevel {
    return mldsaLevelToCLI(parsed.mldsaLevel);
}

/**
 * Get file size formatted as human-readable string
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
}
