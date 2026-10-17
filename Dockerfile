# ==========================================
# 阶段 1: 依赖安装与前端工程构建 (Builder Stage)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 先复制依赖配置文件与本地自包含包，利用 Docker 层缓存加速构建
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
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
ENV HOST=0.0.0.0

# 从构建阶段复制必要文件
COPY package.json ./
COPY packages/ ./packages/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/api-router.js ./api-router.js
COPY --from=builder /app/user-storage.js ./user-storage.js
COPY --from=builder /app/src ./src

# 标注 OCI 镜像元数据，自动绑定 GitHub 仓库与 Packages
LABEL org.opencontainers.image.source="https://github.com/civilization-os/ExamCraft"
LABEL org.opencontainers.image.description="ExamCraft AI Workbench - Multimodal Exam Generator, Online Exam Room & Diagnostic Analytics"
LABEL org.opencontainers.image.licenses="MIT"

# 提供安全的默认模板配置文件，运行时可通过环境变量注入或宿主机挂载
COPY examcraft-config.example.json* ./

# 暴露服务端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/model/config || exit 1

# 启动 Node.js Express 生产服务器
CMD ["node", "server.js"]
