module.exports = {
  testEnvironment: 'node',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'require']
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jsdom|json2csv|html-encoding-sniffer|whatwg-encoding|whatwg-mimetype|abab|decimal.js|nwsapi|rrweb-cssom|xml-name-validator|cssstyle|cssom|data-urls|domexception|w3c-xmlserializer|http-proxy-agent|https-proxy-agent|agent-base|@asamuzakjp|@csstools|@exodus|is-potential-custom-element-name))'
  ]
};