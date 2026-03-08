import { consoleCollor, dafaultCollor, getProtoName } from '../lib/filter.mjs'
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
import { parentPort, workerData } from 'node:worker_threads'

const require = createRequire(import.meta.url);
const interpretDirectScripts = ({ Sync, Loaded, option }) => {
  const Case = (s = []) => s.map(c => `(_=>{\n${(getProtoName(c) === 'String') ? fs.readFileSync(c) : c.toString().replace(/[^{}]+?{([\S\s]+)}$/, '$1')}\n})();`).join('')
  const r = Case(Sync) + Case(Loaded)
  return !option?.minify ? r.replace(/;/g, ';\n') : UglifyJS.minify(r).code
}
const { FILES, BLD, SET_NAME } = workerData

const Filter = new class FwFilter {
  preview = [this.practice, this.testcase]
  Hook = {
    preview: (data, methods = []) => {
      if (getProtoName(methods) === 'String') {
        (methods === 'all') ? this.preview.map(m => data.code = m(data)) : this.Hook.preview(data, [methods])
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

const EXTRACT = new class eXtracter {
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
      if (BLD.live && this.running.base.endsWith('.cjs')) {
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
      path.join(BLD.source, this.running.deploySet['label']),
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
    const siteReg = (root => path.normalize(path.join(root, dpSet['TemplatePreview.start'].replace(root, ''))))(path.join(BLD.source, dpSet['label']))
    try {
      fs.statSync(siteReg)
      return (prebuild =>
        (prebuild) ?
          {
            prebuild,
            target: (prebuild && BLD.live) ? input : prebuild,
            basetmpl: dpSet['TemplatePreview.baseTmpl'] ? path.normalize(dpSet['TemplatePreview.baseTmpl']) : '',
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
        log: [`[SKIP:Preview] TemplatePreview.start is invaild value. check build-tmpl.json`, _e]
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
      deploySet: BLD.site.find(dpSet => analyzed.dir.indexOf(path.join(path.sep, dpSet['label'], path.sep)) > 1)
    }
  }
  CJS(code) {
    const excjs = (dd => fs.existsSync(dd) ? require(path.join(process.cwd(), dd)) : {})(this.running.input.replace(/\.ejs$/, '.cjs'))
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
      code: Filter.Hook.preview({ code: previewHtml, practice, testcase }, 'all')
    })
  }
}

//  buildStat 
const statusLabel = consoleCollor(...(BLD.live ? [`[Updated] ${FILES} `, 5] : [`[BuildCompleted] ${SET_NAME} `, 7])) + dafaultCollor()
const buildStat = list => {
  try {
    list.forEach(f => EXTRACT.builder.fileBuild(f))
  } catch (_e) {
    (getProtoName(list) === 'String') ? buildStat([list]) : console.error(_e)
  }
}

console.time(statusLabel)
buildStat(FILES)
console.timeEnd(statusLabel)

parentPort.postMessage({
  live: BLD.live,
  site: BLD.site,
  SET_NAME,
  FILES
})
