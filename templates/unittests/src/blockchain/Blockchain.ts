﻿import { Address } from '@btc-vision/bsi-binary';
import { Logger } from '@btc-vision/logger';
import { ContractManager, ThreadSafeJsImportResponse } from '@btc-vision/op-vm';
import { AddressGenerator, EcKeyPair, TapscriptVerificator } from '@btc-vision/transaction';
import bitcoin, { Network } from 'bitcoinjs-lib';
import {
    NETWORK,
    TRACE_CALLS,
    TRACE_DEPLOYMENTS,
    TRACE_GAS,
    TRACE_POINTERS,
} from '../contracts/configs.js';
import { ContractRuntime } from '../opnet/modules/ContractRuntime.js';
import { BytecodeManager } from '../opnet/modules/GetBytecode.js';
import { RustContractBinding } from '../opnet/vm/RustContractBinding.js';

class BlockchainBase extends Logger {
    public readonly logColor: string = '#8332ff';
    public readonly DEAD_ADDRESS: Address = 'bc1dead';

    public traceGas: boolean = TRACE_GAS;
    public tracePointers: boolean = TRACE_POINTERS;
    public traceCalls: boolean = TRACE_CALLS;
    public traceDeployments: boolean = TRACE_DEPLOYMENTS;

    private readonly enableDebug: boolean = false;
    private readonly contracts: Map<string, ContractRuntime> = new Map<string, ContractRuntime>();

    private readonly bindings: Map<bigint, RustContractBinding> = new Map<
        bigint,
        RustContractBinding
    >();

    constructor(public readonly network: Network) {
        super();
    }

    public createManager(): void {
        this._contractManager = new ContractManager(
            16, // max idling runtime
            this.loadJsFunction,
            this.storeJSFunction,
            this.callJSFunction,
            this.deployContractAtAddressJSFunction,
            this.logJSFunction,
        );
    }

    public removeBinding(id: bigint): void {
        this.bindings.delete(id);
    }

    public registerBinding(binding: RustContractBinding): void {
        this.bindings.set(binding.id, binding);
    }

    private loadJsFunction: (
        _: never,
        result: ThreadSafeJsImportResponse,
    ) => Promise<Buffer | Uint8Array> = (
        _: never,
        value: ThreadSafeJsImportResponse,
    ): Promise<Buffer | Uint8Array> => {
            if (this.enableDebug) console.log('LOAD', value.buffer);

            const u = new Uint8Array(value.buffer);
            const buf = Buffer.from(u.buffer, u.byteOffset, u.byteLength);
            const c = this.bindings.get(BigInt(`${value.contractId}`)); // otherwise unsafe.

            if (!c) {
                throw new Error('Binding not found');
            }

            return c.load(buf);
        };

    private storeJSFunction: (
        _: never,
        result: ThreadSafeJsImportResponse,
    ) => Promise<Buffer | Uint8Array> = (
        _: never,
        value: ThreadSafeJsImportResponse,
    ): Promise<Buffer | Uint8Array> => {
            if (this.enableDebug) console.log('STORE', value.buffer);

            const u = new Uint8Array(value.buffer);
            const buf = Buffer.from(u.buffer, u.byteOffset, u.byteLength);

            const c = this.bindings.get(BigInt(`${value.contractId}`)); // otherwise unsafe.

            if (!c) {
                throw new Error('Binding not found');
            }

            return c.store(buf);
        };

    private callJSFunction: (
        _: never,
        result: ThreadSafeJsImportResponse,
    ) => Promise<Buffer | Uint8Array> = (
        _: never,
        value: ThreadSafeJsImportResponse,
    ): Promise<Buffer | Uint8Array> => {
            if (this.enableDebug) console.log('CALL', value.buffer);

            const u = new Uint8Array(value.buffer);
            const buf = Buffer.from(u.buffer, u.byteOffset, u.byteLength);

            const c = this.bindings.get(BigInt(`${value.contractId}`)); // otherwise unsafe.

            if (!c) {
                throw new Error('Binding not found');
            }

            return c.call(buf);
        };

    private deployContractAtAddressJSFunction: (
        _: never,
        result: ThreadSafeJsImportResponse,
    ) => Promise<Buffer | Uint8Array> = (
        _: never,
        value: ThreadSafeJsImportResponse,
    ): Promise<Buffer | Uint8Array> => {
            if (this.enableDebug) console.log('DEPLOY', value.buffer);

            const u = new Uint8Array(value.buffer);
            const buf = Buffer.from(u.buffer, u.byteOffset, u.byteLength);

            const c = this.bindings.get(BigInt(`${value.contractId}`)); // otherwise unsafe.

            if (!c) {
                throw new Error('Binding not found');
            }

            return c.deployContractAtAddress(buf);
        };

    private logJSFunction: (_: never, result: ThreadSafeJsImportResponse) => Promise<void> = (
        _: never,
        value: ThreadSafeJsImportResponse,
    ): Promise<void> => {
        return new Promise<void>(() => {
            // temporary
            const u = new Uint8Array(value.buffer);
            const buf = Buffer.from(u.buffer, u.byteOffset, u.byteLength);

            const c = this.bindings.get(BigInt(`${value.contractId}`)); // otherwise unsafe.

            if (!c) {
                throw new Error('Binding not found');
            }

            return c.log(buf);
        });
    };

    private _contractManager?: ContractManager;

    public get contractManager(): ContractManager {
        if (!this._contractManager) {
            this.createManager();
        }

        if (!this._contractManager) {
            throw new Error('Contract manager not initialized');
        }

        return this._contractManager;
    }

    private _blockNumber: bigint = 1n;

    public get blockNumber(): bigint {
        return this._blockNumber;
    }

    public set blockNumber(blockNumber: bigint) {
        this._blockNumber = blockNumber;
    }

    private _msgSender: Address = '';

    public get msgSender(): Address {
        return this._msgSender;
    }

    public set msgSender(sender: Address) {
        this._msgSender = sender;
    }

    private _txOrigin: Address = '';

    public get txOrigin(): Address {
        return this._txOrigin;
    }

    public set txOrigin(from: Address) {
        this._txOrigin = from;
    }

    public generateRandomSegwitAddress(): Address {
        return AddressGenerator.generatePKSH(this.getRandomBytes(32), this.network);
    }

    public generateRandomTaprootAddress(): Address {
        const keypair = EcKeyPair.generateRandomKeyPair(this.network);
        return EcKeyPair.getTaprootAddress(keypair, this.network);
    }

    public register(contract: ContractRuntime): void {
        if (this.contracts.has(contract.address)) {
            throw new Error(`Contract already registered at address ${contract.address}`);
        }

        this.contracts.set(contract.address, contract);
    }

    public clearContracts(): void {
        this.contracts.clear();
    }

    public generateAddress(
        deployer: Address,
        salt: Buffer,
        from: Address,
    ): { contractAddress: Address; virtualAddress: Buffer } {
        const bytecode = BytecodeManager.getBytecode(from);
        const contractVirtualAddress = TapscriptVerificator.getContractSeed(
            bitcoin.crypto.hash256(Buffer.from(deployer, 'utf-8')),
            Buffer.from(bytecode),
            salt,
        );

        /** Generate contract segwit address */
        const contractSegwitAddress = AddressGenerator.generatePKSH(
            contractVirtualAddress,
            this.network,
        );

        return { contractAddress: contractSegwitAddress, virtualAddress: contractVirtualAddress };
    }

    public convertToBech32(contractVirtualAddress: Address): Address {
        return AddressGenerator.generatePKSH(
            Buffer.from(contractVirtualAddress.slice(2), 'hex'),
            this.network,
        );
    }

    public getContract(address: Address): ContractRuntime {
        if (address.startsWith('0x')) {
            address = this.convertToBech32(address);
        }

        const contract = this.contracts.get(address);
        if (!contract) {
            throw new Error(`Contract not found at address ${address}`);
        }

        return contract;
    }

    public backup(): void {
        for (const contract of this.contracts.values()) {
            contract.backupStates();
        }
    }

    public restore(): void {
        for (const contract of this.contracts.values()) {
            contract.restoreStates();
        }
    }

    public dispose(): void {
        for (const contract of this.contracts.values()) {
            contract.dispose.bind(contract)();
        }
    }

    public cleanup(): void {
        this.contractManager.destroyAll();
        this.contractManager.destroy();

        delete this._contractManager;
    }

    public async init(): Promise<void> {
        this.dispose();

        for (const contract of this.contracts.values()) {
            await contract.init();
        }
    }

    public expandTo18Decimals(n: number): bigint {
        return BigInt(n) * 10n ** 18n;
    }

    public expandToDecimal(n: number, decimals: number): bigint {
        return BigInt(n) * 10n ** BigInt(decimals);
    }

    public decodeFrom18Decimals(n: bigint): number {
        return Number(n / 10n ** 18n);
    }

    public decodeFromDecimal(n: bigint, decimals: number): number {
        return Number(n / 10n ** BigInt(decimals));
    }

    public mineBlock(): void {
        this._blockNumber += 1n;
    }

    public enableGasTracking(): void {
        this.traceGas = true;
    }

    public disableGasTracking(): void {
        this.traceGas = false;
    }

    public enablePointerTracking(): void {
        this.tracePointers = true;
    }

    public disablePointerTracking(): void {
        this.tracePointers = false;
    }

    public enableCallTracking(): void {
        this.traceCalls = true;
    }

    public disableCallTracking(): void {
        this.traceCalls = false;
    }

    public encodePrice(reserve0: bigint, reserve1: bigint): [bigint, bigint] {
        const shift = 2n ** 112n;
        const price0 = (reserve1 * shift) / reserve0;
        const price1 = (reserve0 * shift) / reserve1;
        return [price0, price1];
    }

    private getRandomBytes(length: number): Buffer {
        return Buffer.from(crypto.getRandomValues(new Uint8Array(length)));
    }
}

export const Blockchain = new BlockchainBase(NETWORK);