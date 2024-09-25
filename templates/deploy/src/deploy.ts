import { deployContract } from './deployContract.js';

console.log(`Deploying contract: <%CONTRACT_NAME%>`);

const contractsToDeploy = ['../../build/<%CONTRACT_NAME%>.wasm'];
const contracts = await deployContract(contractsToDeploy);

console.log(`Contracts deployed:`, contracts);