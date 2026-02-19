import React, { useCallback, useState, useEffect } from 'react'
import Papa from 'papaparse'
import useModelStore from '../store/useModelStore'

type Row = Record<string, any>

export default function DataPanel() {
  const uploadData = useModelStore((s) => s.uploadData)
  const setDatasetCleaned = useModelStore((s) => s.setDatasetCleaned)
  const cleanedFlag = useModelStore((s) => (s.dataset ? (s.dataset as any).cleaned : false))
  const [rows, setRows] = useState<Row[]>([])
  const [originalRows, setOriginalRows] = useState<Row[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [report, setReport] = useState<Record<string, any> | null>(null)
  const [encodedRows, setEncodedRows] = useState<Row[] | null>(null)
  const [showReport, setShowReport] = useState<boolean>(false)

  const parseFile = useCallback((file: File) => {
    setMessage('Parsing...')
    const reader = new FileReader()
    reader.onload = async () => {
      const text = String(reader.result ?? '')
      try {
        const resp = await fetch('http://localhost:5000/api/preprocess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvContent: text })
        })
        if (resp.ok) {
          const body = await resp.json()
          setReport(body.report ?? body)
        } else {
          const err = await resp.text()
          setMessage(`Preprocess error: ${err}`)
        }
      } catch (e: any) {
        setMessage(`Preprocess request failed: ${e?.message ?? e}`)
      }

      Papa.parse<Row>(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (res) => {
          setRows(res.data)
          setOriginalRows(res.data)
          setHeaders(res.meta.fields ?? [])
          setMessage(`Parsed ${res.data.length} rows`)
          // also upload original file to central store (marked not cleaned)
          uploadData(file, false)
          setDatasetCleaned(false)
        },
        error: (err) => {
          setMessage(String(err))
        }
      })
    }
    reader.onerror = () => setMessage('Failed to read file')
    reader.readAsText(file)
  }, [uploadData])

  const handleDrop: React.DragEventHandler = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) parseFile(f)
  }
  const handleDragOver: React.DragEventHandler = (e) => {
    e.preventDefault()
  }

  const handleInput: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0]
    if (f) parseFile(f)
  }

  function isNumericCol(col: string) {
    return rows.some(r => typeof r[col] === 'number')
  }

  function normalizeZScore() {
    if (!rows.length) return
    const cols = headers.filter(isNumericCol)
    const stats: Record<string, {mean:number, sd:number}> = {}
    for (const c of cols) {
      const vals = rows.map(r => Number(r[c])).filter(v => !Number.isNaN(v))
      const mean = vals.reduce((a,b)=>a+b,0)/Math.max(1, vals.length)
      const sd = Math.sqrt(vals.reduce((a,b)=>a+Math.pow(b-mean,2),0)/Math.max(1, vals.length)) || 1
      stats[c] = { mean, sd }
    }
    const newRows = rows.map(r => {
      const copy = { ...r }
      for (const c of cols) {
        const v = Number(r[c])
        if (!Number.isNaN(v)) copy[c] = (v - stats[c].mean) / stats[c].sd
      }
      return copy
    })
    setRows(newRows)
    setMessage('Normalized (z-score) applied to numeric columns')
    setDatasetCleaned(true)
  }

  function removeOutliersIQR() {
    if (!rows.length) return
    const cols = headers.filter(isNumericCol)
    const bounds: Record<string, {lo:number, hi:number}> = {}
    for (const c of cols) {
      const vals = rows.map(r => Number(r[c])).filter(v => !Number.isNaN(v)).sort((a,b)=>a-b)
      if (!vals.length) continue
      const q1 = vals[Math.floor((vals.length - 1) * 0.25)]
      const q3 = vals[Math.floor((vals.length - 1) * 0.75)]
      const iqr = q3 - q1
      bounds[c] = { lo: q1 - 1.5 * iqr, hi: q3 + 1.5 * iqr }
    }
    const filtered = rows.filter(r => {
      for (const c of cols) {
        const v = Number(r[c])
        if (Number.isNaN(v)) continue
        const b = bounds[c]
        if (!b) continue
        if (v < b.lo || v > b.hi) return false
      }
      return true
    })
    setRows(filtered)
    setMessage(`Removed outliers using IQR (rows now ${filtered.length})`)
    setDatasetCleaned(true)
  }

  // previewCSV removed (unused). Use previewCSVAll() or table preview instead.

  // commit current preview to central store by building CSV string
  async function commitToStore() {
    if (!headers.length) return
    const csv = previewCSVAll()
    await uploadData(csv, true)
    setMessage('Committed preview to central store')
    setDatasetCleaned(true)
  }

  function previewCSVAll() {
    if (!headers.length) return ''
    const lines = [headers.join(',')]
    for (const r of rows) {
      const vals = headers.map(h => {
        const v = r[h]
        if (v === null || v === undefined) return ''
        return String(v)
      })
      lines.push(vals.join(','))
    }
    return lines.join('\n')
  }

  useEffect(() => {
    if (!report || !rows.length) {
      setEncodedRows(null)
      return
    }
    const mappings: Record<string, any[]> = report.categorical_mappings || {}
    const mapped = rows.map(r => {
      const copy: Row = { ...r }
      for (const col of Object.keys(mappings)) {
        if (!(col in copy)) continue
        const map = mappings[col] as any[]
        const val = copy[col] == null ? '' : String(copy[col])
        const idx = map.indexOf(val)
        copy[col] = idx >= 0 ? idx : val
      }
      return copy
    })
    setEncodedRows(mapped)
  }, [rows, report])

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{padding:12, border:'2px dashed #bbb', borderRadius:6, textAlign:'center', marginBottom:8}}
      >
        <div>Drag & drop CSV here</div>
        <div style={{marginTop:8}}>or</div>
        <input type="file" accept=".csv,text/csv" onChange={handleInput} />
      </div>

      <div style={{display:'flex', gap:8, marginBottom:8}}>
        <button onClick={normalizeZScore} disabled={!rows.length}>Normalize (z-score)</button>
        <button onClick={removeOutliersIQR} disabled={!rows.length}>Remove Outliers (IQR)</button>
        <button onClick={commitToStore} disabled={!rows.length}>Commit to Store</button>
      </div>

      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
        <div style={{fontSize:12, color:'#444'}}>{message}</div>
        <div style={{marginLeft:'auto', display:'flex', gap:8, alignItems:'center'}}>
          <div style={{background:'#FFC0CB', borderRadius:999, padding:'3px 6px', display:'inline-block'}}>
            <button
              onClick={() => setShowReport(s => !s)}
              style={{fontSize:12, padding:'6px 10px', background:'transparent', border:'none', cursor:'pointer'}}
            >
              {showReport ? 'Hide Report' : 'Show Report'}
            </button>
          </div>
          {cleanedFlag ? (
            <span style={{background:'#daf5dc', color:'#1b7a2f', padding:'4px 8px', borderRadius:12, fontSize:12}}>Cleaned</span>
          ) : (
            <span style={{background:'#f0f0f0', color:'#666', padding:'4px 8px', borderRadius:12, fontSize:12}}>Raw</span>
          )}
        </div>
      </div>

      <div style={{display:'flex', gap:12}}>
        <div style={{flex:1, border:'1px solid #eee', padding:8, maxHeight:260, overflow:'auto'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <strong>Before</strong>
            <small style={{color:'#666'}}>{originalRows.length} rows</small>
          </div>
          {originalRows.length === 0 ? (
            <div style={{padding:8, color:'#666'}}>No original data</div>
          ) : (
            <table style={{width:'100%', borderCollapse:'collapse', marginTop:8}}>
              <thead>
                <tr>
                  {headers.slice(0, 20).map(h => (
                    <th key={h} style={{borderBottom:'1px solid #ddd', textAlign:'left', padding:4}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {originalRows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    {headers.slice(0, 20).map(h => (
                      <td key={h} style={{padding:4, borderBottom:'1px solid #fafafa'}}>{String(r[h] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{flex:1, border:'1px solid #eee', padding:8, maxHeight:260, overflow:'auto'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <strong>After</strong>
            <small style={{color:'#666'}}>{rows.length} rows</small>
          </div>
          {rows.length === 0 ? (
            <div style={{padding:8, color:'#666'}}>No data loaded</div>
          ) : (
            <table style={{width:'100%', borderCollapse:'collapse', marginTop:8}}>
              <thead>
                <tr>
                  {headers.slice(0, 20).map(h => (
                    <th key={h} style={{borderBottom:'1px solid #ddd', textAlign:'left', padding:4}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(encodedRows ?? rows).slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    {headers.slice(0, 20).map(h => {
                      const orig = rows[i]?.[h] ?? ''
                      const enc = encodedRows ? (encodedRows[i]?.[h] ?? '') : ''
                      const cell = encodedRows ? `${String(orig)} → ${String(enc)}` : String(orig)
                      return (
                        <td key={h} style={{padding:4, borderBottom:'1px solid #fafafa'}}>{cell}</td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showReport && (
        <div style={{marginTop:12, border:'1px dashed #eee', padding:8, borderRadius:6, background:'#fff', maxHeight:320, overflow:'auto', position:'relative', zIndex:1}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <strong>Cleansing Report</strong>
            <button onClick={() => setShowReport(false)} style={{fontSize:12}}>Close</button>
          </div>
          {report ? (
            <div style={{marginTop:8,fontSize:13}}>
              {Object.entries(report).map(([k,v]) => (
                <div key={k} style={{display:'flex', gap:8, paddingBottom:6}}>
                  <div style={{color:'#333', width:160}}>{k}</div>
                  <div style={{color:'#555'}}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{marginTop:8,color:'#888'}}>No report available</div>
          )}
        </div>
      )}

    </div>
  )
}
