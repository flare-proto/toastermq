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
                Broker.getQueue(obj.declareQueue); // idempotent
            }else if (obj.bindQueue) {
                const { queue, exchange, pattern } = obj.bindQueue;
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

    constructor(public routingKey: string) {} // Optional metadata

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
export class Broker {
    private static exchanges: Map<string, Exchange> = new Map();
    private static queues: Map<string, Queue> = new Map();

    private static connections: Map<string, Connection> = new Map();

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

    public static connect(evt:event.ECNet2RequestEvent,listener:ecnet2.Listener):ecnet2.Connection {
        //TODO Auth?
        const connection = listener.accept("toastermq0.1.0", evt.request);
        let conn = new Connection(connection);
        this.connections[evt.id]=conn;
        return connection;
    }

    public static onMessage(evt:event.ECNet2MessageEvent) {
        try {
            this.connections.get(evt.id).onMessage(evt.msg);
        } catch {}
        
    }

    // Bind a queue to an exchange with a routing pattern
    public static bind(exchangeName: string, queueName: string, pattern: string): void {
        const exchange = this.getExchange(exchangeName);
        const queue = this.getQueue(queueName);
        exchange.bindQueue(pattern, queue);
    }
}   