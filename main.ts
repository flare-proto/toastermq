import * as event from "./event";
import * as ecnet2 from "ecnet2";
import * as random from "ccryptolib.random";
import { Broker } from "./toastermq";
import * as pp from "cc.pretty";

// Initialize random generator from Krist websocket
const [postHandle, err] = http.post("https://krist.dev/ws/start", "{}");
assert(postHandle, "Failed to start Krist websocket");


const data = textutils.unserializeJSON(postHandle.readAll());
postHandle.close();
random.init(data.url);
// Get the websocket and close it if successful, be nice
const [ws] = http.websocket(data.url);
if (ws) ws.close();

// Open modem
ecnet2.open("top");

// Define identity
const id = ecnet2.Identity("/.ecnet2");

// Define a protocol
const ping = id.Protocol({
  name: "toastermq0.0.1",
  serialize: textutils.serialize,
  deserialize: textutils.unserialize,
});

// Start listening
const listener = ping.listen();
const connections: LuaTable<string, ecnet2.Connection> = new LuaTable<string, ecnet2.Connection>();

function main(): void {
  print("Server Started");
  while (true) {
    const evt = event.pullEvent();

    if (evt instanceof event.ECNet2RequestEvent && evt.id === listener.id) {
      const [net,id] = Broker.connect(evt,listener);
      connections[id] = net
    } else if (evt instanceof event.ECNet2MessageEvent && connections[evt.msg.id]) {
      Broker.onMessage(evt);
    } 
  }
}

//TODO better threading
parallel.waitForAny(main, ecnet2.daemon);