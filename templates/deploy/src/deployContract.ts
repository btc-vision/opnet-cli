import * as fs from 'fs';
import {
    BroadcastResponse,
    FetchUTXOParamsMultiAddress,
    IDeploymentParameters,
    UTXO,
    Wallet
} from '@btc-vision/transaction';
import { networks } from 'bitcoinjs-lib';
import { Configs } from './config.js';

const wallet = Configs.WALLET;
const utxoManager = Configs.LIMITED_PROVIDER;
const factory = Configs.FACTORY;
const network = Configs.NETWORK;

const requestedAmount: bigint = 20000000n;

const utxoSetting: FetchUTXOParamsMultiAddress = {
    addresses: [wallet.p2wpkh, wallet.p2tr],
    minAmount: 10000n,
    requestedAmount: requestedAmount,
};

const utxos: UTXO[] = await utxoManager.fetchUTXOMultiAddr(utxoSetting);
if (!utxos) {
    throw new Error('No UTXOs found');
}

export async function deployContract(contracts: string[]): Promise<{ contract: string; file: string }[]> {
    let deployed: { contract: string; file: string }[] = [];

    for (let contract of contracts) {
        const bytecode = fs.readFileSync(contract);

        for (let utxo of utxos) {
            const deploymentParameters: IDeploymentParameters = {
                from: wallet.p2wpkh,
                utxos: [utxo],
                signer: wallet.keypair,
                network: network,
                feeRate: 50,
                priorityFee: 50000n,
                bytecode: bytecode,
            };

            try {
                const finalTx = await factory.signDeployment(deploymentParameters);
                console.log(`Final transaction:`, finalTx);

                let txid: BroadcastResponse | undefined;
                try {
                    txid = await utxoManager.broadcastTransaction(finalTx.transaction[0], false);
                    console.log(`Transaction ID:`, txid);
                } catch (e) {
                    continue;
                }

                if (!txid) {
                    continue;
                }

                try {
                    txid = await utxoManager.broadcastTransaction(finalTx.transaction[1], false);
                    console.log(`Transaction ID:`, txid);
                } catch (e) {
                    continue;
                }

                if (!txid) {
                    continue;
                }

                utxos.push(...finalTx.utxos);

                deployed.push({ contract: finalTx.contractAddress, file: contract });

                console.log(`Contract deployed at ${finalTx.contractAddress}`);
            } catch (e) {
                continue;
            }

            break;
        }
    }

    return deployed;
}
