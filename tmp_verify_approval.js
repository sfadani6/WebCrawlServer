const helper = require('./server/db/helper');
(async () => {
  const requestId = await helper.insertPluginRequest({
    browser_name: 'Verification Browser',
    browser_version: '1.0',
    extension_id: 'verify-ext',
    hostname: 'browser-extension'
  });
  const token = await helper.approvePluginRequest(requestId);
  const row = await helper.queryOne('SELECT status, approved_token FROM plugin_requests WHERE id = ?', [requestId]);
  console.log(JSON.stringify({ requestId, token, status: row.status, approvedToken: row.approved_token }));
})().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
