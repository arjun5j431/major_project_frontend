import { create } from 'zustand'

interface DatasetState {
  data: number[][]
  labels: number[]
  cleaned: boolean
  report?: any
}

interface NetworkState {
  layers: number[]
  weights: number[][][]
  biases: number[][]
}

interface TrainingState {
  epoch: number
  loss: number
  accuracy: number[]
  lr: number
}

interface ModelState {
  dataset: DatasetState | { data: number[][]; labels: number[]; cleaned: boolean } | null
  network: NetworkState
  training: TrainingState

  uploadData: (file: File | string, cleaned?: boolean) => Promise<void>
  setDatasetCleaned: (cleaned: boolean) => void
  cleanData: (method?: 'dropna' | 'normalize') => void
  updateWeight: (factor?: number) => void
  trainStep: () => void
  preprocessData?: (csvFile: File) => Promise<void>
}

function parseCSV(text: string): { data: number[][]; labels: number[] } {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((r) => r.split(',').map((c) => c.trim()))
    .filter((r) => r.length > 0)

  const data: number[][] = []
  const labels: number[] = []

  for (const row of rows) {
    const nums = row.map((c) => {
      const n = Number(c)
      return Number.isNaN(n) ? NaN : n
    })
    if (nums.length === 0) continue
    const label = nums[nums.length - 1]
    labels.push(label)
    data.push(nums.slice(0, nums.length - 1))
  }

  return { data, labels }
}

export const useModelStore = create<ModelState>((set, get) => ({
  dataset: { data: [], labels: [], cleaned: false },
  network: { layers: [1], weights: [[[0]]], biases: [[0]] },
  training: { epoch: 0, loss: 1.0, accuracy: [], lr: 0.01 },

  uploadData: async (file, cleaned = false) => {
    let text = ''
    if (typeof file === 'string') {
      text = file
    } else {
      text = await file.text()
    }
    const parsed = parseCSV(text)
    set({ dataset: { data: parsed.data, labels: parsed.labels, cleaned } })
  },

  setDatasetCleaned: (cleaned: boolean) => {
    const s = get()
    set({ dataset: { ...(s.dataset as any), cleaned } })
  },

  cleanData: (method = 'dropna') => {
    const s = get()
    const ds = s.dataset as any
    if (!ds || !ds.data || ds.data.length === 0) return
    const data: number[][] = ds.data
    const labels: number[] = ds.labels || []
    if (method === 'dropna') {
      const filteredData: number[][] = []
      const filteredLabels: number[] = []
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        if (row.some((v) => Number.isNaN(v)) || Number.isNaN(labels[i])) continue
        filteredData.push(row)
        filteredLabels.push(labels[i])
      }
      set({ dataset: { data: filteredData, labels: filteredLabels, cleaned: true } })
    } else if (method === 'normalize') {
      const cols = data[0]?.length || 0
      const mins: number[] = Array(cols).fill(Infinity)
      const maxs: number[] = Array(cols).fill(-Infinity)
      for (const row of data) {
        for (let j = 0; j < cols; j++) {
          const v = row[j]
          if (v < mins[j]) mins[j] = v
          if (v > maxs[j]) maxs[j] = v
        }
      }
      const normed = data.map((row) => row.map((v, j) => (maxs[j] === mins[j] ? 0 : (v - mins[j]) / (maxs[j] - mins[j]))))
      set({ dataset: { data: normed, labels: labels.slice(), cleaned: true } })
    }
  },

  updateWeight: (factor = 0.01) => {
    const s = get()
    const net = s.network
    const newWeights = net.weights.map((layer) => layer.map((row) => row.map((w) => w + (Math.random() - 0.5) * factor)))
    set({ network: { ...net, weights: newWeights } })
  },

  trainStep: () => {
    const s = get()
    const ds = s.dataset as any
    const tr = s.training
    if (!ds || !ds.data || ds.data.length === 0) return
    const lr = tr.lr
    const newLoss = Math.max(0, tr.loss - lr * (0.1 + Math.random() * 0.2))
    const accSample = Math.min(1, (1 - newLoss) + Math.random() * 0.05)
    const newAcc = [...tr.accuracy, Number(accSample.toFixed(4))]
    set({ training: { ...tr, epoch: tr.epoch + 1, loss: newLoss, accuracy: newAcc } })
    get().updateWeight(lr * 0.1)
  },

  preprocessData: async (csvFile: File) => {
    // Try FastAPI Python service first (http://localhost:8000/preprocess), else fallback to Node /api/preprocess
    try {
      const form = new FormData()
      form.append('file', csvFile)
      const resp = await fetch('http://localhost:8000/preprocess', {
        method: 'POST',
        body: form,
      })
      if (resp.ok) {
        const json = await resp.json()
        set({ dataset: { data: [], labels: [], cleaned: true, report: json } })
        return
      }
    } catch (err) {
      console.warn('FastAPI preprocess failed, falling back to Node', err)
    }

    // fallback to existing Node endpoint
    try {
      const csvContent = await csvFile.text()
      const response = await fetch('/api/preprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent }),
      })
      const { data, labels, report } = await response.json()
      set({ dataset: { data, labels, cleaned: true, report } })
    } catch (err) {
      console.warn('preprocessData all backends failed', err)
    }
  },
}))

export default useModelStore
