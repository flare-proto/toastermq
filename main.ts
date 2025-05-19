import * as event from "./event";
import * as ecnet2 from "ecnet2";
import * as random from "ccryptolib.random";
import { Broker } from "./toastermq";

// Initialize random generator from Krist websocket
const [postHandle, err] = http.post("https://krist.dev/ws/start", "{}");
assert(postHandle, "Failed to start Krist websocket");


const data = textutils.unserializeJSON(postHandle.readAll());
postHandle.close();
random.init(data.url);
// Get the websocket and close it if successful
const [ws] = http.websocket(data.url);
if (ws) ws.close();

// Open modem
ecnet2.open("top");

// Define identity
const id = ecnet2.Identity("/.ecnet2");

// Define a protocol
const ping = id.Protocol({
  name: "ping",
  serialize: textutils.serialize,
  deserialize: textutils.unserialize,
});

// Start listening
const listener = ping.listen();
const connections: Record<string, ecnet2.Connection> = {};

function main(): void {
  print("Server Started");
  while (true) {
    const evt = event.pullEvent();

    if (evt instanceof event.ECNet2RequestEvent && evt.id === listener.id) {
        Broker.connect(evt,listener)
    } else if (evt instanceof event.ECNet2MessageEvent && connections[evt.id]) {
      Broker.onMessage(evt)
    }
  }
}

parallel.waitForAny(main, ecnet2.daemon);


/*
class Connection {
    id:number;
    isEncrypted:boolean;
    encryptionKey:string;
    queues: Array<Queue>;
}

class Queue {
  packets: Array<string>;
  routing_key: string;
  exchange: string;
  name:string;
  connection:Connection;
}

class Exchange {
  packets: Array<string>;
  queues: Record<string, Queue>;
  name:string;
}

// Put your code here
let queues: Record<string, Queue> =  {}
let exchanges:Record<string, Queue> = {}

let connected = new Map<number, Connection>();



function recvPacket(evt:event.ModemMessageEvent) {
    let packet:Object = textutils.unserialiseJSON(evt.message);

    if (connected.has(evt.replyChannel)) {

    } else {

    }
}*/