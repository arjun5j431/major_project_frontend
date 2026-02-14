import { create } from "zustand"

type Matrix = number[][]

interface DatasetState {
  data: number[][]
  labels: number[]
  cleaned: boolean
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
  dataset: DatasetState
  network: NetworkState
  training: TrainingState

  uploadData: (file: File | string) => Promise<void>
  cleanData: (method?: 'dropna' | 'normalize') => void
  updateWeight: (factor?: number) => void
  trainStep: () => void
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
    // assume last column is label
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

  uploadData: async (file) => {
    let text = ''
    if (typeof file === 'string') {
      text = file
    } else {
      text = await file.text()
    }
    const parsed = parseCSV(text)
    set({ dataset: { data: parsed.data, labels: parsed.labels, cleaned: false } })
  },

  cleanData: (method = 'dropna') => {
    const s = get()
    const { data, labels } = s.dataset
    if (data.length === 0) return
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
      // min-max normalize each column
      const cols = s.dataset.data[0]?.length || 0
      const mins: number[] = Array(cols).fill(Infinity)
      const maxs: number[] = Array(cols).fill(-Infinity)
      for (const row of s.dataset.data) {
        for (let j = 0; j < cols; j++) {
          const v = row[j]
          if (v < mins[j]) mins[j] = v
          if (v > maxs[j]) maxs[j] = v
        }
      }
      const normed = s.dataset.data.map((row) =>
        row.map((v, j) => (maxs[j] === mins[j] ? 0 : (v - mins[j]) / (maxs[j] - mins[j])))
      )
      set({ dataset: { data: normed, labels: s.dataset.labels.slice(), cleaned: true } })
    }
  },

  updateWeight: (factor = 0.01) => {
    const s = get()
    const net = s.network
    const newWeights = net.weights.map((layer) =>
      layer.map((row) => row.map((w) => w + (Math.random() - 0.5) * factor))
    )
    set({ network: { ...net, weights: newWeights } })
  },

  trainStep: () => {
    const s = get()
    const ds = s.dataset
    const tr = s.training

    // if no data, do nothing
    if (ds.data.length === 0) return

    // simple simulated training step: slightly reduce loss, bump epoch and accuracy
    const lr = tr.lr
    const newLoss = Math.max(0, tr.loss - lr * (0.1 + Math.random() * 0.2))
    const accSample = Math.min(1, ( (1 - newLoss) + (Math.random()*0.05) ))
    const newAcc = [...tr.accuracy, Number((accSample).toFixed(4))]

    set({ training: { ...tr, epoch: tr.epoch + 1, loss: newLoss, accuracy: newAcc } })

    // nudge weights as if a gradient step happened
    get().updateWeight(lr * 0.1)
  },
}))
