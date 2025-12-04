import { consoleCollor, dafaultCollor, getProtoName } from './filter.mjs'
import { parseArgs } from 'node:util'
import fs from 'fs'
import path from 'path'
import ejs from 'ejs'
import postcss from 'postcss'
import cssGap from 'postcss-gap-properties'
import cssMinify from 'postcss-minify'
import autoprefixer from 'autoprefixer'
import * as sass from 'sass'
import { parse } from 'csv-parse/sync'
import { createRequire } from 'module'
import UglifyJS from 'uglify-js'
import bs from 'browser-sync'
import { fstatSync } from 'node:fs'

const require = createRequire(import.meta.url);
const interpretDirectScripts = ({ Sync, Loaded, option }) => {
  const Case = (s = []) => s.map(c => `(_=>{\n${(getProtoName(c) === 'String') ? fs.readFileSync(c) : c.toString().replace(/[^{}]+?{([\S\s]+)}$/, '$1')}\n})();`).join('')
  const r = Case(Sync) + Case(Loaded)
  return !option?.minify ? r.replace(/;/g, ';\n') : UglifyJS.minify(r).code
}

const Filter = new class {
  preview = [this.practice, this.testcase]
  fook = {
    preview: (data, methods = []) => {
      if (getProtoName(methods) === 'String') {
        (methods === 'all') ? this.preview.map(m => data.code = m(data)) : this.fook.preview(data, [methods])
      }
      return data.code
    }
  }

  practice({ code, practice }) {
    if (practice) {
      code = code.replace('</head>', r => `<script name="__practice__">__practice__=${JSON.stringify((getProtoName(practice) === 'String') ? JSON.parse(fs.readFileSync(path.normalize(practice))) : practice)}</script></head>`)
    }
    return code
  }
  testcase({ code, testcase }) {
    if (testcase) {
      for (const { from, to } of testcase.filter(({ name }) => name ? 1 : 0)) {
        code = code.replace(RegExp(from, 'g'), to)
      }
    }
    return code
  }
}

const bld = class Builder {
  flugs =
    parseArgs({
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
        }
        ,
        "demo": {
          "short": "z",
          "type": "boolean",
          "default": false
        }
      }
    }).values;
  constructor(test = false) {
    this.setDemo(test)
    try {
      const setJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), this.flugs.cfgJson), 'utf-8'))
      this.live = !!this.flugs.bldFile;
      this.buildFile = this.flugs.bldFile;
      this.source = setJson['source'] || this.flugs.bldPath
      this.site = setJson['buildList'].filter(dpSet => (dpSet['label'] && this.chkDir(dpSet['label'])))
    } catch (_e) {
      console.error({ pa: 'Builder:constructor', cfgJsonExist: fs.existsSync(this.flugs.cfgJson), _e })
      process.exit(1)
    }
  }
  setDemo(test) {
    if (this.flugs.demo || test) {
      this.flugs.cfgJson = "assets@demo/config/build-tmpl.json"
      this.flugs.bldPath = "assets@demo/templates"
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

const ext = class eXtracter {
  worker = {
    TemplateHook(code, data) {
      const regex = /\[\[__([\w_-]+)__\]\]/g
      return (getProtoName(data) === 'Object') ? code.replace(regex, (_, word) => data[word]) : code
    }
  }
  builder = {
    fileBuild: fp => {
      const method = { '.html': this.builder['Throw'], '.ejs': this.builder['EJS'], '.scss': this.builder['CSS'], '.cjs': this.builder['exEJS'] }
      try {
        this._setRunning(fp)
        if (method[this.running.ext] && this.running.deploySet['label']) method[this.running.ext](this.running)
      } catch (_e) {
        console.error({ method: 'fileBuild', input: fp, _e })
        process.exit(1)
      }
    },
    Import: async _ => {
      try {
        site.map(dpSet => {
          if (getProtoName(dpSet['importAssets']) === 'Object') {
            for (const [dp, e] of Object.entries(dpSet['importAssets'])) {
              for (const src of e.split('|')) {
                this.Asset(path.normalize(src), path.join('html', dpSet['label'], dp))
              }
            }
          }
        })
      } catch (_e) {
        console.error({ method: 'assetImporter', mess: '[SKIP:ImportAssets]invalid importFile Settings,Check build-tmpl.json', _e })
      }
    },
    Throw: ({ input, deploySet, name, ext }) => {
      try {
        this._output({
          method: 'Throw',
          name,
          dir: path.join('html', deploySet['label']),
          ext,
          code: fs.readFileSync(input, 'utf-8').toString()
        },
          this._setPreview(deploySet, input)
        )
      } catch (_e) {
        this._error({ method: 'Throw', log: _e })
      }
    },
    EJS: ({ input, deploySet, whiteSpaceFilter, name }) => {
      try {
        const [code, practice] = this.CJS(
          ejs.render(
            fs.readFileSync(input, 'utf-8').toString(),
            {},
            { views: this._ejsOpViews(), rmWhitespace: whiteSpaceFilter }
          )
        )

        this._output({
          method: 'EJS',
          name,
          dir: path.join('html', deploySet['label']),
          ext: '.html',
          code
        },
          this._setPreview(deploySet, input, practice)
        )
      } catch (_e) {
        this._error({ method: 'EJS', log: _e })
        process.exit(1)
      }
    },
    exEJS: _ => {
      if (live && this.running.base.endsWith('.cjs')) {
        this.running = {
          ...this.running,
          ...(i => ({ input: i, ...path.parse(i) }))(this.running.input.replace(/\.cjs$/, '.ejs'))
        }
        this.builder.EJS(this.running)
      }
    },
    CSS: ({ input, deploySet, name, whiteSpaceFilter }) => {
      const root_tag = 'root@'
      try {
        (({ cssMinify, sass }) => {
          const pligins = [autoprefixer({ remove: false }), cssGap, cssMinify].filter(p => !!p)
          this._output({
            method: 'CSS',
            name,
            dir: path.join('html', deploySet['label']),
            ext: '.css',
            code: postcss(pligins).process(sass).css.replace('@charset "UTF-8";', '').trim()
          })
        })({
          cssMinify: whiteSpaceFilter ? cssMinify : null,
          sass: sass.compile(input, {
            importers: [{
              findFileUrl: (url) => (url.startsWith(root_tag)) ? new URL(`file://${path.resolve(url.substring(root_tag.length))}`) : null
            }]
          }).css
        })
      } catch (_e) {
        this._error({ method: 'CSS', log: _e })
        process.exit(1)
      }

    }
  }
  constructor(test = false) {
    (({ site, live, buildFile, source }) => {
      this.site = site
      this.live = live
      this.buildFile = buildFile
      this.source = source
    })(new bld(test))
  }
  _cation({ method, log, data = undefined }) {
    console.error(
      consoleCollor((l => [l, `Cation:eXtracter.${method}()`, l].join('\n'))('='.repeat(100)), 1) + dafaultCollor(),
      { data, log }
    )
  }
  _error({ method, log, data = undefined }) {
    console.error(
      consoleCollor((l => [l, `ERR:eXtracter.${method}()`, l].join('\n'))('='.repeat(100)), 2) + dafaultCollor(),
      { data, running: this.running, log }
    )
  }
  _ejsOpViews() {
    return [
      path.join(source, this.running.deploySet['label']),
      this.running.dir,
      ''
    ]
  }
  _output({ method, code, dir, name, ext }, pData = false) {
    try {
      fs.writeFileSync(
        path.format({ dir: (d => (fs.mkdirSync(d, { recursive: true }), d))(dir), name, ext }),
        code
      );
      if (pData && pData.target === this.running.input) this.Preview(code, pData);
    } catch (_e) {
      this._error({ method: `_output[__${method}__]`, log: _e })
      process.exit(1)
    }
  }
  _setPreview(dpSet, input, practice) {
    const siteRoot = path.join(this.source, dpSet['label'])
    const siteReg = siteRoot + dpSet['TemplatePreview.start'].replace(path.join(siteRoot), '')
    try {
      fs.statSync(siteReg)
      return (prebuild =>
        (prebuild) ?
          {
            prebuild,
            target: (prebuild && live) ? input : prebuild,
            basetmpl: dpSet['TemplatePreview.baseTmpl'] || '',
            styles: dpSet['TemplatePreview.styles'] || [],
            testcase: dpSet['TemplatePreview.testCase'] || null,
            practice: practice || null,
          } : null
      )(siteReg)
    } catch (_e) {
      this._cation({
        method: '_setPreview',
        data: {
          start: dpSet['TemplatePreview.start'],
          siteReg
        },
        log: `[SKIP:Preview] TemplatePreview.start is invaild value. check build-tmpl.json`
      })
      dpSet['TemplatePreview.start'] = null
      return null
    }
  }
  _setRunning(fp) {
    const analyzed = path.parse(fp);
    this.running = {
      input: path.normalize(fp),
      ...analyzed,
      deploySet: site.find(dpSet => analyzed.dir.indexOf(path.sep + dpSet['label'] + path.sep) > 1)
    }
  }
  Asset(src, dest) {
    const p = fs.statSync(src)
    if (p.isDirectory()) {
      const subDir = fs.readdirSync(src, { withFileTypes: true })
      for (const dirent of subDir) {
        this.Asset(path.join(src, dirent.name), path.join(dest, dirent.name))
      }
    } else {
      if (src.match(/\/\./)) {
        console.log([`importThrow:: ${src}`])
        if (src.endsWith('.DS_Store')) fs.unlink(src, _e => { console.error([_e ? `ERR:notDeleted:: ${src}` : `Deleted:: ${src}`]) })
        return
      }
      const [parents, fileName] = path.extname(dest) ? [path.dirname(dest), ''] : [dest, path.basename(src)];
      fs.mkdirSync(parents, { recursive: true });
      fs.copyFileSync(src, path.join(dest, fileName))
    }
  }
  CJS(code) {
    const excjs = (dd => fs.existsSync(dd) ? require(`${process.cwd() + '/' + dd}`) : {})
      (this.running.input.replace(/\.ejs$/, '.cjs'))
    return [
      code.replace(
        /<ejs-template([^<>]*?)>([\s\S]*?)<\/ejs-template>/g,
        (_, attr, code) =>
          (runas =>
            (runas && excjs[runas]) ?
              excjs[runas]({ code: code.rmWhiteSpace().replace(/> </g, '><').split(/<hr[\s]+?type="template-slit"[^<>]*?>/), mod: { fs, csv: parse, worker: this.worker } }) : ''
          )(attr.json2JS().script)
      )
        .replace('((__directScripts__))', _ => interpretDirectScripts(excjs.DirectScripts || { Sync: undefined, Loaded: undefined, option: undefined }))
      ,
      excjs.practice
    ]
  }
  async Preview(code, { practice, testcase, styles }) {
    const cssList = (getProtoName(styles) === 'String' ? [styles] : styles).map(c => path.parse(c).name)
    const previewHtml =
      (code.split('\n').filter((l, i) => i < 9 && l.match(/^[\s]*?<html.*?>/i)).length) ?
        code :
        ejs.render(
          this.running.preview.basetmpl ? fs.readFileSync(this.running.preview.basetmpl).toString() : '<html><head></head><body>' + cssList.map(css => `<link rel="stylesheet" href="/${css}.css">`).join('') + code + '</body></html>',
          { cssList, code },
          { views: this._ejsOpViews(), rmWhitespace: this.running.whiteSpaceFilter }
        );

    this._output({
      method: 'Preview',
      name: 'index',
      dir: path.join('html', this.running.deploySet['label'], 'p'),
      ext: '.html',
      code: Filter.fook.preview({ code: previewHtml, practice, testcase }, 'all')
    })
  }
  previewServ(site = [], port = 1000) {
    if (!site.length) return

    for (const dpSet of site) {
      if (Object.getPrototypeOf(dpSet['TemplatePreview.start'] || false) === String.prototype) {
        const sv_ops = Object.assign(
          {
            // host: "localhost",
            watch: true,
            open: false,
            logLevel: "silent",
            server: `${process.cwd()}/html/${dpSet['label']}/`,
            port: port,
            reloadDelay: 500,
            ui: { port: port + 1 }
          }
        )
        bs.create().init(sv_ops)
        console.log({ [dpSet['label']]: `http://localhost:${sv_ops.port}/p/` })
        port += 1000
      } else {
        console.log({ [dpSet['label']]: 'no Pleview' })
      }
    }
  }
}

const { builder, previewServ, site, live, buildFile, source } = new ext();
export { site, live, previewServ, buildFile, source, builder }
export { bld, ext }