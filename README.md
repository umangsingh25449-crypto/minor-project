# LoanPredict AI backend

## Run locally
1. Install Node.js 18 or newer.
2. Open this project folder in a terminal.
3. Run `npm start` (or `node server.js`).
4. Open `http://127.0.0.1:3000`.

The backend validates submissions at `POST /api/predict` and appends accepted applications to `applications.jsonl` in this folder. `GET /api/health` reports whether the server is running.

## Prediction note
No trained model or dataset was supplied with the frontend. The current response is an educational heuristic using credit history and estimated monthly payment relative to household monthly income. It is not a bank decision or a substitute for a trained, validated model. Replace the heuristic in `server.js` when a real model is available.
