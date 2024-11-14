# Use the official Node.js as the base image
FROM node:18.18.2

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json .

# Install dependencies
RUN npm ci

# Copy the client build to the auth-client directory
COPY auth-client/package*.json ./auth-client/
RUN cd auth-client && npm ci

COPY auth-client/public ./auth-client/public/
COPY auth-client/src ./auth-client/src/
RUN cd auth-client && npm run build

# Copy app
COPY *.js .
COPY *.pem .

# Run...
CMD ["node", "index.js"]
