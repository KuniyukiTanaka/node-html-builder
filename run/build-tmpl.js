'use strict'
const { messCollor, messReset, getPrototypeName, addProtoType } = require('../lib/filter')
const { pathToFileURL } = require('url')
const fs = require('fs')
const path = require('path')
const ejs = require('ejs')
const csv = require('csv-parse/sync')
const makeDir = require('make-dir')
const UglifyJS = require("uglify-js")
const cms = new (require('./cms'))
const __Base__ = cms.options()

const repDS = ({ Sync, Loaded, option }) => {
  const scripts = { Sync, Loaded }
  const Case = (s = []) => s.map(c => `(_=>{\n${(getPrototypeName(c) === 'String') ? fs.readFileSync(c) : c.toString().replace(/[^{}]+?{([\S\s]+)}$/, '$1')}\n})();`).join('')
  let r = ''
  for (const s in scripts) {
    r += (s === 'Loaded') ? `window.addEventListener('DOMContentLoaded', _=> {${Case(scripts[s])}});` : Case(scripts[s])
  }
  return !option?.minify ? r.replace(/;/g, ';\n') : UglifyJS.minify(r).code
}

addProtoType({
  array: {
    LocationFilter(r) {
      for (const { from, to } of (this || []).filter(({ name }) => name ? 1 : 0)) {
        r = r.replace(RegExp(from, 'g'), to)
      }
      return r
    }
  },
  string: {
    repExTemplate(data) {
      const regex = /\[\[__([\w_-]+)__\]\]/g
      return (getPrototypeName(data) === 'Object') ? this.replace(regex, (_, word) => data[word]) : this
    },
    repEJSex(f) {
      return (ejs2 => [
        this.replace(
          /<ejs-template([^<>]*?)>([\s\S]*?)<\/ejs-template>/g,
          (_, attr, code) =>
            (runas =>
              (runas && ejs2[runas]) ?
                ejs2[runas]({ code: code.rmWspace().replace(/> </g, '><').split(/<hr[\s]+?type="template-slit"[^<>]*?>/), mod: { fs, csv } }) : ''
            )(attr.AttrJSON().script)
        )
          .replace('((__directScripts__))', _ => repDS(ejs2.__directScripts__))
        ,
        ejs2.__dataModel__
      ])(fs.existsSync(f + '.js') ? require(`${process.cwd()}/${f}.js`) : {})
    },
    xPreviewFilter({ testCase, dataModel }) {
      return testCase.LocationFilter(this)
        .replace('</head>', `<script name="__dataModel__">__platform__=${JSON.stringify(dataModel)}</script></head>`)
        .replace(/<\{\*.+?\*\}>/g, '')
    },
    SmartyFilter() {
      return this
      // .replace(/<\/\{.*?>/g, '')
      // .replace(/<\{ \//g, '<{/')
    },
    xEJSFilter(f) {
      return this.SmartyFilter().repEJSex(f)
    }
  },
})

const compiler = class {
  constructor(_th, live) {
    (_m => (_m[_th.ext] && _th.cms) ? _m[_th.ext]() : null)({
      '.html': this.xThrow,
      '.ejs': this.xEJS,
      '.scss': this.xCSS,
      '.js': this.xEJSjs,
      'out': this.outputFile,
      'pvTmpl': this.xPreview,
      'resetEJSFile': this.resetFile,
      '_err': this._error,
      _th,
      live
    })
  }
  _error({ method, log }) {
    console.log((l => [l, `ERR:${method}()`, l].join('\n'))('='.repeat(80)))
    console.error({ input: this._th, log })
  }
  resetFile(input) {
    const r = { input, ...path.parse(input) }
    r.cms = this._th.cms
    if (r.cms) {
      r.rmWhitespace = !!cms.validCMS[r.cms].rmWhitespace
      r.preview = cms.validCMS[r.cms].TemplatePreview || {}
      r.preview.file = (cms.validCMS[r.cms].TemplatePreview && this.live) ? r.input : r.preview.prePreview
    }
    this._th = r
  }
  adjustEJS() {
    this._th = JSON.parse(JSON.stringify(this._th).replace(/.ejs|.js/g, ''))
    this._th.input += '.ejs'
    this._th.base += '.ejs'
    this._th.ext += '.ejs'
  }
  outputFile(o) {
    const { input, name, cms, dir, ext, code, pvName } = { ...this._th, ...o }
    makeDir.sync(dir)
    fs[(ext === '.css') ? 'writeFileSync' : 'writeFile'](path.format({ dir, name, ext }), code, _ => null)
    if (pvName && pvName === input && ext === '.html') this.pvTmpl(code)
  }
  xPreview(code) {
    const { name, cms, rmWhitespace, preview: { platformBase, styles } } = this._th
    const styleNames = (styles || []).map(c => path.parse(c).name).concat(name)
    const pvContent =
      (code.split('\n').filter((l, i) => i < 9 && l.match(/^[\s]*?<html.*?>/i)).length) ?
        code :
        ejs.render(
          platformBase ?
            fs.readFileSync(platformBase).toString() :
            '<html><head></head><body>' + styleNames.map(css => `<link rel="stylesheet" href="/${css}.css">`).join('') + code + '</body></html>',
          {
            styleNames,
            code
          },
          { views: [path.join(__Base__.tmplDir, this._th.cms), ''], rmWhitespace }
        );
    this.out({
      name: 'index',
      cms: path.join(cms, 'p'),
      dir: path.join('html', cms, 'p'),
      ext: '.html',
      code: pvContent.xPreviewFilter(this._th.preview)
    })
  }
  xAsset(src, dest) {
    fs.stat(src, (_e, p) => {
      if (_e) return
      if (p.isDirectory()) {
        fs.readdir(src, { withFileTypes: true }, (_e, subDir) => {
          for (const dirent of subDir) this.xAsset(path.join(src, dirent.name), path.join(dest, dirent.name))
        })
      } else {
        if (src.match(/\/\./)) {
          console.log([`importThrow:: ${src}`])
          if(src.match(/.DS_Store$/)) fs.unlink(src, _e => {console.log([_e ? `[_err] notDeleted:: ${src}` : `Deleted:: ${src}`])})
          return
        }
        (([parents, fileName]) => {
          fs.mkdir(parents, { recursive: true }, _e => {
            fs.copyFile(src, path.join(dest, fileName), _e => _e ? console.error(_e) : null)
          })
        })(path.extname(dest) ? [path.dirname(dest), ''] : [dest, path.basename(src)])
      }
    })
  }
  xThrow() {
    const { preview, input, cms, ext } = this._th
    try {
      this.out({
        dir: path.join('html', cms),
        code: fs.readFileSync(input).toString(),
        pvName: preview.file
      })
    } catch (_e) {
      this._err({ method: this[ext].name, log: _e })
    }
  }
  xEJS() {
    const { preview, input, cms, dir, ext, rmWhitespace } = this._th
    let code
    try {
      [code, preview.dataModel] = ejs.render(
        fs.readFileSync(input).toString(), {}, { views: [path.join(__Base__.tmplDir, cms), dir, ''], rmWhitespace }
      ).xEJSFilter(input)
      this.out({
        dir: path.join('html', cms),
        ext: '.html',
        code,
        pvName: preview.file
      })
    } catch (_e) {
      this._err({ method: this[ext].name, log: _e })
      process.exit(0)
    }
  }
  xEJSjs() {
    if (this.live && this._th.base.match(/.ejs.js$/)) {
      this.resetEJSFile(this._th.input.replace(/.js$/, ''))
      this['.ejs']()
    }
  }
  xCSS() {
    const { input, cms, ext, rmWhitespace } = this._th
    const root_tag = 'pj-root::'
    try {
      (({ postcss, cssGap, cssMinify, autoprefixer, sass }) => {
        const pligins = [autoprefixer({ remove: false }), cssGap, cssMinify].filter(p => !!p)
        this.out({
          dir: path.join('html', cms),
          ext: '.css',
          code: postcss(pligins).process(sass).css.replace('@charset "UTF-8";', '').trim()
        })
      })({
        postcss: require('postcss'),
        cssGap: require('postcss-gap-properties'),
        cssMinify: rmWhitespace ? require('postcss-minify') : null,
        autoprefixer: require('autoprefixer'),
        sass: require('sass').compile(input, {
          importers: [{
            findFileUrl: (url) => (url.startsWith(root_tag)) ? new URL(pathToFileURL(url.substring(root_tag.length))) : null
          }]
        }).css
      })
    } catch (_e) {
      this._err({ method: this[ext].name, log: _e })
      process.exit(0)
    }

  }
}

new class {
  constructor() {
    const label = (this.live = !!__Base__.file, messCollor(...(this.live ? ['Updated', 5] : ['Completed', 7])))
    console.time(label)
    this.run(
      __Base__.file || this.globRunner({
        match: [__Base__.tmplDir + `/**/*.*`, __Base__.styleDir + `/**/*.*`],
        ignore: [`**/_**/**`, `**/etc/**`]
      })
    )
    this.live || this.assetImport()
    console.timeEnd(label)
    __Base__.file || console.log(messReset())
  }
  _fileInit(f) {
    try {
      this.running = this.setRunning({ input: path.normalize(f), ...path.parse(f) })
    } catch (_e) {
      console.error({ method: 'fileInit', input: f, _e })
      process.exit(0)
    }
    return this.running
  }
  globRunner(g = false) {
    if (getPrototypeName(g) === 'Object') {
      const { match, ignore } = g
      return require('glob').globSync(match, { ignore: cms.ignoreCMS(ignore) }).sort(f => f.indexOf('.scss') ? -1 : 1)
    }
    return false
  }
  run(m) {
    try {
      m.forEach(f => this.compile(f))
    } catch (_e) {
      (getPrototypeName(m) === 'String') ? this.run([m]) : console.error(_e)
    }
  }
  setRunning(set) {
    set.cms = (set.dir.match(Object.keys(cms.validCMS).join('|')) || [undefined])[0]
    if (set.cms) {
      set.rmWhitespace = !!cms.validCMS[set.cms].rmWhitespace
      set.preview = cms.validCMS[set.cms].TemplatePreview || {}
      set.preview.file = (cms.validCMS[set.cms].TemplatePreview && this.live) ? set.input : set.preview.prePreview
    }
    return set
  }
  assetImport() {
    try {
      (vCms => {
        for (const n in vCms) {
          if (getPrototypeName(vCms[n].import) === 'Object') {
            for (const [dp, e] of Object.entries(vCms[n].import)) {
              for (const src of e.split('|')) {
                this.cmp.xAsset(path.normalize(src), path.join('html', n, dp))
              }
            }
          }
        }
      })(cms.validCMS)
    } catch (_e) {
      console.error({ method: 'assetImport', mess: '[Skip:ImportAssets]invalid importFile Settings,Check build-tmpl.json', _e })
    }
  }
  compile(f) {
    this._fileInit(f)
    this.cmp = new compiler(this.running, this.live)
  }
}