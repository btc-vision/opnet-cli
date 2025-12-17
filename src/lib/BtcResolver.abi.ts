/**
 * BtcResolver Contract ABI
 *
 * ABI for the BTC Name Resolver contract that manages .btc domains
 * and contenthash storage for decentralized websites.
 */

import { BitcoinAbiTypes, BitcoinInterfaceAbi } from 'opnet';
import { ABIDataTypes } from '@btc-vision/transaction';

export const BTC_RESOLVER_ABI: BitcoinInterfaceAbi = [
    // =========================================================================
    // ADMIN METHODS
    // =========================================================================
    {
        name: 'setTreasuryAddress',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'treasuryAddress', type: ABIDataTypes.STRING }],
        outputs: [],
    },
    {
        name: 'setDomainPrice',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'priceSats', type: ABIDataTypes.UINT64 }],
        outputs: [],
    },

    // =========================================================================
    // DOMAIN REGISTRATION METHODS
    // =========================================================================
    {
        name: 'registerDomain',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'domainName', type: ABIDataTypes.STRING }],
        outputs: [],
    },

    // =========================================================================
    // DOMAIN TRANSFER METHODS
    // =========================================================================
    {
        name: 'initiateTransfer',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'domainName', type: ABIDataTypes.STRING },
            { name: 'newOwner', type: ABIDataTypes.ADDRESS },
        ],
        outputs: [],
    },
    {
        name: 'acceptTransfer',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'domainName', type: ABIDataTypes.STRING }],
        outputs: [],
    },
    {
        name: 'cancelTransfer',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'domainName', type: ABIDataTypes.STRING }],
        outputs: [],
    },

    // =========================================================================
    // SUBDOMAIN METHODS
    // =========================================================================
    {
        name: 'createSubdomain',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'parentDomain', type: ABIDataTypes.STRING },
            { name: 'subdomainLabel', type: ABIDataTypes.STRING },
            { name: 'subdomainOwner', type: ABIDataTypes.ADDRESS },
        ],
        outputs: [],
    },
    {
        name: 'deleteSubdomain',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'parentDomain', type: ABIDataTypes.STRING },
            { name: 'subdomainLabel', type: ABIDataTypes.STRING },
        ],
        outputs: [],
    },

    // =========================================================================
    // CONTENTHASH METHODS
    // =========================================================================
    {
        name: 'setContenthashCIDv0',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'name', type: ABIDataTypes.STRING },
            { name: 'cid', type: ABIDataTypes.STRING },
        ],
        outputs: [],
    },
    {
        name: 'setContenthashCIDv1',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'name', type: ABIDataTypes.STRING },
            { name: 'cid', type: ABIDataTypes.STRING },
        ],
        outputs: [],
    },
    {
        name: 'setContenthashIPNS',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'name', type: ABIDataTypes.STRING },
            { name: 'ipnsId', type: ABIDataTypes.STRING },
        ],
        outputs: [],
    },
    {
        name: 'setContenthashSHA256',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'name', type: ABIDataTypes.STRING },
            { name: 'hash', type: ABIDataTypes.BYTES32 },
        ],
        outputs: [],
    },
    {
        name: 'clearContenthash',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'name', type: ABIDataTypes.STRING }],
        outputs: [],
    },

    // =========================================================================
    // TTL METHODS
    // =========================================================================
    {
        name: 'setTTL',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'name', type: ABIDataTypes.STRING },
            { name: 'ttl', type: ABIDataTypes.UINT64 },
        ],
        outputs: [],
    },

    // =========================================================================
    // VIEW METHODS
    // =========================================================================
    {
        name: 'getDomain',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'domainName', type: ABIDataTypes.STRING }],
        outputs: [
            { name: 'exists', type: ABIDataTypes.BOOL },
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'createdAt', type: ABIDataTypes.UINT64 },
            { name: 'ttl', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'getSubdomain',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'fullName', type: ABIDataTypes.STRING }],
        outputs: [
            { name: 'exists', type: ABIDataTypes.BOOL },
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'parentHash', type: ABIDataTypes.BYTES32 },
            { name: 'ttl', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'getContenthash',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'name', type: ABIDataTypes.STRING }],
        outputs: [
            { name: 'hashType', type: ABIDataTypes.UINT8 },
            { name: 'hashData', type: ABIDataTypes.BYTES32 },
            { name: 'hashString', type: ABIDataTypes.STRING },
        ],
    },
    {
        name: 'resolve',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'name', type: ABIDataTypes.STRING }],
        outputs: [{ name: 'owner', type: ABIDataTypes.ADDRESS }],
    },
    {
        name: 'getPendingTransfer',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'domainName', type: ABIDataTypes.STRING }],
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
        name: 'getDomainPrice',
        type: BitcoinAbiTypes.Function,
        inputs: [{ name: 'domainName', type: ABIDataTypes.STRING }],
        outputs: [{ name: 'priceSats', type: ABIDataTypes.UINT64 }],
    },
    {
        name: 'getBaseDomainPrice',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [{ name: 'priceSats', type: ABIDataTypes.UINT64 }],
    },

    // =========================================================================
    // EVENTS
    // =========================================================================
    {
        name: 'DomainRegistered',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'domainHash', type: ABIDataTypes.UINT256 },
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'DomainTransferInitiated',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'domainHash', type: ABIDataTypes.UINT256 },
            { name: 'currentOwner', type: ABIDataTypes.ADDRESS },
            { name: 'newOwner', type: ABIDataTypes.ADDRESS },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'DomainTransferCompleted',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'domainHash', type: ABIDataTypes.UINT256 },
            { name: 'previousOwner', type: ABIDataTypes.ADDRESS },
            { name: 'newOwner', type: ABIDataTypes.ADDRESS },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'DomainTransferCancelled',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'domainHash', type: ABIDataTypes.UINT256 },
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'SubdomainCreated',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'parentDomainHash', type: ABIDataTypes.UINT256 },
            { name: 'subdomainHash', type: ABIDataTypes.UINT256 },
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'SubdomainDeleted',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'parentDomainHash', type: ABIDataTypes.UINT256 },
            { name: 'subdomainHash', type: ABIDataTypes.UINT256 },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'ContenthashChanged',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'nameHash', type: ABIDataTypes.UINT256 },
            { name: 'contenthashType', type: ABIDataTypes.UINT8 },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'ContenthashCleared',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'nameHash', type: ABIDataTypes.UINT256 },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'TTLChanged',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'nameHash', type: ABIDataTypes.UINT256 },
            { name: 'oldTTL', type: ABIDataTypes.UINT64 },
            { name: 'newTTL', type: ABIDataTypes.UINT64 },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'DomainPriceChanged',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'oldPrice', type: ABIDataTypes.UINT64 },
            { name: 'newPrice', type: ABIDataTypes.UINT64 },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
    {
        name: 'TreasuryChanged',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'previousAddressHash', type: ABIDataTypes.UINT256 },
            { name: 'newAddressHash', type: ABIDataTypes.UINT256 },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
        ],
    },
];
