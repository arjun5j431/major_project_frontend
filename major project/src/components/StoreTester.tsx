import React from 'react'
import { useModelStore } from '../store/useModelStore'

export default function StoreTester() {
  const dataset = useModelStore((s) => s.dataset)
  const network = useModelStore((s) => s.network)
  const training = useModelStore((s) => s.training)
  const uploadData = useModelStore((s) => s.uploadData)
  const cleanData = useModelStore((s) => s.cleanData)
  const updateWeight = useModelStore((s) => s.updateWeight)
  const trainStep = useModelStore((s) => s.trainStep)

  const sampleCSV = `
1.0,2.0,0
2.0,3.5,1
3.1,4.2,1
4.0,NaN,0
`

  return (
    <div style={{padding: 12, border: '1px solid #ddd', borderRadius: 6}}>
      <h3>Store Tester</h3>
      <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
        <button onClick={() => uploadData(sampleCSV)}>Upload Sample CSV</button>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) uploadData(f)
          }}
        />
        <button onClick={() => cleanData('dropna')}>Clean: dropna</button>
        <button onClick={() => cleanData('normalize')}>Clean: normalize</button>
        <button onClick={() => updateWeight()}>Update Weights</button>
        <button onClick={() => trainStep()}>Train Step</button>
      </div>

      <div style={{marginTop: 12}}>
        <strong>Dataset</strong>
        <pre style={{maxHeight: 120, overflow: 'auto'}}>{JSON.stringify(dataset, null, 2)}</pre>

        <strong>Network</strong>
        <pre style={{maxHeight: 120, overflow: 'auto'}}>{JSON.stringify(network, null, 2)}</pre>

        <strong>Training</strong>
        <pre style={{maxHeight: 120, overflow: 'auto'}}>{JSON.stringify(training, null, 2)}</pre>
      </div>
    </div>
  )
}
