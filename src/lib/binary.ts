/**
 * .opnet Binary Format Parser/Writer
 *
 * Implements the OIP-0003 binary format for compiled plugins.
 *
 * Format (all multi-byte integers are little-endian):
 * - Magic bytes: 8 bytes "OPNETPLG" (0x4F504E4554504C47)
 * - Format version: uint32 (4 bytes)
 * - MLDSA level: uint8 (1 byte) - 0=MLDSA44, 1=MLDSA65, 2=MLDSA87
 * - Public key: variable (1312, 1952, or 2592 bytes based on level)
 * - Signature: variable (2420, 3309, or 4627 bytes based on level)
 * - Metadata length: uint32 (4 bytes)
 * - Metadata: JSON bytes
 * - Bytecode length: uint32 (4 bytes)
 * - Bytecode: V8 bytecode bytes
 * - Proto length: uint32 (4 bytes)
 * - Proto: protobuf bytes (can be empty)
 * - Checksum: 32 bytes SHA-256
 *
 * @module lib/binary
 */

import * as crypto from 'crypto';
import {
    OPNET_BINARY,
    ParsedOpnetBinary,
    PluginManifest,
    MLDSALevel,
    getPublicKeySize,
    getSignatureSize,
} from '../types/index.js';

/**
 * Convert MLDSA CLI level (44, 65, 87) to binary format level (0, 1, 2)
 */
function mldsaLevelToBinary(level: MLDSALevel): number {
    switch (level) {
        case 44:
            return 0;
        case 65:
            return 1;
        case 87:
            return 2;
    }
}

/**
 * Convert binary format level (0, 1, 2) to MLDSA CLI level (44, 65, 87)
 */
function binaryToMldsaLevel(level: number): MLDSALevel {
    switch (level) {
        case 0:
            return 44;
        case 1:
            return 65;
        case 2:
            return 87;
        default:
            throw new Error(`Invalid binary MLDSA level: ${level}`);
    }
}

/**
 * Parse a .opnet binary file
 *
 * @param data - The binary file contents
 * @returns Parsed binary structure
 * @throws Error if the binary is malformed
 */
export function parseOpnetBinary(data: Buffer): ParsedOpnetBinary {
    let offset = 0;

    // Check minimum size
    if (data.length < 8 + 4 + 1) {
        throw new Error('Binary too small: missing header');
    }

    // Magic bytes (8 bytes)
    const magic = data.subarray(offset, offset + 8);
    offset += 8;

    if (!magic.equals(OPNET_BINARY.MAGIC)) {
        throw new Error(
            `Invalid magic bytes: expected ${OPNET_BINARY.MAGIC.toString('hex')}, got ${magic.toString('hex')}`,
        );
    }

    // Format version (uint32 LE)
    const formatVersion = data.readUInt32LE(offset);
    offset += 4;

    if (formatVersion !== OPNET_BINARY.FORMAT_VERSION) {
        throw new Error(
            `Unsupported format version: ${formatVersion} (expected ${OPNET_BINARY.FORMAT_VERSION})`,
        );
    }

    // MLDSA level (uint8)
    const mldsaLevelBinary = data.readUInt8(offset);
    offset += 1;

    if (mldsaLevelBinary > 2) {
        throw new Error(`Invalid MLDSA level: ${mldsaLevelBinary} (must be 0, 1, or 2)`);
    }

    const mldsaLevel = binaryToMldsaLevel(mldsaLevelBinary);

    // Get sizes based on level
    const publicKeySize = getPublicKeySize(mldsaLevel);
    const signatureSize = getSignatureSize(mldsaLevel);

    // Check we have enough data
    const minSize = offset + publicKeySize + signatureSize + 4 + 4 + 4 + 32;
    if (data.length < minSize) {
        throw new Error(`Binary truncated: expected at least ${minSize} bytes, got ${data.length}`);
    }

    // Public key
    const publicKey = data.subarray(offset, offset + publicKeySize);
    offset += publicKeySize;

    // Signature
    const signature = data.subarray(offset, offset + signatureSize);
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

    let metadata: string;
    let metadataObj: PluginManifest;
    try {
        metadata = metadataBytes.toString('utf-8');
        metadataObj = JSON.parse(metadata) as PluginManifest;
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
    const bytecode = data.subarray(offset, offset + bytecodeLength);
    offset += bytecodeLength;

    // Proto length (uint32 LE)
    const protoLength = data.readUInt32LE(offset);
    offset += 4;

    if (offset + protoLength > data.length) {
        throw new Error(`Proto section truncated at offset ${offset}`);
    }

    // Proto
    const proto = data.subarray(offset, offset + protoLength);
    offset += protoLength;

    // Checksum (32 bytes)
    if (offset + 32 > data.length) {
        throw new Error('Checksum truncated');
    }

    const checksum = data.subarray(offset, offset + 32);

    return {
        formatVersion,
        mldsaLevel: mldsaLevelBinary,
        publicKey: Buffer.from(publicKey),
        signature: Buffer.from(signature),
        metadata,
        metadataObj,
        bytecode: Buffer.from(bytecode),
        proto: Buffer.from(proto),
        checksum: Buffer.from(checksum),
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
export function verifyChecksum(parsed: ParsedOpnetBinary): boolean {
    const metadataBytes = Buffer.from(parsed.metadata, 'utf-8');
    const computed = computeChecksum(metadataBytes, parsed.bytecode, parsed.proto);
    return computed.equals(parsed.checksum);
}

/**
 * Build a .opnet binary file
 *
 * @param options - Build options
 * @returns The assembled binary
 */
export function buildOpnetBinary(options: {
    mldsaLevel: MLDSALevel;
    publicKey: Buffer;
    signature: Buffer;
    metadata: PluginManifest;
    bytecode: Buffer;
    proto?: Buffer;
}): Buffer {
    const { mldsaLevel, publicKey, signature, metadata, bytecode, proto = Buffer.alloc(0) } = options;

    // Validate sizes
    const expectedPkSize = getPublicKeySize(mldsaLevel);
    const expectedSigSize = getSignatureSize(mldsaLevel);

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
        4 + metadataBytes.length + // metadata
        4 + bytecode.length + // bytecode
        4 + proto.length + // proto
        32; // checksum

    // Build buffer
    const buffer = Buffer.alloc(totalSize);
    let offset = 0;

    // Magic bytes
    OPNET_BINARY.MAGIC.copy(buffer, offset);
    offset += 8;

    // Format version
    buffer.writeUInt32LE(OPNET_BINARY.FORMAT_VERSION, offset);
    offset += 4;

    // MLDSA level
    buffer.writeUInt8(mldsaLevelToBinary(mldsaLevel), offset);
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
export function extractMetadata(data: Buffer): PluginManifest | null {
    try {
        const parsed = parseOpnetBinary(data);
        return parsed.metadataObj;
    } catch {
        return null;
    }
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
