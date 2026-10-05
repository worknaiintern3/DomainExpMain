const https = require('https');
const fs = require('fs');
const path = require('path');

const icons = {
  'com_aitourism.png': 'https://play-lh.googleusercontent.com/jNAXxMyCeeK24C3T19UZOC6cQRU33ZJsGYPwCInqoziUsS3nU4cGnB_GD_uVo9S-HTGoCu_dRKEA_Xg2U3C5Ag=s512',
  'com_anyworkservices_app.png': 'https://play-lh.googleusercontent.com/BCtsTWUp-2UJLb1MULKdbhnWfJmhs4sjY0-akD0nF82IM4sw_n5iPauS-xUo3dwd8gYmhEQ1Vyw4f5fHKUCs=s512',
  'com_blooddonation_online.png': 'https://play-lh.googleusercontent.com/RCvZmhdhqEbFdpb_JG3kJSdueIfHA7qQwjPRIhFyev-NPCewlqsvm_w6jBUpWDIiT21Yu8Qv8Y7YYQI4WbKkYgM=s512',
  'com_goairclass_onlinego.png': 'https://play-lh.googleusercontent.com/rv3dAl6iJ4DaBFOyo15HfalwnG6jrLNZFmJlVVB9nHwr0UEyz0XU7sTxUgRgaW_KNhY4DAau15DeBn2ThUaYpg=s512',
  'com_livesale_fitness.png': 'https://play-lh.googleusercontent.com/nhy4Vs9d01T2tEB7WZFophfgN3zcal7bfzfNM8TYklDN7WFWeKnLJ6lEW5NYXVsNvd0M7b5evKGKueCD4byJ=s512',
  'com_healthyfood_cafe.png': 'https://play-lh.googleusercontent.com/Xnf13_Jv0sXOAinjnODuy3b1UR2BOF1IWpbMdSKgLlnisHaU1qqg4unfCosvTCz5q1qt3npUmWpMQkrGEKQtRl8=s512',
  'com_app_itjobx_com.png': 'https://play-lh.googleusercontent.com/6Qgg_Hk0LpzXxSiUakR9I-AdbS0vzIcD7fIO8kCmU3tUcGG-v1tmUPVlB8TKMI0M6l1BxdDXVnoJ2r7S-zsRmg=s512',
  'com_lovenzea_online.png': 'https://play-lh.googleusercontent.com/OhX9JtTyH-evgHyubab_XHdWQhLTU-yauGjD65PqLzsnzt578i-zi4-q_j2HZpMn68cJr2ti32ygqEOdM8AZhXc=s512',
  'com_worknai_mobilepaycafe.png': 'https://play-lh.googleusercontent.com/Y4nLwCVCQywQIZM1K46408k6aq3wCukck_9gCSYLe59Wquo-kQLGpPNj7RqBtpYP3SjAcyNL26nqPUTg6LmwIw=s512',
  'com_worknai_namasteyyy.png': 'https://play-lh.googleusercontent.com/3kdVBrj8QVoL-nXNdLaLcOi29JQhZe4neLpOD9PYvCRsGCP-wHL7OKNiRRF9KT_Q_ZgLvf50GIn_jpQEyNG8N_A=s512',
  'com_chessApp_WorknAi.png': 'https://play-lh.googleusercontent.com/G_QSRxDMaVjtDU8LO5lYO_G0PgwNzMA2MOJG-Occv8K9JWYeuHLm-EA7843bxa6bsc0CIeIE0kruXd1SzWfKkA=s512',
  'com_mantis_onlinego.png': 'https://play-lh.googleusercontent.com/CzT5nSorecJs7zFSe59zNEBLQUBpdx_bmhWO_GqZE4lanDYoVfAMZdzr8Y5POlCTLavBmpapNnAhJVbBCqrD=s512',
  'com_onlinegologistics.png': 'https://play-lh.googleusercontent.com/jQoiNRrOV0zfxkyQTVon_3cWzdcb93zbNXQSF8DJfNx69f1NrudG8RbgsBdtEERsD5N-AkaMopoq0sTOmzGE=s512',
  'com_pginfo_onlinee.png': 'https://play-lh.googleusercontent.com/xeQ1ih76EvM6RLQDqrwkQfLoXIso294jfzbUzcpeiEobmIn9PsAxqUAK2aXpkIqT7biO9lfS9__JdMQxDaKYHw=s512',
  'com_worknai_hrms.png': 'https://play-lh.googleusercontent.com/RFNlgo1LelZ_eOFrInX-oUvsDqmPgBgNakOvub2vEtJ1f-SwOvCXVUh5uH6aSfwoN4qgjsNUOoAtebYEMMY5=s512',
};

const targetDir = path.join(__dirname, '..', 'assets', 'images', 'app-icons');

function download(filename, url) {
  return new Promise((resolve, reject) => {
    const dest = path.join(targetDir, filename);
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return download(filename, res.headers.location).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${filename} (${fs.statSync(dest).size} bytes)`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      console.error(`Error downloading ${filename}:`, err);
      reject(err);
    });
  });
}

(async () => {
  for (const [filename, url] of Object.entries(icons)) {
    try {
      await download(filename, url);
    } catch (e) {
      console.error(e);
    }
  }
  console.log('All official icons downloaded successfully!');
})();
