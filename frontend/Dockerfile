# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# copy source
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
