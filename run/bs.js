'use strict'
const bs = require('browser-sync')
const { validCMS } = new (require('./cms'))
const base_ops = {
  // host: "localhost",
  watch: true,
  open: false,
  logLevel: "silent"
}
let base_port = 1000

if (!Object.keys(validCMS)[0]) (({exec}) => exec(`kill ${process.pid + 1}`))(require('child_process'));

for (const [cms, set] of Object.entries(validCMS)) {
  if (Object.getPrototypeOf(set.TemplatePreview?.prePreview || false) === String.prototype) {
    const serv_ops = Object.assign(
      base_ops,
      {
        server: `${process.cwd()}/html/${cms}/`,
        port: base_port,
        reloadDelay: 500,
        ui: { port: base_port + 1 }
      }
    )
    bs.create().init(serv_ops)
    console.log({ [cms]: `http://localhost:${serv_ops.port}/p/` })
    base_port += 1000
  } else {
    console.log({ [cms]: 'no Pleview' })
  }
}
