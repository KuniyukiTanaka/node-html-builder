const Clr = [
  '\u001b[0m',  // reset
  '\u001b[30m', // black
  '\u001b[31m', // red
  '\u001b[32m', // green
  '\u001b[33m', // yellow
  '\u001b[34m', // blue
  '\u001b[35m', // magenta
  '\u001b[36m', // cyan
  '\u001b[37m', // white
]
const Deli = '-'.repeat(80)
const Tools = {
  messTitle: (r, v = 0) => [Clr[v] + Deli, '[err]' + r, Deli + Clr[0], ''].join('\n'),
  messCollor: (r, v = 0, rs = 0) => Clr[v] + r + (rs ? Tools.messReset() : ''),
  messReset: _ => Clr[0],
  addProtoType: (prt = {}) => {
    String.prototype.__proto__ = { ...String.prototype.__proto__, ...prt.string }
    Array.prototype.__proto__ = { ...Array.prototype.__proto__, ...prt.array }
  },
  getPrototypeName: (data) => data ? Object.getPrototypeOf(data).constructor.name : ''
}
String.prototype.__proto__ = {
  rmWspace() {
    return this
      .replace(/\s{2}/g, ' ')
      .replace(/[\n|\r|\n\r]/g, ' ')
      .trim()
  },
  KANAzenFilter() {
    const r = str => {
      var kanaMap = { 'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ', 'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ', 'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド', 'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ', 'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ', 'ｳﾞ': 'ヴ', 'ﾜﾞ': 'ヷ', 'ｦﾞ': 'ヺ', 'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ', 'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ', 'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ', 'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト', 'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ', 'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ', 'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ', 'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ', 'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ', 'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン', 'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ', 'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', '｡': '。', '､': '、', 'ｰ': 'ー', '｢': '「', '｣': '」', '･': '・' }
      var reg = new RegExp('(' + Object.keys(kanaMap).join('|') + ')', 'g');
      return str.replace(reg, match => kanaMap[match]).replace(/ﾞ/g, '゛').replace(/ﾟ/g, '゜');
    }
    return r(this)
  },
  AttrJSON() {
    const jsontx = ('{' + this.trim().replace(/['|"]/g, '').replace(/([\w\-_]+)/g, '"$1"') + '}')
      .replace(/\s/g, ',')
      .replace(/=/g, ':')
    return JSON.parse(jsontx)
  }
}

Array.prototype.__proto__ = {
  extInt() {
    return this.filter(v => typeof v === 'number' && v && v % 1 === 0)
  },
  assignByType() {
    let r = {}
    for (const d of this) {
      r[Tools.getPrototypeName(d)] = d
    }
    return r
  }
}

export default { ...Tools }
export const { messCollor, messReset, messTitle, addProtoType, getPrototypeName } = Tools

