import { consoleCollor, dafaultCollor, getProtoName } from '../lib/filter.mjs'
import { site, live, source, buildFile, builder, previewServ } from '../lib/builder.mjs';
import fs from 'fs'
import path from 'path'

const label = consoleCollor(...(live ? ['Updated', 5] : ['Completed', 7]))
const buildRun = (list) => {
  try {
    list.forEach(f => builder.fileBuild(f))
  } catch (_e) {
    (getProtoName(list) === 'String') ? buildRun([list]) : console.error(_e)
  }
}
const buildList = (...excList) => {
  return fs.globSync(
    site.map(dpSet => path.join(source, dpSet['label'], '+(tmpl|scss)/**/*.*')),
    { exclude: getProtoName(excList[0]) === 'Array' ? excList[0] : excList }
  ).sort(f => path.extname(f) === '.scss' ? -1 : 1)
}

console.time(label)
buildRun(buildFile || buildList(`**/_**/**`, `**/etc/**`))
console.timeEnd(label)

live || (
  builder.Import(),
  console.log(dafaultCollor()),
  previewServ(site)
)
