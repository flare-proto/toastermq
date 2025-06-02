local ecnet2 = require "ecnet2"
local random = require "ccryptolib.random"
local mq = {}

local postHandle = assert(http.post("https://krist.dev/ws/start", "{}"))
local data = textutils.unserializeJSON(postHandle.readAll())
postHandle.close()
random.init(data.url)
http.websocket(data.url).close()

local id
local UUID
local Protocol
local connection
local callbacks = {}

id = ecnet2.Identity("/.ecnet2")
    Protocol = id:Protocol {
        -- Programs will only see packets sent on the same protocol.
        -- Only one active listener can exist at any time for a given protocol name.
        name = "toastermq0.0.1",

        -- Objects must be serialized before they are sent over.
        serialize = textutils.serialize,
        deserialize = textutils.unserialize,
    }


function mq.connect(side,addr)
    ecnet2.open(side)
    connection = Protocol:connect(addr, side)
    UUID = select(2, connection:receive())
end
function mq.send(route,data)
    local m = {
        id=UUID,
        routingKey= route,
        data= data
    }
    connection:send(m)
end

function mq.bind(queue,route,exchange)
    connection:send({
        id=UUID,
        declareQueue=queue
    })
    connection:send({
        id=UUID,
        declareExchange=exchange
    })
    connection:send({
        id=UUID,
        bindQueue={
            queue=queue,
            exchange=exchange,
            pattern=route
        }
    })
    
    connection:send({
        id=UUID,
        subscribeToQueue=queue
    })
end

function mq.recv()
    return connection:receive()
end


function mq.daemon()
    ecnet2.daemon()
end
return mq