const express = require('express');
const cors = require('cors');
const Papa = require('papaparse');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/api/preprocess', (req, res) => {
  const { csvContent } = req.body; // Frontend sends CSV as text
  // write CSV to a temp file and call the Python processor which returns a JSON report
  try {
    const tmpName = `preprocess_${Date.now()}.csv`;
    const tmpPath = require('path').join(require('os').tmpdir(), tmpName);
    fs.writeFileSync(tmpPath, csvContent, 'utf8');

    const { execFile } = require('child_process');
    const pyScript = require('path').join(__dirname, 'major_project_backend_aiml', 'data_processor.py');

    execFile('python', [pyScript, '--file', tmpPath], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(tmpPath); } catch (e) {}
      if (err) {
        console.error('Python preprocessing error', err, stderr);
        return res.status(500).json({ error: 'Preprocessing failed', details: stderr || err.message });
      }
      let parsed = null;
      try {
        parsed = JSON.parse(stdout);
      } catch (e) {
        return res.status(500).json({ error: 'Invalid JSON from processor', details: stdout });
      }
      if (parsed && parsed.error) {
        return res.status(500).json({ error: parsed.error });
      }
      // Return only the report (frontend only needs cleansing summary)
      return res.json({ report: parsed });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(5000, () => console.log('🚀 Backend: http://localhost:5000'));
