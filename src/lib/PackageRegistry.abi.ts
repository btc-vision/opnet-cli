/**
 * PackageRegistry Contract ABI
 *
 * Auto-generated from PackageRegistry.abi.json
 */

import { BitcoinAbiTypes, BitcoinInterfaceAbi } from 'opnet';
import { ABIDataTypes } from '@btc-vision/transaction';

export const PACKAGE_REGISTRY_ABI: BitcoinInterfaceAbi = [
    // Functions
    {
        name: 'setTreasuryAddress',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'treasuryAddress', type: ABIDataTypes.STRING }],
        outputs: [],
    },
    {
        name: 'setScopePrice',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'priceSats', type: ABIDataTypes.UINT64 }],
        outputs: [],
    },
    {
        name: 'setPackagePrice',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'priceSats', type: ABIDataTypes.UINT64 }],
        outputs: [],
    },
    {
        name: 'registerScope',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'scopeName', type: ABIDataTypes.STRING }],
        outputs: [],
    },
    {
        name: 'initiateScopeTransfer',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'scopeName', type: ABIDataTypes.STRING },
            { name: 'newOwner', type: ABIDataTypes.ADDRESS },
        ],
        outputs: [],
    },
    {
        name: 'acceptScopeTransfer',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'scopeName', type: ABIDataTypes.STRING }],
        outputs: [],
    },
    {
        name: 'cancelScopeTransfer',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'scopeName', type: ABIDataTypes.STRING }],
        outputs: [],
    },
    {
        name: 'registerPackage',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'packageName', type: ABIDataTypes.STRING }],
        outputs: [],
    },
    {
        name: 'publishVersion',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'packageName', type: ABIDataTypes.STRING },
            { name: 'version', type: ABIDataTypes.STRING },
            { name: 'ipfsCid', type: ABIDataTypes.STRING },
            { name: 'checksum', type: ABIDataTypes.BYTES32 },
            { name: 'signature', type: ABIDataTypes.BYTES },
            { name: 'mldsaLevel', type: ABIDataTypes.UINT8 },
            { name: 'opnetVersionRange', type: ABIDataTypes.STRING },
            { name: 'pluginType', type: ABIDataTypes.UINT8 },
            { name: 'permissionsHash', type: ABIDataTypes.BYTES32 },
            { name: 'dependencies', type: ABIDataTypes.BYTES },
        ],
        outputs: [],
    },
    {
        name: 'deprecateVersion',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'packageName', type: ABIDataTypes.STRING },
            { name: 'version', type: ABIDataTypes.STRING },
            { name: 'reason', type: ABIDataTypes.STRING },
        ],
        outputs: [],
    },
    {
        name: 'undeprecateVersion',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'packageName', type: ABIDataTypes.STRING },
            { name: 'version', type: ABIDataTypes.STRING },
        ],
        outputs: [],
    },
    {
        name: 'initiateTransfer',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'packageName', type: ABIDataTypes.STRING },
            { name: 'newOwner', type: ABIDataTypes.ADDRESS },
        ],
        outputs: [],
    },
    {
        name: 'acceptTransfer',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'packageName', type: ABIDataTypes.STRING }],
        outputs: [],
    },
    {
        name: 'cancelTransfer',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'packageName', type: ABIDataTypes.STRING }],
        outputs: [],
    },
    {
        name: 'getScope',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'scopeName', type: ABIDataTypes.STRING }],
        outputs: [
            { name: 'exists', type: ABIDataTypes.BOOL },
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'createdAt', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'getScopeOwner',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'scopeName', type: ABIDataTypes.STRING }],
        outputs: [{ name: 'owner', type: ABIDataTypes.ADDRESS }],
    },
    {
        name: 'getPackage',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'packageName', type: ABIDataTypes.STRING }],
        outputs: [
            { name: 'exists', type: ABIDataTypes.BOOL },
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'createdAt', type: ABIDataTypes.UINT64 },
            { name: 'versionCount', type: ABIDataTypes.UINT256 },
            { name: 'latestVersion', type: ABIDataTypes.STRING },
        ],
    },
    {
        name: 'getOwner',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'packageName', type: ABIDataTypes.STRING }],
        outputs: [{ name: 'owner', type: ABIDataTypes.ADDRESS }],
    },
    {
        name: 'getVersion',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'packageName', type: ABIDataTypes.STRING },
            { name: 'version', type: ABIDataTypes.STRING },
        ],
        outputs: [
            { name: 'exists', type: ABIDataTypes.BOOL },
            { name: 'ipfsCid', type: ABIDataTypes.STRING },
            { name: 'checksum', type: ABIDataTypes.BYTES32 },
            { name: 'sigHash', type: ABIDataTypes.BYTES32 },
            { name: 'mldsaLevel', type: ABIDataTypes.UINT8 },
            { name: 'opnetVersionRange', type: ABIDataTypes.STRING },
            { name: 'pluginType', type: ABIDataTypes.UINT8 },
            { name: 'permissionsHash', type: ABIDataTypes.BYTES32 },
            { name: 'depsHash', type: ABIDataTypes.BYTES32 },
            { name: 'publisher', type: ABIDataTypes.ADDRESS },
            { name: 'publishedAt', type: ABIDataTypes.UINT64 },
            { name: 'deprecated', type: ABIDataTypes.BOOL },
        ],
    },
    {
        name: 'isDeprecated',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'packageName', type: ABIDataTypes.STRING },
            { name: 'version', type: ABIDataTypes.STRING },
        ],
        outputs: [{ name: 'deprecated', type: ABIDataTypes.BOOL }],
    },
    {
        name: 'isImmutable',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'packageName', type: ABIDataTypes.STRING },
            { name: 'version', type: ABIDataTypes.STRING },
        ],
        outputs: [{ name: 'immutable', type: ABIDataTypes.BOOL }],
    },
    {
        name: 'getPendingTransfer',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'packageName', type: ABIDataTypes.STRING }],
        outputs: [
            { name: 'pendingOwner', type: ABIDataTypes.ADDRESS },
            { name: 'initiatedAt', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'getPendingScopeTransfer',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'scopeName', type: ABIDataTypes.STRING }],
        outputs: [
            { name: 'pendingOwner', type: ABIDataTypes.ADDRESS },
            { name: 'initiatedAt', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'getTreasuryAddress',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [{ name: 'treasuryAddress', type: ABIDataTypes.STRING }],
    },
    {
        name: 'getScopePrice',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [{ name: 'priceSats', type: ABIDataTypes.UINT64 }],
    },
    {
        name: 'getPackagePrice',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [{ name: 'priceSats', type: ABIDataTypes.UINT64 }],
    },
    // Events
    {
        name: 'TreasuryAddressChanged',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'previousAddressHash', type: ABIDataTypes.UINT256 },
            { name: 'newAddressHash', type: ABIDataTypes.UINT256 },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'ScopePriceChanged',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'oldPrice', type: ABIDataTypes.UINT64 },
            { name: 'newPrice', type: ABIDataTypes.UINT64 },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'PackagePriceChanged',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'oldPrice', type: ABIDataTypes.UINT64 },
            { name: 'newPrice', type: ABIDataTypes.UINT64 },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'ScopeRegistered',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'scopeHash', type: ABIDataTypes.UINT256 },
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'ScopeTransferInitiated',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'scopeHash', type: ABIDataTypes.UINT256 },
            { name: 'currentOwner', type: ABIDataTypes.ADDRESS },
            { name: 'newOwner', type: ABIDataTypes.ADDRESS },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'ScopeTransferCompleted',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'scopeHash', type: ABIDataTypes.UINT256 },
            { name: 'previousOwner', type: ABIDataTypes.ADDRESS },
            { name: 'newOwner', type: ABIDataTypes.ADDRESS },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'ScopeTransferCancelled',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'scopeHash', type: ABIDataTypes.UINT256 },
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'PackageRegistered',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'packageHash', type: ABIDataTypes.UINT256 },
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'VersionPublished',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'packageHash', type: ABIDataTypes.UINT256 },
            { name: 'versionHash', type: ABIDataTypes.UINT256 },
            { name: 'publisher', type: ABIDataTypes.ADDRESS },
            { name: 'checksum', type: ABIDataTypes.UINT256 },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
            { name: 'mldsaLevel', type: ABIDataTypes.UINT8 },
            { name: 'pluginType', type: ABIDataTypes.UINT8 },
        ],
    },
    {
        name: 'VersionDeprecated',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'packageHash', type: ABIDataTypes.UINT256 },
            { name: 'versionHash', type: ABIDataTypes.UINT256 },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'VersionUndeprecated',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'packageHash', type: ABIDataTypes.UINT256 },
            { name: 'versionHash', type: ABIDataTypes.UINT256 },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'PackageTransferInitiated',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'packageHash', type: ABIDataTypes.UINT256 },
            { name: 'currentOwner', type: ABIDataTypes.ADDRESS },
            { name: 'newOwner', type: ABIDataTypes.ADDRESS },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'PackageTransferCompleted',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'packageHash', type: ABIDataTypes.UINT256 },
            { name: 'previousOwner', type: ABIDataTypes.ADDRESS },
            { name: 'newOwner', type: ABIDataTypes.ADDRESS },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'PackageTransferCancelled',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'packageHash', type: ABIDataTypes.UINT256 },
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
];
