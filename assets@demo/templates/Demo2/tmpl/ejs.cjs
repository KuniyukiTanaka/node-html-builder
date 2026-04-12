'use strict'
const data = [
  {
    title: 'Builder Demo2 Template',
    text: 'This is a demo template for the Builder_Demo project.'
  },
  {
    title: 'ビルダーデモ：その２',
    text: 'デモテンプレートによる出力結果です。'
  }
]
module.exports = {
  practice: 'assets@demo/db/prictice.json',
  DemoScript({ code, mod: { worker } }) {
    const [template] = code
    let r = ''
    for (const { title, text } of data) {
      r += worker.TemplateHook(template, { title, text })
    }
    return r
  }
}