// Final re-vectorization script
const http = require('http');

function callAPI() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/test/revectorize-now',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    console.log('🔄 Calling re-vectorization API...');
    const result = await callAPI();
    console.log('Response status:', result.status);
    console.log('Response data:', result.data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
