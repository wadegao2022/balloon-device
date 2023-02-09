/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const fs = require('fs');
const child_process = require('child_process');
const path = require('path');

const srcdir = path.join(__dirname, 'src');
const srcfiles = [];
const filter = process.argv.slice(2);

fs.readdirSync(srcdir).filter((dir) => {
  const fullpath = path.join(srcdir, dir);
  if (fs.statSync(fullpath).isDirectory()) {
    const name = path.basename(fullpath);
    if (filter.length === 0 || filter.indexOf(name) >= 0) {
      const main = path.join(fullpath, 'main.ts');
      const html = path.join(fullpath, 'index.html');
      if (fs.existsSync(main) && fs.statSync(main).isFile() && fs.existsSync(html) && fs.statSync(html).isFile()) {
        srcfiles.push([
          main,
          path.join(__dirname, 'dist-tmp', `${dir}.js`),
          html,
          path.join(__dirname, 'dist-tmp', `${dir}.html`)
        ]);
      }
    }
  }
});

fs.mkdirSync(path.join(__dirname, 'dist-tmp'), {
  recursive: true
});

for (const file of srcfiles) {
  // const cmd = `--no-compress -o "${file[1]}" --external "./chaospace.modern.js" --alias "chaospace=./chaospace.modern.js"`;
  const cmd = `microbundle -i "${file[0]}" --no-pkg-main -f modern --target web -o "${file[1]}" --external __balloon__ --alias balloon-device=__balloon__ --no-compress && replace '__balloon__' './balloon-device.modern.js' "${file[1]}"`;
  console.log(`exec: ${cmd}`);
  child_process.execSync(cmd);
  fs.copyFileSync(file[2], file[3]);
}
