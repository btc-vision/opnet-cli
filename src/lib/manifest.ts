/**
 * Plugin manifest (plugin.json) validation
 *
 * Validates plugin manifests according to OIP-0003 specification.
 *
 * @module lib/manifest
 */

import * as fs from 'fs';
import * as path from 'path';
import { PluginManifest, PluginPermissions } from '../types/index.js';

/** Plugin name validation pattern */
const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Scoped package name pattern */
const SCOPED_NAME_PATTERN = /^@[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/;

/** Semver pattern (basic) */
const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;

/** OPNet version range pattern (basic) */
const OPNET_VERSION_PATTERN = /^[\d.x*^~<>=| -]+$/;

/**
 * Validation error with field path
 */
export interface ValidationError {
    field: string;
    message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

/**
 * Validate a plugin name (scoped or unscoped)
 *
 * @param name - The name to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validatePluginName(name: string): string[] {
    const errors: string[] = [];

    if (!name) {
        errors.push('Name is required');
        return errors;
    }

    // Check if scoped
    if (name.startsWith('@')) {
        if (!SCOPED_NAME_PATTERN.test(name)) {
            errors.push(
                'Scoped name must be @scope/name where scope and name are lowercase alphanumeric with hyphens, starting with a letter',
            );
        }
    } else {
        if (!NAME_PATTERN.test(name)) {
            errors.push(
                'Name must be lowercase alphanumeric with hyphens, starting with a letter',
            );
        }
    }

    // Check length
    if (name.length > 100) {
        errors.push('Name must be 100 characters or less');
    }

    return errors;
}

/**
 * Validate a semantic version string
 *
 * @param version - The version to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateVersion(version: string): string[] {
    const errors: string[] = [];

    if (!version) {
        errors.push('Version is required');
        return errors;
    }

    if (!VERSION_PATTERN.test(version)) {
        errors.push('Version must be valid semver (x.y.z or x.y.z-prerelease)');
    }

    return errors;
}

/**
 * Validate an OPNet version range
 *
 * @param range - The version range to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateOpnetVersion(range: string): string[] {
    const errors: string[] = [];

    if (!range) {
        errors.push('OPNet version range is required');
        return errors;
    }

    if (!OPNET_VERSION_PATTERN.test(range)) {
        errors.push('Invalid OPNet version range format');
    }

    return errors;
}

/**
 * Validate plugin permissions
 *
 * @param permissions - The permissions object
 * @returns Array of validation errors (empty if valid)
 */
export function validatePermissions(permissions: PluginPermissions): string[] {
    const errors: string[] = [];

    if (permissions.database?.enabled) {
        if (
            !permissions.database.collections ||
            !Array.isArray(permissions.database.collections)
        ) {
            errors.push('database.collections must be an array when database is enabled');
        }
    }

    return errors;
}

/**
 * Validate a complete plugin manifest
 *
 * @param manifest - The manifest to validate
 * @returns Validation result with field-specific errors
 */
export function validateManifest(manifest: Partial<PluginManifest>): ValidationResult {
    const errors: ValidationError[] = [];

    // Required fields
    if (!manifest.name) {
        errors.push({ field: 'name', message: 'Name is required' });
    } else {
        const nameErrors = validatePluginName(manifest.name);
        nameErrors.forEach((msg) => errors.push({ field: 'name', message: msg }));
    }

    if (!manifest.version) {
        errors.push({ field: 'version', message: 'Version is required' });
    } else {
        const versionErrors = validateVersion(manifest.version);
        versionErrors.forEach((msg) => errors.push({ field: 'version', message: msg }));
    }

    if (!manifest.opnetVersion) {
        errors.push({ field: 'opnetVersion', message: 'OPNet version range is required' });
    } else {
        const opnetErrors = validateOpnetVersion(manifest.opnetVersion);
        opnetErrors.forEach((msg) => errors.push({ field: 'opnetVersion', message: msg }));
    }

    if (!manifest.main) {
        errors.push({ field: 'main', message: 'Main entry point is required' });
    }

    if (manifest.target !== 'bytenode') {
        errors.push({ field: 'target', message: 'Target must be "bytenode"' });
    }

    if (manifest.type !== 'plugin') {
        errors.push({ field: 'type', message: 'Type must be "plugin"' });
    }

    // Author validation
    if (!manifest.author) {
        errors.push({ field: 'author', message: 'Author is required' });
    } else if (!manifest.author.name) {
        errors.push({ field: 'author.name', message: 'Author name is required' });
    }

    // Plugin type validation
    if (!manifest.pluginType) {
        errors.push({ field: 'pluginType', message: 'Plugin type is required' });
    } else if (!['standalone', 'library'].includes(manifest.pluginType)) {
        errors.push({
            field: 'pluginType',
            message: 'Plugin type must be "standalone" or "library"',
        });
    }

    // Permissions validation
    if (!manifest.permissions) {
        errors.push({ field: 'permissions', message: 'Permissions object is required' });
    } else {
        const permErrors = validatePermissions(manifest.permissions);
        permErrors.forEach((msg) => errors.push({ field: 'permissions', message: msg }));
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Load and validate a plugin manifest from file
 *
 * @param manifestPath - Path to plugin.json
 * @returns The loaded manifest or throws with validation errors
 */
export function loadManifest(manifestPath: string): PluginManifest {
    const resolvedPath = path.resolve(manifestPath);

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Manifest not found: ${resolvedPath}`);
    }

    let manifest: Partial<PluginManifest>;
    try {
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        manifest = JSON.parse(content) as Partial<PluginManifest>;
    } catch (e) {
        throw new Error(`Failed to parse manifest: ${e instanceof Error ? e.message : String(e)}`);
    }

    const result = validateManifest(manifest);
    if (!result.valid) {
        const errorList = result.errors
            .map((e) => `  - ${e.field}: ${e.message}`)
            .join('\n');
        throw new Error(`Invalid manifest:\n${errorList}`);
    }

    return manifest as PluginManifest;
}

/**
 * Save a plugin manifest to file
 *
 * @param manifestPath - Path to save to
 * @param manifest - The manifest to save
 */
export function saveManifest(manifestPath: string, manifest: PluginManifest): void {
    const content = JSON.stringify(manifest, null, 4);
    fs.writeFileSync(manifestPath, content, 'utf-8');
}

/**
 * Create a default plugin manifest
 *
 * @param options - Manifest options
 * @returns A complete manifest with defaults
 */
export function createManifest(options: {
    name: string;
    author: string;
    email?: string;
    description?: string;
    pluginType: 'standalone' | 'library';
}): PluginManifest {
    return {
        name: options.name,
        version: '1.0.0',
        opnetVersion: '^1.0.0',
        main: 'dist/index.jsc',
        target: 'bytenode',
        type: 'plugin',
        author: {
            name: options.author,
            email: options.email,
        },
        description: options.description,
        pluginType: options.pluginType,
        permissions: {
            database: {
                enabled: false,
                collections: [],
            },
            blocks: {
                preProcess: false,
                postProcess: false,
                onChange: false,
            },
            epochs: {
                onChange: false,
                onFinalized: false,
            },
            mempool: {
                txFeed: false,
            },
            api: {
                addEndpoints: false,
                addWebsocket: false,
            },
            filesystem: {
                configDir: false,
                tempDir: false,
            },
        },
        resources: {
            maxMemoryMB: 256,
            maxCpuPercent: 25,
            maxStorageMB: 100,
        },
        dependencies: {},
        lifecycle: {
            autoStart: true,
            restartOnCrash: true,
            maxRestarts: 3,
        },
    };
}

/**
 * Get the manifest path for a directory
 *
 * @param dir - Directory to search
 * @returns Path to plugin.json
 */
export function getManifestPath(dir: string = process.cwd()): string {
    return path.join(dir, 'plugin.json');
}
