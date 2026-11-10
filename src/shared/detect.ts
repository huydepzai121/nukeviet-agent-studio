export interface DetectSignals {
  srcLayout: boolean
  rootLayout: boolean
  adminVi: number
  viPhp: number
  smarty: number
  xtemplate: number
  hasVendorVinades: boolean
}

export interface DetectResult {
  version: '4.x' | '5.x' | 'unknown'
  notes: string[]
  score: { v4: number; v5: number }
}

export function emptySignals(): DetectSignals {
  return {
    srcLayout: false,
    rootLayout: false,
    adminVi: 0,
    viPhp: 0,
    smarty: 0,
    xtemplate: 0,
    hasVendorVinades: false,
  }
}

/** NukeViet 5.x lives under src/ with Smarty and a single vi.php. 4.x uses XTemplate and admin_vi.php. */
export function scoreNukeViet(signals: DetectSignals): DetectResult {
  let v5 = 0
  let v4 = 0
  const notes: string[] = []
  if (signals.srcLayout) {
    v5 += 3
    notes.push('src/')
  }
  if (signals.rootLayout && !signals.srcLayout) {
    v4 += 3
    notes.push('modules/ at root')
  } else if (signals.rootLayout) {
    v4 += 1
  }
  if (signals.adminVi > 0) {
    v4 += 3
    notes.push('admin_vi.php')
  }
  if (signals.viPhp > 0 && signals.adminVi === 0) {
    v5 += 3
    notes.push('vi.php only')
  }
  if (signals.smarty > 0) {
    v5 += 2
    notes.push('Smarty')
  }
  if (signals.xtemplate > 0) {
    v4 += 2
    notes.push('XTemplate')
  }
  if (signals.hasVendorVinades) {
    v5 += 1
    notes.push('vinades')
  }

  let version: DetectResult['version'] = 'unknown'
  if (v5 === 0 && v4 === 0) version = 'unknown'
  else if (v5 > v4 && v5 >= 3) version = '5.x'
  else if (v4 > v5 && v4 >= 3) version = '4.x'
  else if (v5 >= 3 && v5 === v4) version = signals.srcLayout ? '5.x' : '4.x'
  else if (v5 > v4) version = v5 >= 3 ? '5.x' : 'unknown'
  else if (v4 > v5) version = v4 >= 3 ? '4.x' : 'unknown'
  return { version, notes, score: { v4, v5 } }
}
