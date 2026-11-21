// @ts-nocheck
/* Company report as a PDF, laid out with @react-pdf/renderer (MIT): flexbox boxes, automatic page breaks,
   table headers repeated on every page a table spans, rows never split, headings kept with their first rows. */
import { Document, Page, View, Text, Image, Font, StyleSheet, Link } from '@react-pdf/renderer'
import g400 from '@fontsource/geist/files/geist-latin-400-normal.woff?url'
import g500 from '@fontsource/geist/files/geist-latin-500-normal.woff?url'
import g600 from '@fontsource/geist/files/geist-latin-600-normal.woff?url'
import g700 from '@fontsource/geist/files/geist-latin-700-normal.woff?url'
import m400 from '@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff?url'

Font.register({ family: 'Geist', fonts: [{ src: g400, fontWeight: 400 }, { src: g500, fontWeight: 500 }, { src: g600, fontWeight: 600 }, { src: g700, fontWeight: 700 }] })
Font.register({ family: 'GeistMono', src: m400 })
Font.registerHyphenationCallback((w) => [w]) // no automatic hyphenation: names and addresses wrap whole

const BLUE = '#245091', INK = '#0f172a', MUTED = '#64748b', LINE = '#e2e8f0', SOFT = '#f1f5f9'
const TONE = { ok: '#166534', warn: '#b45309', bad: '#b91c1c', grey: '#475569', '': '#475569' }
const s = StyleSheet.create({
  page: { fontFamily: 'Geist', fontSize: 9, color: INK, paddingTop: 54, paddingBottom: 50, paddingHorizontal: 40 },
  runHead: { fontFamily: 'Geist', position: 'absolute', top: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.6, borderBottomColor: LINE, paddingBottom: 6, fontSize: 7.5, color: MUTED },
  foot: { fontFamily: 'Geist', position: 'absolute', bottom: 22, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: MUTED, borderTopWidth: 0.6, borderTopColor: LINE, paddingTop: 6 },
  coverTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  h1: { fontSize: 20, fontWeight: 700, letterSpacing: -0.4 },
  meta: { fontSize: 9.5, color: MUTED, marginTop: 4 },
  cover: { fontSize: 30, fontWeight: 700, letterSpacing: -0.8 },
  toc: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 0.6, borderBottomColor: LINE },
  figs: { flexDirection: 'row', marginTop: 0, marginBottom: 4, borderWidth: 0.6, borderColor: LINE, borderRadius: 4 },
  fig: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, borderRightWidth: 0.6, borderRightColor: LINE },
  figV: { fontSize: 15, fontWeight: 600, letterSpacing: -0.3 },
  figL: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  sec: { marginTop: 18 },
  secHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderBottomWidth: 1.2, borderBottomColor: BLUE, paddingBottom: 3, marginBottom: 6 },
  secT: { fontSize: 11.5, fontWeight: 600, color: BLUE },
  secD: { fontSize: 8, color: MUTED },
  kv: { flexDirection: 'row', paddingVertical: 3.2, borderBottomWidth: 0.5, borderBottomColor: SOFT },
  k: { width: 130, color: MUTED },
  v: { flex: 1 },
  th: { flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: '#cbd5e1', paddingBottom: 3, marginBottom: 1, fontSize: 7.5, color: MUTED, fontWeight: 500 },
  tr: { flexDirection: 'row', paddingVertical: 3.6, borderBottomWidth: 0.5, borderBottomColor: SOFT },
  sub: { fontSize: 7.8, color: MUTED, marginTop: 1 },
  none: { color: MUTED, paddingVertical: 4 },
  a: { color: BLUE, textDecoration: 'none' },
  mono: { fontFamily: 'GeistMono', fontSize: 7.8 },
})

/* A section: the heading's `id` (not the section's: a section split over pages would point at its last page) is the target of the contents links, `bookmark` puts it in the viewer's outline, and the title's
   render callback records the page it lands on (pass one) so the contents page can print it (pass two). */
const Sec = ({ id, title, desc, children, first, pages }) => <View bookmark={{ title, fit: true }} style={[s.sec, first ? { marginTop: 4 } : null]}>
  <View id={id} style={s.secHead} minPresenceAhead={40} wrap={false}><Text style={s.secT} render={({ pageNumber }) => { if (pages) pages[id] = pageNumber; return title }} />{desc ? <Text style={s.secD}>{desc}</Text> : null}</View>
  {children}
</View>
const KV = ({ k, children }) => (children ? <View style={s.kv} wrap={false}><Text style={s.k}>{k}</Text><View style={s.v}>{typeof children === 'string' ? <Text>{children}</Text> : children}</View></View> : null)
/* No lineHeight anywhere: react-pdf 4.9 re-resolves inherited lineHeight each time it re-lays a page out, so on long
   reports it compounds (on Lloyds it reached 16 million pt and crashed the render). Geist's own metrics give ~1.3. */
/* A table: the header row is `fixed`, so it repeats at the top of every page the table runs onto. */
function Table({ cols, rows, empty }) {
  if (!rows.length) return <Text style={s.none}>{empty}</Text>
  return <View>
    <View style={s.th} fixed>{cols.map((c) => <Text key={c.h} style={{ width: c.w, flex: c.w ? undefined : 1, textAlign: c.right ? 'right' : 'left', paddingRight: 6 }}>{c.h}</Text>)}</View>
    {rows.map((r, i) => <View key={i} style={s.tr} wrap={false}>{cols.map((c) => <View key={c.h} style={{ width: c.w, flex: c.w ? undefined : 1, paddingRight: 6, alignItems: c.right ? 'flex-end' : 'flex-start' }}>{c.cell(r)}</View>)}</View>)}
  </View>
}
const T = ({ children, style }: any) => <Text style={style}>{children || ''}</Text>
const Two = ({ a, b }) => <View><Text>{a}</Text>{b ? <Text style={s.sub}>{b}</Text> : null}</View>

export function changesOf(vm) {
  const ev = []
  for (const o of vm.officers.all || []) {
    if (o.appointedIso) ev.push({ kind: 'Appointed', iso: o.appointedIso, date: o.appointed, o })
    if (o.resignedIso) ev.push({ kind: 'Resigned', iso: o.resignedIso, date: o.resigned, o })
  }
  return ev.sort((a, b) => b.iso.localeCompare(a.iso))
}
const tenure = (a, b) => { const m = Math.round((new Date(b) - new Date(a)) / 2629800000); return m < 1 ? '<1m' : m < 12 ? m + 'm' : Math.floor(m / 12) + 'y' + (m % 12 ? ' ' + (m % 12) + 'm' : '') }

export function ReportDoc({ vm, nation, logo, generated, base, pages, toc }) {
  const of = vm.officers, own = vm.ownership, chg = vm.charges, fl = vm.filings
  const st = vm.status, stColour = TONE[st.tone] || TONE.grey
  const changes = changesOf(vm)
  const today = new Date().toISOString().slice(0, 10)
  const flags = (vm.flags || []).map((f) => f.label).join(' · ')
  const site = base || ''
  const zuli = (h) => site + h
  const secs = [
    { id: 'overview', title: 'Overview', sub: [vm.type.label, vm.createdText ? 'incorporated ' + vm.createdText : ''].filter(Boolean).join(' · ') },
    { id: 'officers', title: 'Current officers', sub: `${of.counts.active} active · ${of.counts.resigned} resigned` },
    { id: 'ownership', title: 'Ownership', sub: own.current.length ? `${own.current.length} current PSC${own.current.length === 1 ? '' : 's'}` : 'No PSCs on record' },
    { id: 'charges', title: 'Charges', sub: chg.available && chg.total ? `${chg.outstanding} outstanding of ${chg.total}` : 'None registered' },
    { id: 'filings', title: 'Recent filings', sub: fl.total ? `Latest ${Math.min(fl.items.length, fl.total)} of ${fl.total.toLocaleString('en-GB')}` : 'None' },
    { id: 'changes', title: 'Officer changes', sub: changes.length ? `${changes.length} events` : 'None' },
  ]
  const foot = <View style={s.foot} fixed><Text>Zuli company report · generated {generated}</Text><Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} /></View>
  return <Document title={vm.name + ' – company report'} author="Zuli" subject={'Company ' + vm.number} creator="Zuli" producer="Zuli" pageMode="useOutlines">
    {/* Cover */}
    <Page size="A4" style={[s.page, { paddingTop: 56 }]} bookmark={{ title: 'Cover', fit: true }}>
      <Image src={logo} style={{ height: 22, width: 66 }} />
      <View style={{ flexGrow: 1, justifyContent: 'center' }}>
        <Text style={{ fontSize: 9, color: MUTED, letterSpacing: 1.2, marginBottom: 10 }}>COMPANY REPORT</Text>
        <Link src={zuli('#/company/' + vm.number)} style={{ color: INK, textDecoration: 'none' }}><Text style={s.cover}>{vm.name}</Text></Link>
        <Text style={{ marginTop: 14, fontSize: 11, color: MUTED }}><Text style={{ color: stColour, fontWeight: 700 }}>{st.label}{st.detail ? ' – ' + st.detail : ''}</Text>{'   ·   '}Company no. {vm.number}</Text>
        <View style={{ width: 56, height: 3, backgroundColor: BLUE, marginTop: 26 }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.6, borderTopColor: LINE, paddingTop: 8, fontSize: 8.5, color: MUTED }}>
        <Text>Generated {generated}</Text><Link src={zuli('#/company/' + vm.number)} style={{ color: MUTED, textDecoration: 'none' }}>View on Zuli</Link>
      </View>
    </Page>

    {/* Contents: every row is an internal link; page numbers come from the first render pass. */}
    <Page size="A4" style={s.page} id="contents" bookmark={{ title: 'Contents', fit: true }}>
      {foot}
      <Text style={[s.h1, { marginTop: 6, marginBottom: 18 }]}>Contents</Text>
      {secs.map((x, i) => <Link key={x.id} src={'#' + x.id} style={{ color: INK, textDecoration: 'none' }}>
        <View style={s.toc} wrap={false}>
          <Text style={{ width: 22, color: MUTED }}>{i + 1}</Text>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 11.5, fontWeight: 600, color: BLUE }}>{x.title}</Text><Text style={s.sub}>{x.sub}</Text></View>
          <Text style={{ fontSize: 11.5, fontWeight: 600 }}>{toc && toc[x.id] ? toc[x.id] : ''}</Text>
        </View>
      </Link>)}
      <Text style={[s.sub, { marginTop: 14 }]}>Select a section to jump to it. Every page links back here from its header.</Text>
    </Page>

    {/* Body */}
    <Page size="A4" style={s.page}>
      <View style={s.runHead} fixed><Text>{vm.name} · No. {vm.number}</Text><Link src="#contents" style={{ color: BLUE, textDecoration: 'none' }}>Back to contents</Link></View>
      {foot}
      <View style={s.figs} wrap={false}>
        {[[vm.ageYears != null ? vm.ageYears + (vm.ageYears === 1 ? ' year' : ' years') : '–', 'Age'], [String(of.counts.active), of.counts.active === 1 ? 'Active officer' : 'Active officers'], [String(own.current.length), own.current.length === 1 ? 'Current PSC' : 'Current PSCs'], [chg.available && chg.total ? chg.outstanding + ' of ' + chg.total : '0', 'Charges outstanding'], [fl.total ? fl.total.toLocaleString('en-GB') : '0', 'Filings on record']].map(([v, l], i, a) => <View key={l} style={[s.fig, i === a.length - 1 ? { borderRightWidth: 0 } : null]}><Text style={s.figV}>{v}</Text><Text style={s.figL}>{l}</Text></View>)}
      </View>

      <Sec id="overview" pages={pages} title="Overview" first>
        <KV k="Company number">{vm.number}</KV>
        <KV k="Status"><Text style={{ color: stColour, fontWeight: 700 }}>{st.label}{st.detail ? ' – ' + st.detail : ''}</Text></KV>
        <KV k="Company type">{vm.type.label}</KV>
        <KV k="Incorporated">{vm.createdText + (vm.ageYears != null ? ' (' + vm.ageYears + (vm.ageYears === 1 ? ' year' : ' years') + ')' : '')}</KV>
        {vm.ceasedText ? <KV k="Dissolved">{vm.ceasedText}</KV> : null}
        <KV k="Jurisdiction"><View style={{ flexDirection: 'row', alignItems: 'center' }}>{nation && nation.png ? <Image src={nation.png} style={{ width: 13, height: 9.75, marginRight: 5, borderWidth: 0.4, borderColor: LINE }} /> : null}<Text>{nation && nation.name ? nation.name + ' (registered in ' + vm.jurisdiction + ')' : (nation && nation.text) || vm.jurisdiction}</Text></View></KV>
        <KV k="Registered office">{vm.address.oneLine}</KV>
        <KV k="Nature of business">{vm.sic.length ? <View>{vm.sic.map((x) => <Text key={x.code}><Text style={s.mono}>{x.code}</Text>  {x.desc}</Text>)}</View> : 'None supplied'}</KV>
        {vm.previousNames.length ? <KV k="Previous names"><View>{vm.previousNames.map((p, i) => <Text key={i}>{p.name} <Text style={{ color: MUTED }}>({p.from} – {p.to})</Text></Text>)}</View></KV> : null}
        <KV k="Accounts">{vm.accounts.lastMadeUp ? `Last made up to ${vm.accounts.lastMadeUp}${vm.accounts.lastType ? ' (' + vm.accounts.lastType + ')' : ''}${vm.accounts.nextDue ? ' · next due ' + vm.accounts.nextDue : ''}` : vm.accounts.nextDue ? 'First accounts due ' + vm.accounts.nextDue : ''}</KV>
        <KV k="Confirmation statement">{vm.confirmation.nextDue ? `Next due ${vm.confirmation.nextDue}${vm.confirmation.last ? ' · last made up to ' + vm.confirmation.last : ''}` : ''}</KV>
        {flags ? <KV k="Notes"><Text style={{ color: TONE.warn, fontWeight: 600 }}>{flags}</Text></KV> : null}
      </Sec>

      <Sec id="officers" pages={pages} title="Current officers" desc={`${of.counts.active} active · ${of.counts.resigned} resigned`}>
        <Table empty="No current officers on record." rows={of.active} cols={[
          { h: 'Name', cell: (o) => <View>{o.officerId ? <Link src={zuli('#/person?id=' + encodeURIComponent(o.officerId))} style={s.a}>{o.name}</Link> : <Text>{o.name}</Text>}<Text style={s.sub}>{[o.occupation, o.address].filter(Boolean).join(' · ')}</Text></View> },
          { h: 'Role', w: 70, cell: (o) => <T>{o.roleLabel}</T> },
          { h: 'Appointed', w: 72, cell: (o) => <Two a={o.appointed || o.appointedBefore} b={o.appointedIso ? tenure(o.appointedIso, today) : ''} /> },
          { h: 'Nationality', w: 78, cell: (o) => <Two a={o.nationality} b={o.residence} /> },
          { h: 'Born', w: 48, cell: (o) => <T>{o.born}</T> },
        ]} />
      </Sec>

      <Sec id="ownership" pages={pages} title="Ownership" desc={own.current.length ? `${own.current.length} current PSC${own.current.length === 1 ? '' : 's'}${own.counts.ceased ? ' · ' + own.counts.ceased + ' ceased' : ''}` : ''}>
        <Table empty={own.statements && own.statements.length ? own.statements.map((x) => x.plain || '').filter(Boolean).join(' ') || 'No persons with significant control on record.' : 'No persons with significant control on record.'} rows={own.current} cols={[
          { h: 'Person with significant control', cell: (p) => <Two a={p.ukCompany ? <Link src={zuli('#/company/' + p.ukCompany)} style={s.a}>{p.name}</Link> : p.name} b={[p.kindLabel, p.nationality, p.registration && p.registration.number ? 'Company no. ' + p.registration.number : ''].filter(Boolean).join(' · ')} /> },
          { h: 'Control', w: 190, cell: (p) => <Two a={p.summary ? p.summary.main : p.band} b={p.summary && p.summary.other} /> },
          { h: 'Notified', w: 62, cell: (p) => <T>{p.notified}</T> },
        ]} />
        {own.ceased.length ? <View style={{ marginTop: 6 }}><Text style={[s.sub, { marginBottom: 2 }]} minPresenceAhead={20}>Former PSCs</Text>{own.ceased.map((p, i) => <View key={i} style={s.tr} wrap={false}><Text style={{ flex: 1 }}>{p.name}</Text><Text style={{ width: 150, color: MUTED }}>{p.notified} – {p.ceased}</Text></View>)}</View> : null}
      </Sec>

      <Sec id="charges" pages={pages} title="Charges" desc={chg.available && chg.total ? `${chg.outstanding} outstanding · ${chg.satisfied} satisfied · ${chg.total} total` : ''}>
        <Table empty="No charges registered against this company." rows={chg.available ? chg.items : []} cols={[
          { h: 'Created', w: 64, cell: (c) => <T>{c.created}</T> },
          { h: 'Status', w: 74, cell: (c) => <Text style={{ fontWeight: 600, color: c.outstanding ? TONE.warn : MUTED }}>{c.statusLabel}{c.satisfied ? '\n' : ''}{c.satisfied ? <Text style={{ fontWeight: 400, fontSize: 7.8 }}>{c.satisfied}</Text> : null}</Text> },
          { h: 'Persons entitled', w: 160, cell: (c) => <T>{(c.entitled || []).join(', ') + (c.moreEntitled ? ' and others' : '')}</T> },
          { h: 'Details', cell: (c) => <Two a={[c.features && c.features.join(', '), c.coversAll ? 'Covers all property' : ''].filter(Boolean).join(' · ') || c.title} b={c.description && c.description !== 'N/A.' ? c.description.slice(0, 220) + (c.description.length > 220 ? '…' : '') : ''} /> },
        ]} />
        {chg.available && chg.loaded < chg.total ? <Text style={s.sub}>Showing {chg.loaded} of {chg.total} charges.</Text> : null}
      </Sec>

      <Sec id="filings" pages={pages} title="Recent filings" desc={fl.total ? `Latest ${Math.min(fl.items.length, fl.total)} of ${fl.total.toLocaleString('en-GB')}` : ''}>
        <Table empty="No filings on record." rows={fl.items} cols={[
          { h: 'Date', w: 64, cell: (f) => <T>{f.date}</T> },
          { h: 'Type', w: 60, cell: (f) => <Text style={[s.mono, { fontSize: 7 }]}>{f.typeCode}</Text> },
          { h: 'Description', cell: (f) => f.viewUrl ? <Link src={f.viewUrl} style={s.a}>{f.title}</Link> : <T>{f.title}</T> },
          { h: 'Pages', w: 34, right: true, cell: (f) => <Text style={{ color: MUTED }}>{f.pages || ''}</Text> },
        ]} />
      </Sec>

      <Sec id="changes" pages={pages} title="Officer changes" desc={changes.length ? `${changes.length} appointment and resignation events` : ''}>
        <Table empty="No dated officer changes on record." rows={changes} cols={[
          { h: 'Date', w: 64, cell: (e) => <T>{e.date}</T> },
          { h: 'Change', w: 70, cell: (e) => <Text style={{ fontWeight: 700, fontSize: 7.6, letterSpacing: 0.3, color: e.kind === 'Appointed' ? TONE.ok : MUTED }}>{e.kind.toUpperCase()}</Text> },
          { h: 'Officer', cell: (e) => e.o.officerId ? <Link src={zuli('#/person?id=' + encodeURIComponent(e.o.officerId))} style={s.a}>{e.o.name}</Link> : <T>{e.o.name}</T> },
          { h: 'Role', w: 96, cell: (e) => <T>{e.o.roleLabel}</T> },
          { h: 'Tenure', w: 50, right: true, cell: (e) => <Text style={{ color: MUTED }}>{e.kind === 'Resigned' && e.o.appointedIso ? tenure(e.o.appointedIso, e.o.resignedIso) : ''}</Text> },
        ]} />
      </Sec>
    </Page>
  </Document>
}
