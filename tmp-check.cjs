const fs = require('node:fs')
const crypto = require('node:crypto')
const files = [
  'lib/client.js',
  'C:/Users/KNPhu/AppData/Local/AryaCode-dev/aryacode-home/profiles/desktop/node_modules/@aryacode/dsh-aryacode-polish/lib/client.js',
]
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 12)
  let verdict = 'compiles'
  try {
    new Function('window', 'document', text)
  } catch (error) {
    verdict = 'SYNTAX: ' + error.message
  }
  console.log(file.split('/').slice(-3).join('/') + '  ' + text.length + '  ' + hash + '  ' + verdict)
}
