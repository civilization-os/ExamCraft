# ==========================================
# 阶段 1: 依赖安装与前端工程构建 (Builder Stage)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 先复制依赖配置文件与本地自包含包，利用 Docker 层缓存加速构建
COPY package.json pnpm-lock.yaml ./
COPY packages/ ./packages/

# 安装所有依赖（包含 devDependencies 以供构建前端）
RUN pnpm install

# 复制其余项目源码
COPY . .

# 执行 Vite 生产构建，生成 dist 目录
RUN pnpm run build

# 剔除开发依赖，精简生产 node_modules
RUN pnpm prune --prod

# ==========================================
# 阶段 2: 极简生产运行镜像 (Runner Stage)
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# 设置生产环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 从构建阶段复制必要文件
COPY package.json ./
COPY packages/ ./packages/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/api-router.js ./api-router.js

# 若存在默认配置文件则复制，如无则运行时通过环境变量或挂载读取
COPY examcraft-config.json* ./

# 暴露服务端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/model/config || exit 1

# 启动 Node.js Express 生产服务器
CMD ["node", "server.js"]
