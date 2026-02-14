import DataPanel from './components/DataPanel';
import LossChart from './components/LossChart';
import LossScene from './components/LossScene';
import StoreTester from './components/StoreTester';

export default function Dashboard() {
  return (
    <div style={{height: '100vh', display: 'flex', gap: 12, padding: 12}}>
      {/* Left: Data upload */}
      <aside style={{width: 300, minWidth: 220, borderRight: '1px solid #e6e6e6', paddingRight: 12}}>
        <h2>Data Upload</h2>
        <DataPanel />
      </aside>

      {/* Center: Network viz + charts */}
      <main style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 12}}>
        <section style={{flex: 1, border: '1px solid #eee', borderRadius: 6, overflow: 'hidden'}}>
          <h2 style={{margin: 8}}>Network Visualization</h2>
          <div style={{height: '60%', minHeight: 240}}>
            <LossScene />
          </div>
        </section>

        <section style={{height: 280, border: '1px solid #eee', borderRadius: 6, padding: 8, overflow: 'auto'}}>
          <h2>Charts</h2>
          <div style={{height: 220}}>
            <LossChart />
          </div>
        </section>
      </main>

      {/* Right: Controls */}
      <aside style={{width: 300, minWidth: 220, borderLeft: '1px solid #e6e6e6', paddingLeft: 12}}>
        <h2>Controls</h2>
        <StoreTester />
      </aside>
    </div>
  )
}
