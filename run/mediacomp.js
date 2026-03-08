import { messTitle, consoleCollor } from '../lib/filter.mjs'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { parseArgs } from 'node:util'

// 圧縮済みファイルを再圧縮してしまう問題

new class {
  constructor() {
    const files = fs.globSync(this._init('/*.+(png|jpg|jpeg)'), { ignore: ['/**/+(_**).*', '/**/*.*.*'] })
    for (let f of files) this.run({ input: path.normalize(f), ...path.parse(f) })
  }
  _setOps() {
    const o = parseArgs({
      options: {
        input: {
          short: 'i',
          type: 'string',
          // description: '変換したいファイルパスを指定します。--dirオプションが同時に指定されてる場合は--inputオプションが優先されます。',
          // example: "mediacomp -i {filepath}",
        },
        dir: {
          short: 'd',
          type: 'string',
          // default: '.'
          // description: 'ターゲットディレクトリ指定、ディレクトリ内のファイルを処理しサブフォルダは無視します。--inputオプションが同時に指定されてる場合は無視され--inputオプションが優先されます。',
          // example: "mediacomp -d {dirpath}",
        },
        sized: {
          short: 's',
          type: 'string',
          default: '3840,2880,1920,1600,1440,960,480,320'
          // description: '入力された画像の長辺解像度を参考に複数指定された解像度毎に縦横比を維持したまま各サイズへリサイズ＆圧縮します。入力解像度を超える変換は実行されません。変換後のファイルには指定サイズの数字がファイル名に付与されます',
          // example: "mediacomp -s 3840,2880,1920,1600,1440,960",
        },
        subname: {
          short: 'n',
          type: 'string',
          default: 'cmp'
          // description: 'サブ拡張子及びサブディレクトリの名前として使用されます。リサイズしない圧縮ファイルにのみ使用されます。デフォルト値: cmp',
          // example: "mediacomp -n cmp",
        },
        origin: {
          short: 'r',
          type: 'boolean',
          default: false
          // description: '--sizedオプションを無視し、リサイズしない圧縮ファイルにのみ出力します。デフォルト値: false',
          // example: "mediacomp -r",
        },
        override: {
          short: 'o',
          type: 'boolean',
          default: false
          // description: '出力先に同名ファイルがある場合に上書き保存する。デフォルト値: false',
          // example: "mediacomp -o",
        },
        subdir: {
          short: 'u',
          type: 'boolean',
          default: false
          // description: 'サブディレクトリを作成して出力します。サブディレクトリ名にはサイズ数値もしくは--subnameで指定された文字列が使用され、出力ファイル名には入力時のファイル名を改変せず使用されます。デフォルト値: false',
          // example: "mediacomp -u",
        },
        webp: {
          short: 'w',
          type: 'boolean',
          default: false
          // description: 'webpファイルでの圧縮を実行するか選択します。入力された画像形式と並行して圧縮され同じ場所へ出力されます。デフォルト値: false',
          // example: "mediacomp -w",
        }
      }
    }).values
    if (!(o.input || o.dir)) {
      throw consoleCollor('need Option, --input:-i or --dir:-d.', 4)
    }
    this.set = {
      input: o.input,
      dir: o.dir,
      subname: o.subname.replace(/[^a-zA-Z0-9]+/g, ''),
      sized: (o.sized || '').split(/[^0-9]+/g).map(a => parseInt(a)).exIntFilter(),
      origin: o.origin,
      override: o.override,
      subdir: o.subdir,
      webp: o.webp
    }
  }
  _init(glob_ptn = '', _eM) {
    try {
      _eM = '[option] Failure to initialise options.', this._setOps()
      _eM = '[option:-i] Failure to filePath.', this.set.input ? fs.readFileSync(this.set.input) : 0
    } catch (_e) {
      console.log(messTitle(_eM, 2), _e)
      process.exit(1)
    }
    return this.set.input || this.set.dir + glob_ptn
  }
  initDir(baseDir) {
    if (this.set.subdir && Array.isArray(this.set.sized)) {
      const sd = (this.set.origin) ? [this.set.subname] : this.set.sized
      for (const subname of sd) fs.mkdirSync(path.join(baseDir, subname.toString()), { recursive: true })
    }
  }
  fileOut(data, format, { input, ext, dir, base }, sized = '') {
    const [dp, dpWebp] = (_ => {
      const subName = sub => (sub = (sized || this.set.subname).toString(), (!this.set.subdir) || fs.mkdirSync(path.join(dir, sized, sub), { recursive: true }), sub)
      const dp = this.set.subdir ? path.join(dir, subName(), base) : input.replace(ext, `.${subName()}${ext}`)
      return [dp, dp.replace(ext, '.webp')]
    })()

    if (format === 'png' && (this.set.override || !fs.existsSync(dp))) sharp(data).png({ compressionLevel: 9, progressive: true }).toFile(dp)
    if (format === 'jpeg' && (this.set.override || !fs.existsSync(dp))) sharp(data).jpeg({ quality: 95, mozjpeg: true, progressive: true }).toFile(dp)
    if (this.set.webp && (this.set.override || !fs.existsSync(dpWebp))) sharp(data).webp({ quality: 85 }).toFile(dpWebp)
  }
  run(Running) {
    const sharpRunning = sharp(Running.input)
    if (!this.set.origin && Array.isArray(this.set.sized)) {
      sharpRunning.metadata().then(m => {
        for (const szd of this.set.sized) {
          if (szd <= m.width || szd <= m.height) {
            sharpRunning.rotate().resize(szd, szd, { fit: 'inside' }).toBuffer((_, d, { format }) => this.fileOut(d, format, Running, szd))
          }
        }
      })
    } else {
      sharpRunning.rotate().toBuffer((_e, d, { format }) => this.fileOut(d, format, Running))
    }
  }
}
