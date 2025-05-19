/** @noSelfInFile **/
/** @noResolution **/
declare module "ecnet2" {
    type Doc = {};
    interface IProtocol {
        name: string;
        
        serialize(message: Object): string;
        deserialize(message: string): Object;
    }
    interface Connection {
        id:string;
        send(message: any): void;
        /**
         * Yields until a message is received or times out.
         * @param timeout Optional timeout in seconds.
         * @returns A tuple of [sender, message], or undefined if it times out.
         */
        receive(timeout?: number): [sender: string, message: any] | undefined;
    }
    interface Listener {
        id:string;
        accept(reply: any, request:Object):Connection;

    }
    interface Protocol {
        connect(address: string, modem: string):Connection;
        listen():Listener;
    }
    interface identity {
        Protocol(protocolInterface:IProtocol):Protocol
    }

    export function Identity(path: string): identity;
    export function open(side:string): void;
    export function close(): void;
    export function isOpen(): boolean;
    export function daemon(): void;
}