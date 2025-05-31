import * as ecnet2 from "ecnet2";
import * as event from "./event";


interface IDataHandler {
    enqueue(data:any): void;
}

export class Packet {
    public routingKey:string;
    public data:any;
    constructor(routingKey:string,data:any) {
        this.routingKey = routingKey;
        this.data = data;
    }
}

export class Connection {
    private networkConnection:ecnet2.Connection;
    //TODO Queues

    constructor(conn:ecnet2.Connection) {
        this.networkConnection = conn;
    }
    public onMessage(raw:any) {
         try {
            const obj = (raw);

            if (obj.subscribeToQueue) {
                this.subscribeToQueue(obj.subscribeToQueue);
            }else if (obj.declareQueue) {
                Broker.getQueue(obj.declareQueue);
                print("declareQueue")
            }else if (obj.declareExchange) {
                Broker.getExchange(obj.declareExchange)
                print("declareExchange")
            }else if (obj.bindQueue) {
                const { queue, exchange, pattern } = obj.bindQueue;
                print("bindQueue")
                Broker.bind(exchange, queue, pattern);
            } else if (obj.routingKey && obj.data) {
                const pkt = new Packet(obj.routingKey, obj.data);
                this.recv(pkt);
            }

        } catch (err) {
            printError("Invalid message", err);
        }
        
    }
    public recv(packet:Packet) {
        
        const [exchangeName, ...keyParts] = packet.routingKey.split(".");
        const actualKey = keyParts.join(".");
        const exchange = Broker.getExchange(exchangeName);

        exchange.enqueue(new Packet(actualKey, packet.data));
    }
    public send(packet:Packet) {
        this.networkConnection.send(packet);
    }
    public subscribeToQueue(queueName: string): void {
        const queue = Broker.getQueue(queueName);
        queue.subscribe(this);
    }
}

export class Exchange implements IDataHandler {
    private bindings: { pattern: string, queue: Queue }[] = [];

    constructor(public routingKey: string) {}

    public bindQueue(pattern: string, queue: Queue): void {
        this.bindings.push({ pattern, queue });
    }

    public enqueue(data: Packet): void {
        for (const { pattern, queue } of this.bindings) {
            if (this.matchRoutingKey(pattern, data.routingKey)) {
                queue.enqueue(data);
            }
        }
    }

    private matchRoutingKey(pattern: string, key: string): boolean {
        const p = pattern.split(".");
        const k = key.split(".");

        for (let i = 0; i < p.length; i++) {
            if (p[i] === "#") return true;
            if (p[i] === "*") continue;
            if (p[i] !== k[i]) return false;
        }

        return p.length === k.length;
    }
}

export class Queue implements IDataHandler {
    private buffer: Packet[] = [];
    private consumers: Set<Connection> = new Set();

    public enqueue(data: Packet): void {
        this.buffer.push(data);
        this.deliver();
    }

    public subscribe(conn: Connection): void {
        this.consumers.add(conn);
        this.deliver();
    }

    private deliver(): void {
        while (this.buffer.length > 0) {
            const pkt = this.buffer.shift();
            if (!pkt) continue;

            for (const conn of this.consumers) {
                conn.send(pkt);
            }
        }
    }
}

function uuid() {
    let template ='xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    return string.gsub(template, '[xy]', (c) => {
        let v = (c == 'x') && math.random(0, 0xf) || math.random(8, 0xb)
        return string.format('%x', v)
    })
}
export class Broker {
    private static exchanges: LuaTable<string, Exchange> = new LuaTable<string, Exchange>();
    private static queues: LuaTable<string, Queue> = new LuaTable<string, Queue>();

    private static connections: LuaTable<string, Connection> = new LuaTable<string, Connection>();

    // Get or create an exchange
    public static getExchange(name: string): Exchange {
        if (!this.exchanges.has(name)) {
            this.exchanges.set(name, new Exchange(name));
        }
        return this.exchanges.get(name)!;
    }

    // Get or create a queue
    public static getQueue(name: string): Queue {
        if (!this.queues.has(name)) {
            this.queues.set(name, new Queue());
        }
        return this.queues.get(name)!;
    }

    public static connect(evt:event.ECNet2RequestEvent,listener:ecnet2.Listener): LuaMultiReturn<[ecnet2.Connection,string]> {
        //TODO Auth?
        print("connect",evt.id,evt.request)
        const [id,_] = uuid()
        const connection = listener.accept(id, evt.request);
        let conn = new Connection(connection);
        this.connections.set(id,conn);
        return $multi(connection,id);
    }

    public static onMessage(evt:event.ECNet2MessageEvent) {
        print("ECNet2MessageEvent",evt.msg.id)
        xpcall(() => {
            if (!this.connections.has(evt.msg.id)) {
                print("NO EXISTS")
            }
            const con = this.connections.get(evt.msg.id)
            con.onMessage(evt.msg);
        },(e) => {
            printError(e)
           
        })

        
    }

    // Bind a queue to an exchange with a routing pattern
    public static bind(exchangeName: string, queueName: string, pattern: string): void {
        const exchange = this.getExchange(exchangeName);
        const queue = this.getQueue(queueName);
        exchange.bindQueue(pattern, queue);
    }
}   