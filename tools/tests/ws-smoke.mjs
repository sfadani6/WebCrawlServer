import WebSocket from "ws";

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const serverUrl = "ws://localhost:9600/?clientId=";

  console.log("Starting WS smoke test...");

  // Plugin client
  const pluginId = "test-plugin-1";
  const plugin = new WebSocket(`${serverUrl}${pluginId}&clientType=plugin`);

  let pluginReceivedPing = false;
  let pluginReceivedPong = false;

  plugin.on("open", () => {
    console.log("[plugin] connected");
  });

  plugin.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      console.log("[plugin] recv", msg.action);
      if (msg.action === "PING_TEST") {
        pluginReceivedPing = true;
        // respond with PONG_RESPONSE
        const pong = {
          senderId: pluginId,
          targetId: "SERVER",
          action: "PONG_RESPONSE",
          payloadType: "json",
          payload: {
            originalTimestamp: msg.meta?.timestamp || Date.now(),
            responseTimestamp: Date.now(),
            clientId: pluginId,
          },
          meta: { timestamp: Date.now() },
        };
        plugin.send(JSON.stringify(pong));
      }
      if (msg.action === "PONG_RESPONSE") {
        pluginReceivedPong = true;
      }
    } catch (e) {
      // ignore
    }
  });

  // Admin client
  const adminId = "test-admin-1";
  const admin = new WebSocket(`${serverUrl}${adminId}&clientType=admin`);

  let adminSentBroadcast = false;
  let adminReceivedPong = false;

  admin.on("open", async () => {
    console.log("[admin] connected");
    // Wait briefly for plugin to be ready
    await wait(200);

    // Send broadcast PING_TEST to ALL
    const ping = {
      senderId: adminId,
      targetId: "ALL",
      action: "PING_TEST",
      payloadType: "json",
      payload: { timestamp: Date.now() },
      meta: { timestamp: Date.now() },
    };

    admin.send(JSON.stringify(ping));
    adminSentBroadcast = true;
    console.log("[admin] sent broadcast PING_TEST");

    // Also send a direct PING_TEST from admin to plugin
    const pingToPlugin = { ...ping, targetId: pluginId };
    admin.send(JSON.stringify(pingToPlugin));
  });

  admin.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      console.log("[admin] recv", msg.action);
      if (msg.action === "PONG_RESPONSE") {
        adminReceivedPong = true;
      }
    } catch (e) {}
  });

  // wait for events
  await wait(3000);

  console.log("Results:");
  console.log(" pluginReceivedPing:", pluginReceivedPing);
  console.log(" pluginReceivedPong:", pluginReceivedPong);
  console.log(" adminSentBroadcast:", adminSentBroadcast);
  console.log(" adminReceivedPong:", adminReceivedPong);

  // cleanup
  try {
    admin.close();
  } catch {}
  try {
    plugin.close();
  } catch {}

  const success = pluginReceivedPing && adminSentBroadcast;
  process.exit(success ? 0 : 2);
}

run().catch((err) => {
  console.error(err);
  process.exit(3);
});
