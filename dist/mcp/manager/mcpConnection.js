export async function initializeMCP(proc, serverName) {
    const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
            protocolVersion: "2024-11-05",
            capabilities: {}
        }
    };
    proc.stdin.write(JSON.stringify(request) + "\n");
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`${serverName} init timeout`)), 5000);
        proc.stdout.once("data", (data) => {
            clearTimeout(timeout);
            const msg = JSON.parse(data.toString());
            if (msg.result) {
                console.log(`[${serverName}] initialized`);
                resolve();
            }
            else {
                reject(msg.error);
            }
        });
    });
}
