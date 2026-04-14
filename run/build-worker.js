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
import { parentPort, workerData } from 'node:worker_threads'

const require = createRequire(import.meta.url);
const interpretDirectScripts = ({ Sync, Loaded, option }) => {
  const Case = (s = []) => s.map(c => `(_=>{\n${(getProtoName(c) === 'String') ? fs.readFileSync(c) : c.toString().replace(/[^{}]+?{([\S\s]+)}$/, '$1')}\n})();`).join('')
  const r = Case(Sync) + Case(Loaded)
  return !option?.minify ? r.replace(/;/g, ';\n') : UglifyJS.minify(r).code
}
const { FILES, BLD, SET_NAME } = workerData;
const _skip = ({ method, log }) => {
  console.error(
    consoleCollor((l => [l, `Skiped:${method}()`, l].join('\n'))('='.repeat(100)), 1) + dafaultCollor()
  )
}
const _cation = ({ method, log, data = undefined }) => {
  console.error(
    consoleCollor((l => [l, `Cation:${method}()`, l].join('\n'))('='.repeat(100)), 1) + dafaultCollor(),
    { data, log }
  )
}
const _error = ({ method, log, data = undefined }) => {
  console.error(
    consoleCollor((l => [l, `ERR:${method}()`, l].join('\n'))('='.repeat(100)), 2) + dafaultCollor(),
    { data, running: this.running, log }
  )
}

const Filter = new class PvFilter {
  preview = [this.practice, this.testcase, this.styles]
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
    try {
      for (const [from, to] of Object.entries(testcase)) {
        code = code.replace(RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to.toString())
      }
    } catch (_e) {
      _cation({
        data: {
          "TemplatePreview.testCase": testcase
        },
        method: 'PvFilter->testcase',
        log: [
          '[SKIP] 異常なtestcase設定値、処理はスルーされました。',
          '["TemplatePreview.testCase"]オプション は Object:{"from_1":"to_1","from_2":"to_2",...} の形で記述します。'
        ]
      })
    }
    return code
  }
  styles({ code, styles }) {
    try {
      const cssList = (getProtoName(styles) === 'String' ? [styles] : styles).map(c => path.parse(c).name)
      code = code.replace('</body>', _ => `${cssList.map(css => `<link rel="stylesheet" href="/${css}.css">`).join('')}</body>`)
    } catch (_e) {
      _cation({
        data: {
          "TemplatePreview.styles": styles
        },
        method: 'PvFilter->styles',
        log: [
          '[SKIP] 異常なstyles設定値、処理はスルーされました。',
          '["TemplatePreview.styles"]オプション は Array["String"] の形で記述します。'
        ]
      })
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
    EJS: ({ input, deploySet, deploySet: { whiteSpaceFilter }, name }) => {
      try {
        const [code, practice] = this._cjs(
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
    CSS: ({ input, deploySet, name, deploySet:{ whiteSpaceFilter} }) => {
      const root_tag = 'root@'
      try {
        (({ cssMinify, sass }) => {
          const postPlugins = [autoprefixer({ remove: false }), cssGap, cssMinify].filter(p => !!p)
          const { buildRoot, dir } = this.running
          this._output({
            method: 'CSS',
            name: (d => (d = d ? [...d.split(path.sep), name].join('--') : name))(path.relative(buildRoot + '/scss', dir)),
            dir: path.join('html', deploySet['label']),
            ext: '.css',
            code: postcss(postPlugins).process(sass).css.replace('@charset "UTF-8";', '').trim()
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
  _skip({ method, log }) {
    console.error(
      consoleCollor((l => [l, `Skiped:eXtracter.${method}()`, l].join('\n'))('='.repeat(100)), 1) + dafaultCollor()
    )
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
      if (pData && pData.target === this.running.input) this.genPreview(code, pData);
    } catch (_e) {
      this._error({ method: `_output[__${method}__]`, log: _e })
      process.exit(1)
    }
  }
  _setPreview(dpSet, input, practice) {
    const siteReg = TPs => (root => path.normalize(path.join(root, TPs.replace(root, ''))))(path.join(BLD.source, dpSet['label']))
    try {
      return (prebuild =>
        (prebuild) ?
          {
            prebuild,
            target: (prebuild && BLD.live) ? input : prebuild,
            tag: dpSet['TemplatePreview.targetTag'] ? path.normalize(dpSet['TemplatePreview.targetTag']) : 'TARGET',
            base: dpSet['TemplatePreview.baseTmpl'] ? path.normalize(dpSet['TemplatePreview.baseTmpl']) : '',
            styles: dpSet['TemplatePreview.styles'] || [],
            testcase: dpSet['TemplatePreview.testCase'] || [],
            mode: dpSet['TemplatePreview.mode'] || 0,
            practice: practice || null,
          } : null
      )(siteReg(dpSet['TemplatePreview.start']))
    } catch (_e) {
      if (dpSet['TemplatePreview.start']) {
        this._cation({
          method: '_setPreview',
          data: {
            start: dpSet['TemplatePreview.start'],
            siteReg: dpSet['TemplatePreview.start'] ? siteReg(dpSet['TemplatePreview.start']) : undefined
          },
          log: [`[SKIP:Preview] TemplatePreview.start is invaild value. check build-tmpl.jsonc`, _e]
        })
      }
      dpSet['TemplatePreview.start'] = null
      return null
    }
  }
  _managePreviewTemplate(base, code, tag, mode, conved = 0) {
    const dafaltTag = `[[__${tag}__]]`
    if (mode === 1) {
      const outputs = fs.globSync(`html/${this.running.deploySet.label}/*.html`)
      return fs.readFileSync(base).toString()
        .replace(/\[\[__([a-zA-Z0-9_-]+?)__]\]/g, (_, tagName) => {
          const i = outputs.map(fp => path.basename(fp, '.html')).indexOf(tagName)
          return (i + 1) ? fs.readFileSync(outputs[i]).toString() : ''
        })
    } else {
      return fs.readFileSync(base).toString().replace(/\[\[__[a-zA-Z0-9_-]+?__]\]/g,
        r => ((r !== dafaltTag && r.indexOf(this.running.name) > -1) ? (conved++, code) : r)
      ).replace(dafaltTag, r => (conved ? r : code))
    }
  }
  _setRunning(fp) {
    const analyzed = path.parse(fp);
    const pathFilter = analyzed => {
      const olgn = BLD.site.find(dpSet => analyzed.dir.indexOf(path.join(path.sep, dpSet['label'], path.sep)) > 1)
      if (olgn['TemplatePreview.start']) {
        olgn['TemplatePreview.start'] = path.normalize(olgn['TemplatePreview.start'])
      }
      return olgn
    }
    const deploySet = pathFilter(analyzed)
    this.running = {
      input: path.normalize(fp),
      ...analyzed,
      buildRoot: path.join(BLD.source, deploySet['label']),
      deploySet
    }
  }
  _cjs(code) {
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
  async genPreview(code, { prebuild, target, base, mode, tag, practice, testcase, styles }) {
    const previewHtml =
      (code.split('\n').filter((l, i) => i < 9 && l.match(/^[\s]*?<html.*?>/i)).length) ?
        code :
        ejs.render(
          base ? this._managePreviewTemplate(base, code, tag, mode) : `<html lang="${new Intl.DateTimeFormat().resolvedOptions().locale}"><head></head><body>${code}</body></html>`,
          { code },
          { views: this._ejsOpViews(), rmWhitespace: this.running.deploySet.whiteSpaceFilter }
        );

    this._output({
      method: 'genPreview',
      name: 'index',
      dir: path.join('html', this.running.deploySet['label'], 'p'),
      ext: '.html',
      code: Filter.Hook.preview({ code: previewHtml, practice, testcase, styles }, 'all')
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
