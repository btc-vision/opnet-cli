import { CallResponse, ContractRuntime } from '../opnet/modules/ContractRuntime.js';
import { Address, BinaryReader, BinaryWriter, u8 } from '@btc-vision/bsi-binary';
import { BytecodeManager } from '../opnet/modules/GetBytecode.js';

/*
Create an interface for all event classes declared in your smart contract using the following template:

-> Replace [EventClassName] with the name of the event class.
*/

/*
export interface [EventClassName] {
    readonly field1: bigint;
    readonly field2: Address;
    readonly field3: bigint;
    ...
}
*/


/*
Create an interface for all data classes declared in your smart contract using the following template:

-> Replace [DataClassName] with the name of the data class.
*/

/*
export interface [DataClassName] {
    readonly field1: bigint;
    readonly field2: Address;
    readonly field3: string;
    ...
}
*/

export class <%CONTRACT_NAME%> extends ContractRuntime {
    /*
    Create a selector method for all exposed methods of your contract using the following template:

    -> Replace [methodName] with the name of the method.
    */

    /*
    private readonly [methodName]Selector: number = Number(
        `0x${this.abiCoder.encodeSelector('methodName')}`,
    );
    */

    /*
    Create a decoder for all event classes declared in your smart contract using the following template:

    -> Replace [EventClassName] with the interface previously defined in this file.
    */
    /*
    public static decode[EventClassName](data: Uint8Array): [EventClassName] {
        const reader: BinaryReader = new BinaryReader(data);

        // Read all the field in the correct order here:

        return {
            field1: reader.readU256(),
            field2: reader.readAddress(),
            field3: reader.readU256(),
        };
    }
    */

    /*
     Create a decoder for all data classes declared in your smart contract using the following template:

     -> Replace [ClassName] with the interface previously defined in this file.
     */
     /*
     public static decode[ClassName](data: Uint8Array): [ClassName] {
         const reader: BinaryReader = new BinaryReader(data);

         // Read all the field in the correct order here:

         return {
             field1: reader.readU256(),
             field2: reader.readAddress(),
             field3: reader.readStringWithLength(),
         };
     }
     */

     /*
     Create a method for all exposed methods of your contract using the following template:

     -> Replace [MethodName] with the name of your contract method.
     -> Replace [MethodParameters] with the method parameters.
     */
     /*
     public async [MethodName]([MethodParameters]): Promise<CallResponse> {
        // Prepare the calldata for the contract.
        // Parameters must be added in the contract method expected order.
        // use the calldata.writeXXX method to add each parameter.
        const calldata = new BinaryWriter();
        
        calldata.writeXXX([paramXXX]);
        calldata.writeXXX([paramXXX]);
        calldata.writeXXX([paramXXX]);

        const buf = calldata.getBuffer();
        const result = await this.readMethod(this.[MethodName]Selector, Buffer.from(buf));

        let response = result.response;
        if (!response) {
            this.dispose();
            throw result.error;
        }

        const reader = new BinaryReader(response);
        if (!reader.readBoolean()) {
            // You can customize your error message here.
            throw new Error('[MethodName] failed.');
        }

        return result;
    }
     */
    /*
    -> Replace '[ContractOwnerAddress]' with the contract owner address.
    */

    constructor(address: Address, gasLimit: bigint = 300_000_000_000n) {
        super(
            address,
            '[ContractOwnerAddress]',
            gasLimit,
        );

        this.preserveState();
    }

    protected defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode('./bytecode/<%CONTRACT_NAME%>.wasm', this.address);
    }

    protected handleError(error: Error): Error {
        return new Error(`(in : ${this.address}) OPNET: ${error.stack}`);
    }
}