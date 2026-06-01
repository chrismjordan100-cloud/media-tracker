const { Jimp } = require('jimp');
const { default: pngToIco } = require('png-to-ico');
const fs = require('fs');
const path = require('path');

async function convert() {
  const img = await Jimp.read(path.join(__dirname, 'alien.jpg'));
  img.resize({w: 256, h: 256});
  await img.write(path.join(__dirname, 'alien.png'));
  const buf = fs.readFileSync(path.join(__dirname, 'alien.png'));
  const ico = await pngToIco(buf);
  fs.writeFileSync(path.join(__dirname, 'alien.ico'), ico);
  console.log('Icon created: alien.ico');
}
convert();
