const http = require('http');

const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
const payload = [`--${boundary}`,
  'Content-Disposition: form-data; name="file"; filename="test.csv"',
  'Content-Type: text/csv',
  '',
  '1,2,0',
  '3,4,1',
  '5,6,0',
  `--${boundary}--`,
  ''].join('\r\n');

const options = {
  hostname: 'localhost',
  port: 8000,
  path: '/preprocess',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (err) => console.error('Error:', err));
req.write(payload);
req.end();
