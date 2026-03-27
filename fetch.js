const https = require('https');
const fs = require('fs');

const fetchSvg = (url, path) => {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'BotScript/1.0 (test@example.com)' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        fs.writeFileSync(path, data);
        resolve(data);
      });
    }).on('error', () => resolve(null));
  });
};

(async () => {
    await fetchSvg('https://upload.wikimedia.org/wikipedia/commons/a/af/Adobe_Photoshop_CC_icon.svg', 'ps.svg');
    await fetchSvg('https://upload.wikimedia.org/wikipedia/commons/c/c1/3ds_Max_Logo.svg', 'max.svg');
    // Also try another classic PS logo
    await fetchSvg('https://upload.wikimedia.org/wikipedia/commons/2/20/Photoshop_CC_icon.png', 'ps.png'); 
    
    // Some versions are very standard CC 2015/2019
    await fetchSvg('https://upload.wikimedia.org/wikipedia/commons/b/b3/Adobe_Photoshop_CC_icon_%282015-2019%29.svg', 'ps_old.svg');

    console.log('done');
})();
