import React, { useCallback, useState } from 'react'
import Papa from 'papaparse'
import { useModelStore } from '../store/useModelStore'

type Row = Record<string, any>

export default function DataPanel() {
  const uploadData = useModelStore((s) => s.uploadData)
  const setDatasetCleaned = useModelStore((s) => s.setDatasetCleaned)
  const cleanedFlag = useModelStore((s) => s.dataset.cleaned)
  const [rows, setRows] = useState<Row[]>([])
  const [originalRows, setOriginalRows] = useState<Row[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const parseFile = useCallback((file: File) => {
    setMessage('Parsing...')
    Papa.parse<Row>(file, {
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

  function previewCSV() {
    if (!headers.length) return ''
    const lines = [headers.join(',')]
    for (const r of rows) {
      const vals = headers.map(h => {
        const v = r[h]
        if (v === null || v === undefined) return ''
        return String(v)
      })
      lines.push(vals.join(','))
      if (lines.length > 11) break
    }
    return lines.join('\n')
  }

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
        <div style={{marginLeft:'auto'}}>
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
                {rows.slice(0, 10).map((r, i) => (
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
      </div>

    </div>
  )
}
