const { generateSecret } = require('otplib');
const qrcode = require('qrcode');

const secret = generateSecret(20);
const uri = `otpauth://totp/PortafolioDeLucia:admin?secret=${secret}&issuer=PortafolioDeLucia`;

qrcode.toString(uri, {type: 'terminal'}, function (err, url) {
  console.log('====================================================');
  console.log('  ESCANEA ESTE CÓDIGO QR EN GOOGLE AUTHENTICATOR    ');
  console.log('====================================================');
  console.log(url);
  console.log('====================================================');
  console.log('  O INGRESA ESTE SECRETO MANUALMENTE EN LA APP:     ');
  console.log('  ' + secret);
  console.log('====================================================');
  console.log('\nIMPORTANTE: Copia el secreto (' + secret + ') y guárdalo como la variable de entorno ADMIN_2FA_SECRET en Railway.\n');
});
