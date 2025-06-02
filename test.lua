local toastermq = require "toastermq_client"
local function main()
    toastermq.connect("top","MV8fwEzJu0qhBTyaJIPg8XM1tmxEdOvZM8dK312LTyA=")

    toastermq.bind("test","test","test")
    toastermq.send("test.test","e")
    local _,b = toastermq.recv()
    print(b.data)
end

parallel.waitForAny(main, toastermq.daemon)