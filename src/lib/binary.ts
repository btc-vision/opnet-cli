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

/**
 * Parse a .opnet binary file
 *
 * @param data - The binary file contents
 * @returns Parsed binary structure
 * @throws Error if the binary is malformed
 */
export function parseOpnetBinary(data: Buffer): IParsedPluginFile {
    let offset = 0;

    // Check minimum size
    if (data.length < 8 + 4 + 1) {
        throw new Error('Binary too small: missing header');
    }

    // Magic bytes (8 bytes)
    const magic = data.subarray(offset, offset + 8);
    offset += 8;

    if (!magic.equals(PLUGIN_MAGIC_BYTES)) {
        throw new Error(
            `Invalid magic bytes: expected ${PLUGIN_MAGIC_BYTES.toString('hex')}, got ${magic.toString('hex')}`,
        );
    }

    // Format version (uint32 LE)
    const formatVersion = data.readUInt32LE(offset);
    offset += 4;

    if (formatVersion !== PLUGIN_FORMAT_VERSION) {
        throw new Error(
            `Unsupported format version: ${formatVersion} (expected ${PLUGIN_FORMAT_VERSION})`,
        );
    }

    // MLDSA level (uint8)
    const mldsaLevelValue = data.readUInt8(offset);
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
    const publicKey = Buffer.from(data.subarray(offset, offset + publicKeySize));
    offset += publicKeySize;

    // Signature
    const signature = Buffer.from(data.subarray(offset, offset + signatureSize));
    offset += signatureSize;

    // Metadata length (uint32 LE)
    const metadataLength = data.readUInt32LE(offset);
    offset += 4;

    if (offset + metadataLength > data.length) {
        throw new Error(`Metadata section truncated at offset ${offset}`);
    }

    // Metadata
    const metadataBytes = data.subarray(offset, offset + metadataLength);
    offset += metadataLength;

    let rawMetadata: string;
    let metadata: IPluginMetadata;
    try {
        rawMetadata = metadataBytes.toString('utf-8');
        metadata = JSON.parse(rawMetadata) as IPluginMetadata;
    } catch {
        throw new Error('Malformed JSON metadata');
    }

    // Bytecode length (uint32 LE)
    const bytecodeLength = data.readUInt32LE(offset);
    offset += 4;

    if (offset + bytecodeLength > data.length) {
        throw new Error(`Bytecode section truncated at offset ${offset}`);
    }

    // Bytecode
    const bytecode = Buffer.from(data.subarray(offset, offset + bytecodeLength));
    offset += bytecodeLength;

    // Proto length (uint32 LE)
    const protoLength = data.readUInt32LE(offset);
    offset += 4;

    if (offset + protoLength > data.length) {
        throw new Error(`Proto section truncated at offset ${offset}`);
    }

    // Proto
    const proto =
        protoLength > 0 ? Buffer.from(data.subarray(offset, offset + protoLength)) : undefined;
    offset += protoLength;

    // Checksum (32 bytes)
    if (offset + 32 > data.length) {
        throw new Error('Checksum truncated');
    }

    const checksum = Buffer.from(data.subarray(offset, offset + 32));

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
export function computeChecksum(metadata: Buffer, bytecode: Buffer, proto: Buffer): Buffer {
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
    const metadataBytes = Buffer.from(parsed.rawMetadata, 'utf-8');
    const computed = computeChecksum(
        metadataBytes,
        parsed.bytecode,
        parsed.proto ?? Buffer.alloc(0),
    );
    return computed.equals(parsed.checksum);
}

/**
 * Build a .opnet binary file
 *
 * @param options - Build options
 * @returns The assembled binary
 */
export function buildOpnetBinary(options: {
    mldsaLevel: CLIMldsaLevel;
    publicKey: Buffer;
    signature: Buffer;
    metadata: IPluginMetadata;
    bytecode: Buffer;
    proto?: Buffer;
}): Buffer {
    const {
        mldsaLevel,
        publicKey,
        signature,
        metadata,
        bytecode,
        proto = Buffer.alloc(0),
    } = options;

    const sdkLevel = cliLevelToMLDSALevel(mldsaLevel);

    // Validate sizes
    const expectedPkSize = MLDSA_PUBLIC_KEY_SIZES[sdkLevel];
    const expectedSigSize = MLDSA_SIGNATURE_SIZES[sdkLevel];

    if (publicKey.length !== expectedPkSize) {
        throw new Error(
            `Public key size mismatch: expected ${expectedPkSize}, got ${publicKey.length}`,
        );
    }

    if (signature.length !== expectedSigSize) {
        throw new Error(
            `Signature size mismatch: expected ${expectedSigSize}, got ${signature.length}`,
        );
    }

    // Serialize metadata
    const metadataStr = JSON.stringify(metadata);
    const metadataBytes = Buffer.from(metadataStr, 'utf-8');

    // Compute checksum
    const checksum = computeChecksum(metadataBytes, bytecode, proto);

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
    const buffer = Buffer.alloc(totalSize);
    let offset = 0;

    // Magic bytes
    PLUGIN_MAGIC_BYTES.copy(buffer, offset);
    offset += 8;

    // Format version
    buffer.writeUInt32LE(PLUGIN_FORMAT_VERSION, offset);
    offset += 4;

    // MLDSA level (enum value 0, 1, or 2)
    buffer.writeUInt8(sdkLevel, offset);
    offset += 1;

    // Public key
    publicKey.copy(buffer, offset);
    offset += publicKey.length;

    // Signature
    signature.copy(buffer, offset);
    offset += signature.length;

    // Metadata length
    buffer.writeUInt32LE(metadataBytes.length, offset);
    offset += 4;

    // Metadata
    metadataBytes.copy(buffer, offset);
    offset += metadataBytes.length;

    // Bytecode length
    buffer.writeUInt32LE(bytecode.length, offset);
    offset += 4;

    // Bytecode
    bytecode.copy(buffer, offset);
    offset += bytecode.length;

    // Proto length
    buffer.writeUInt32LE(proto.length, offset);
    offset += 4;

    // Proto
    proto.copy(buffer, offset);
    offset += proto.length;

    // Checksum
    checksum.copy(buffer, offset);

    return buffer;
}

/**
 * Extract just the metadata from a .opnet file without full validation
 *
 * @param data - The binary file contents
 * @returns The parsed metadata or null if invalid
 */
export function extractMetadata(data: Buffer): IPluginMetadata | null {
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
