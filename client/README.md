# Auth Demo – Client (React)

### Overview
This folder contains a React client project for the MDIP Auth Demo’s front-end. It shows login flows, routes for profile pages, and so on.

### Local Development

1. **Install dependencies**:
    - `npm install`

2. **.env configuration**:
    - `VITE_PORT=3001`
    - `VITE_API_URL=http://localhost:3000/api` (or wherever your server runs)

3. **Start** the client dev server:
    - `npm start`

4. **Access** the React client:
    - `http://localhost:3001` (if using default port 3001)

### Production Build
1. `npm run build` – Outputs the production-ready static files into `build/`.
2. Serve those files from your hosting solution.

### Running with the Server
If you set the environment variable `AD_SERVE_CLIENT=true` in the server’s .env, and then build this client (`npm run build`), the server can serve these static files. Access the app at the server's URL (e.g. `http://localhost:3000`).
