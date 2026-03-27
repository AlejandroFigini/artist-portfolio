const https = require('https');
const fs = require('fs');

const fetchSvg = (url, path) => {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
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
    await fetchSvg('https://upload.wikimedia.org/wikipedia/commons/a/af/Adobe_Photoshop_CC_icon.svg', 'assets/images/ps-logo.svg');
    await fetchSvg('https://upload.wikimedia.org/wikipedia/commons/c/c1/3ds_Max_Logo.svg', 'assets/images/3dsmax-logo.svg');
    console.log('done');
})();
