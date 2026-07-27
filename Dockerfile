FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the backend files (excluding what's in .dockerignore)
COPY . .

# Expose backend port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]
