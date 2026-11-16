// The /pson/zuli data layer, reused unchanged: Companies House normalisation, enumerations and the history engine.
// normalise.js and charts.js are UMD-style (module.exports when bundled, window otherwise); enums.js sets window.CH_ENUMS.
import '../legacy/enums.js'
import * as Nm from '../legacy/normalise.js'
import * as Cm from '../legacy/charts.js'
const w = window as any
const pick = (m: any, g: string) => (m && m.default && typeof m.default === 'object' ? m.default : m && Object.keys(m).length > 2 ? m : w[g])
export const N: any = pick(Nm, 'Normalise')
export const E: any = w.CH_ENUMS || {}
export const Charts: any = pick(Cm, 'ProsperCharts')
N.setEnums(E)
