const https = require('https');
const fs = require('fs');
const path = require('path');

const packages = [
  'com.aitourism',
  'com.anyworkservices.app',
  'com.blooddonation.online',
  'com.goairclass.onlinego',
  'com.goairclass.app',
  'com.livesale.fitness',
  'com.healthyfood.cafe',
  'com.app.itjobx.com',
  'com.inquiryexperts.app',
  'com.lovenzea.online',
  'com.worknai.mobilepaycafe',
  'com.worknai.namasteyyy',
  'com.chessApp.WorknAi',
  'com.mantis.onlinego',
  'com.onlinegologistics',
  'com.pginfo.onlinee',
  'com.worknai.hrms',
  'com.worknai'
];

async function check(pkg) {
  return new Promise(resolve => {
    https.get(`https://play.google.com/store/apps/details?id=${pkg}&hl=en`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const m = data.match(/<meta property="og:image" content="([^"]+)"/);
        const mTitle = data.match(/<title id="main-title">([^<]+)<\/title>/) || data.match(/<title>([^<]+)<\/title>/);
        const iconMatch = data.match(/https:\/\/play-lh\.googleusercontent\.com\/[a-zA-Z0-9_\-]+/g);
        resolve({
          pkg,
          status: res.statusCode,
          ogImage: m ? m[1] : null,
          title: mTitle ? mTitle[1] : null,
          icons: iconMatch ? Array.from(new Set(iconMatch)) : []
        });
      });
    }).on('error', e => resolve({ pkg, error: e.message }));
  });
}

(async () => {
  for (const pkg of packages) {
    const res = await check(pkg);
    console.log(JSON.stringify({ pkg: res.pkg, status: res.status, title: res.title, ogImage: res.ogImage, sampleIcon: res.icons[0] }));
  }
})();
