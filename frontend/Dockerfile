FROM node:20-alpine

WORKDIR /app/frontend

# install dependencies first for better caching
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# copy frontend source
COPY frontend/ ./

# copy bundled toolkit assets so Vite can serve them locally
COPY toolkits/bundled /app/toolkits/bundled

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
