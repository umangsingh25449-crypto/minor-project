const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'applications.jsonl');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 16_384) {
        reject(Object.assign(new Error('Request too large'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function validEnum(value, allowed) { return typeof value === 'string' && allowed.includes(value); }

async function handlePrediction(req, res) {
  let input;
  try { input = await readBody(req); }
  catch (error) { return sendJson(res, error.status || 400, { error: error.message || 'Could not read request' }); }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const numeric = ['income', 'coIncome', 'loanAmount', 'duration'];
  const values = Object.fromEntries(numeric.map(key => [key, Number(input[key])]));
  const errors = {};
  if (name.length < 2 || name.length > 100) errors.name = 'Enter a name between 2 and 100 characters.';
  if (!validEnum(input.gender, ['Male', 'Female', 'Other'])) errors.gender = 'Choose a valid gender.';
  if (!validEnum(input.married, ['Yes', 'No'])) errors.married = 'Choose a valid marital status.';
  if (!validEnum(input.education, ['Graduate', 'Not Graduate'])) errors.education = 'Choose a valid education level.';
  if (!validEnum(input.selfEmployed, ['Yes', 'No'])) errors.selfEmployed = 'Choose a valid employment status.';
  if (!validEnum(input.property, ['Urban', 'Semiurban', 'Rural'])) errors.property = 'Choose a valid property area.';
  if (![0, 1].includes(Number(input.credit))) errors.credit = 'Choose a valid credit history.';
  if (!Number.isFinite(values.income) || values.income < 0 || values.income > 1e9) errors.income = 'Enter a valid income.';
  if (!Number.isFinite(values.coIncome) || values.coIncome < 0 || values.coIncome > 1e9) errors.coIncome = 'Enter a valid co-applicant income.';
  if (!Number.isFinite(values.loanAmount) || values.loanAmount <= 0 || values.loanAmount > 1e12) errors.loanAmount = 'Enter a valid loan amount.';
  if (!Number.isInteger(values.duration) || values.duration < 1 || values.duration > 600) errors.duration = 'Duration must be between 1 and 600 months.';
  if (Object.keys(errors).length) return sendJson(res, 400, { error: 'Please correct the application details.', fields: errors });

  // Educational heuristic only. This is not a trained or bank-approved model.
  const monthlyIncome = values.income + values.coIncome;
  const estimatedMonthlyPayment = values.loanAmount / values.duration;
  const paymentRatio = estimatedMonthlyPayment / Math.max(monthlyIncome, 1);
  const likelyEligible = Number(input.credit) === 1 && monthlyIncome > 0 && paymentRatio <= 0.6;
  const application = {
    id: require('node:crypto').randomUUID(),
    submittedAt: new Date().toISOString(),
    applicant: { name, gender: input.gender, married: input.married, education: input.education, selfEmployed: input.selfEmployed },
    finances: { ...values, credit: Number(input.credit), property: input.property },
    result: likelyEligible ? 'likely_eligible' : 'needs_review'
  };
  try {
    await fs.promises.appendFile(DATA_FILE, JSON.stringify(application) + '\n', { encoding: 'utf8', flag: 'a' });
  } catch (error) {
    console.error('Could not save application:', error.message);
    return sendJson(res, 500, { error: 'The application could not be saved. Please try again.' });
  }

  return sendJson(res, 200, {
    applicationId: application.id,
    prediction: application.result,
    message: likelyEligible
      ? 'Demo estimate: your details may be eligible. A lender must make the actual decision.'
      : 'Demo estimate: your details need further review. A lender must make the actual decision.',
    disclaimer: 'Educational estimate only; not a credit decision or a guarantee of approval.'
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'POST' && url.pathname === '/api/predict') return handlePrediction(req, res);
  if (req.method === 'GET' && url.pathname === '/api/health') return sendJson(res, 200, { status: 'ok' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed.' });

  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.resolve(ROOT, relative);
  if (!file.startsWith(ROOT + path.sep)) return sendJson(res, 403, { error: 'Forbidden.' });
  try {
    const body = await fs.promises.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    sendJson(res, 404, { error: 'Not found.' });
  }
});

server.listen(PORT, HOST, () => console.log(`LoanPredict backend running at http://${HOST}:${PORT}`));
