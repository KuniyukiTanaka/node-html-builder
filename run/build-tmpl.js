import { consoleCollor, dafaultCollor, getProtoName } from '../lib/filter.mjs'
import { parseArgs } from 'node:util'
import fs from 'fs'
import path from 'path'
import bs from 'browser-sync'
import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url';


const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultOps = _ => {
  const flugs = parseArgs({
    "options": {
      "cfgJson": {
        "short": "c",
        "type": "string",
        "default": "assets/config/build-tmpl.json"
      },
      "bldPath": {
        "short": "d",
        "type": "string",
        "default": "assets/templates"
      },
      "bldFile": {
        "short": "f",
        "type": "string",
        "default": ""
      },
      "exclude": {
        "short": "e",
        "type": "string",
        "default": "**/_**/**,**/etc/**"
      },
      "demo": {
        "short": "z",
        "type": "boolean",
        "default": false
      }
    }
  }).values;
  for (const [k, v] of Object.entries(flugs)) {
    if (!!v && typeof v === 'string') {
      flugs[k] = path.normalize(v)
    }
  }
  return flugs
}
const BLD = new class Builder {
  flugs = defaultOps()
  constructor(test = false) {
    this.setDemo(test)
    const setJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), this.flugs.cfgJson), 'utf-8'))
    try {
      this.live = !!this.flugs.bldFile;
      this.buildFile = this.flugs.bldFile;
      this.source = setJson['source'] || this.flugs.bldPath
      this.exclude = this.flugs.exclude.split(',').map(e => e.trim())
      this.setSite(this.flugs.bldFile, setJson['buildList'])
    } catch (_e) {
      console.error({ pa: 'Builder:constructor', cfgJsonExist: fs.existsSync(this.flugs.cfgJson), _e })
      process.exit(1)
    }
  }
  setSite(File, Sites) {
    // if (!!File) {
    //   this.site = [Sites.find(dpSet => File.indexOf(path.join(path.sep, dpSet['label'], path.sep)))]
    // } else {
    // }
    this.site = Sites.filter(dpSet => (dpSet['label'] && this.chkDir(dpSet['label'])))
  }
  setDemo(test) {
    if (this.flugs.demo || test) {
      this.flugs.cfgJson = path.normalize("assets@demo/config/build-tmpl.json")
      this.flugs.bldPath = path.normalize("assets@demo/templates")
    }
  }
  chkDir(label) {
    const { dir, chk, mes } = {
      dir: path.join(process.cwd(), this.source, label),
      chk: dp => (fs.existsSync(dp) && fs.statSync(dp).isDirectory()),
      mes: _ => { this.live || console.error(consoleCollor(`buildSkiped :: "${label}" is not directory.`, 6, 1)) }
    }
    return chk(dir) || (mes(), false)
  }
}

class Finarizer {
  constructor() {
    this.Import()
    this.previewServ(BLD.site)
  }
  Import(_) {
    try {
      BLD.site.map(dpSet => {
        if (getProtoName(dpSet['importAssets']) === 'Object') {
          for (const [dp, e] of Object.entries(dpSet['importAssets'])) {
            for (const src of e.split('|')) {
              this.Asset(path.normalize(src), path.join('html', dpSet['label'], dp), dpSet['importAssets.recursive'])
            }
          }
        }
      })
    } catch (_e) {
      console.error({ method: 'assetImporter', mess: '[SKIP:ImportAssets]invalid importFile Settings,Check build-tmpl.json', _e }, dafaultCollor())
    }
  }
  Asset(src, dest, recursive = false) {
    const p = fs.statSync(src)
    if (p.isDirectory()) {
      const subDir = fs.readdirSync(src, { withFileTypes: true }).filter(d => d.isFile() || recursive)
      for (const dirent of subDir) {
        this.Asset(path.join(src, dirent.name), path.join(dest, dirent.name))
      }
    } else {
      if (src.match(`${path.sep}[.]`)) {
        console.log([`importThrow:: ${src}`])
        if (src.endsWith('.DS_Store')) fs.unlink(src, _e => { console.error([_e ? `ERR:notDeleted:: ${src}` : `Deleted:: ${src}`], dafaultCollor()) })
        return
      }
      const [parents, fileName] = path.extname(dest) ? [path.dirname(dest), ''] : [dest, path.basename(src)];
      fs.mkdirSync(parents, { recursive: true });
      fs.copyFileSync(src, path.join(dest, fileName))
    }
  }

  previewServ(s = [], p = 1000) {
    if (!s.length) return
    for (const dpSet of s) {
      if (Object.getPrototypeOf(dpSet['TemplatePreview.start'] || false) === String.prototype) {
        const sv_ops = Object.assign(
          {
            // host: "localhost",
            watch: true,
            open: false,
            logLevel: "silent",
            server: path.join(process.cwd(),'html',dpSet['label']),
            port: p,
            reloadDelay: 500,
            ui: { port: p + 1 }
          }
        )
        bs.create().init(sv_ops)
        console.log({ [dpSet['label']]: `http://localhost:${sv_ops.port}/p/` })
        p += 1000
      } else {
        console.log({ [dpSet['label']]: 'no Pleview' })
      }
    }
  }
};

((r = null) => {
  for (const dpSet of BLD.live ? [''] : BLD.site) {
    const FILES = BLD.buildFile || fs.globSync(path.join(BLD.source, dpSet['label'], '+(tmpl|scss)/**/*.*'), { exclude: BLD.exclude }).sort(f => path.extname(f) === '.scss' ? -1 : 1)
    r = new Worker(
      path.join(__dirname, 'build-worker.js'),
      {
        type: 'module',
        // stdout: true,
        // stderr: true,
        workerData: {
          BLD,
          FILES,
          SET_NAME: dpSet['label']
        }
      }
    )
  }
  if (r) {
    r.once('message', ({ FILES }) => {
      if (getProtoName(FILES) === 'String') {
        // console.log(dafaultCollor())
      } else if (getProtoName(FILES) === 'Array') {
        // clearInterval(inTervaled);
        new Finarizer()
      }
    })
  }
}
)()
