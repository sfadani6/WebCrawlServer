function parseRSS(feed) {
  const results = [];
  try {
    const regex = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = regex.exec(feed)) !== null) {
      const block = m[1];
      const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
      const description = (block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
      const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || null;
      results.push({ title, link, description, pubDate });
    }
  } catch (_) {}
  return results;
}

function parseJSONFeed(raw) {
  const arr = Array.isArray(raw) ? raw : raw?.items || raw?.data || [];
  return arr.map((entry) => ({
    title: entry.title || '',
    link: entry.url || entry.link || '',
    content: entry.content || entry.body || entry.description || '',
    published_at: entry.published_at || entry.createdAt || entry.pubDate || null
  }));
}

async function execute(params, context) {
  const raw = context.variables.get('raw');
  const kind = (params?.parser === 'auto' ? 'auto' : 'json');
  const detected = kind === 'auto'
    ? (Array.isArray(raw) ? 'json' : raw?.items ? 'rss' : 'json')
    : kind;
  let items = [];
  if (detected === 'rss') {
    items = parseRSS(typeof raw === 'string' ? raw : '');
  } else {
    items = parseJSONFeed(raw || []);
  }
  items = items.map((item) => ({ ...item, raw: null }));
  context.variables.set('parsedItems', items);
  return items;
}

module.exports = { execute };
