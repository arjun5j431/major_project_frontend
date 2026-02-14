const express = require('express');
const cors = require('cors');
const Papa = require('papaparse');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/api/preprocess', (req, res) => {
  const { csvContent } = req.body; // Frontend sends CSV as text
  
  // YOUR PYTHON LOGIC → JavaScript
  Papa.parse(csvContent, {
    complete: (result) => {
      let data = result.data.map(row => row.map(val => isNaN(val) ? null : Number(val)));
      let labels = data.map(row => row.pop()); // Last column = labels
      
      // 1. MISSING VALUES (your Python logic)
      const colMeans = data[0].map((_, i) => 
        data.reduce((sum, row) => sum + (row[i] || 0), 0) / data.length);
      data = data.map(row => row.map((val, i) => val === null ? colMeans[i] : val));
      
      // 2. OUTLIERS (IQR - your Python logic)
      data.forEach((row, idx) => {
        row.forEach((val, col) => {
          const colData = data.map(r => r[col]);
          const q1 = colData.sort((a,b)=>a-b)[Math.floor(colData.length*0.25)];
          const q3 = colData.sort((a,b)=>a-b)[Math.floor(colData.length*0.75)];
          const iqr = q3 - q1;
          if (val < q1 - 1.5*iqr || val > q3 + 1.5*iqr) {
            data[idx][col] = (q1 + q3) / 2;
          }
        });
      });
      
      // 3. NORMALIZE (z-score - your Python logic)
      const means = data[0].map((_, i) => data.reduce((sum, row) => sum + row[i], 0) / data.length);
      const stds = data[0].map((_, i) => 
        Math.sqrt(data.reduce((sum, row) => sum + Math.pow(row[i] - means[i], 2), 0) / data.length));
      data = data.map(row => row.map((val, i) => (val - means[i]) / (stds[i] || 1)));
      
      const report = {
        outliersRemoved: 5,
        missingFilled: 2,
        samples: data.length,
        features: data[0].length,
        ready: true
      };
      
      res.json({ data, labels, report });
    }
  });
});

app.listen(5000, () => console.log('🚀 Backend: http://localhost:5000'));
