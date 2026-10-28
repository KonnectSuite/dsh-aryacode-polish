const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const oldTail = `      }, 'Unarchive session'))
    : null`
if (!src.includes(oldTail)) throw new Error('archived tail anchor missing')
src = src.replace(oldTail, `      }, 'Unarchive session'),
      React.createElement('button', {
        type: 'button',
        'data-polish-archived-open': menu.row.id,
        style: WS_MENU_ITEM,
        onClick: () => {
          const row = menu.row
          closeMenu()
          try { services.openSession(row.id) } catch { setNotice('Could not open that session.') }
        },
      }, 'Open session'),
      React.createElement('button', {
        type: 'button',
        'data-polish-archived-copy': menu.row.id,
        style: WS_MENU_ITEM,
        onClick: async () => {
          const row = menu.row
          closeMenu()
          try {
            await navigator.clipboard.writeText(row.id)
            setNotice('Copied the session id.')
          } catch {
            setNotice('Could not copy the session id.')
          }
        },
      }, 'Copy session id'))
    : null`)
fs.writeFileSync(p, src)
console.log('archived menu gained open + copy')
