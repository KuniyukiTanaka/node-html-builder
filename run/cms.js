import { messCollor } from '../lib/filter.mjs'
import fs from 'fs'
import path from 'path'
import { parseArgs } from 'node:util'

module.exports = class {
  constructor() {
    const __Base__ = this.options()
    this.tmplDir = fs.readdirSync(__Base__.tmplDir, { withFileTypes: true }).filter(d => d.isDirectory() && d.name[0] !== '_').map(r => r.name)
    this.ignoreCMS = this.ignoreCMS
    this.validCMS = this.readECsetting(path.join(process.cwd(), __Base__.dirConfig, 'build-tmpl.json'))
  }
  options() {
    return parseArgs({
      "options": {
        "dirConfig": {
          "short": "c",
          "type": "string",
          "default": "assets/config"
        },
        "tmplDir": {
          "short": "d",
          "type": "string",
          "default": "assets/templates/tmpl"
        },
        "styleDir": {
          "short": "s",
          "type": "string",
          "default": "assets/templates/scss"
        },
        "file": {
          "short": "f",
          "type": "string",
          "default": ""

        }
      }
    }).values;
  }
  ignoreCMS(i) {
    const v = Object.keys(this.validCMS)
    const ign = this.tmplDir.filter(i => v.indexOf(i) === -1)
    return [...i, ...ign.map(n => `**/${n}/**`)]
  }
  readECsetting(json) {
    const f = JSON.parse(fs.readFileSync(json, 'utf-8'))
    const chk = cms => (this.tmplDir.indexOf(cms) + 1) || (console.log(messCollor(`buildSkiped :: "${cms}" is noDir`, 6, 1)), 0)
    for (const cms in f) {
      if (!f[cms].output || !chk(cms)) {
        delete f[cms]
      }
    }
    return f
  }
}