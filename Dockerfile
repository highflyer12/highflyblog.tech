# syntax = docker/dockerfile:1

# 补充一点关于dockerfile的知识：
# refer: https://hannadrehman.com/blog/how-to-dockerize-a-remix-run-app
# Dockerfiles are simple text files containing instructions on how to create Docker images. 一般会做以下事情: 
#1) Install dependencies: 一是选择合适的base image【比如这个选的是node:${NODE_VERSION}-slim】；二是给应用设定WORKDIR【这里是/app】；
#    2) Build our application. 
#    3)Setup environment variables: 【ENV NODE_ENV="production"】
#    4) Define the command to run our application:【CMD [ "npm", "run", "start" ]】


# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.14.0
FROM node:${NODE_VERSION}-slim as base

# inform or configure tools or systems that interact with the Docker image about what kind of runtime environment is expected by the application. This might be particularly useful in platforms like Fly.io, where specific runtimes might receive optimizations or special handling.
LABEL fly_launch_runtime="Remix/Prisma"

# Remix/Prisma app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
# multi-stage build process technics to excluding unnecessary files and tools that are only needed during the build phase.【FROM base: use an image tagged as base as the starting point for this build stage】【as build: name this stage as build. Naming a stage allows you to refer to it later in the Dockerfile, typically for copying artifacts from this build stage to another stage.】【所谓的分阶段build，基本就是每个阶段都在base上面进行某项可单独进行的任务，后面生成最终image的阶段，把这些复制过来即可，例如COPY --from=build /app /app】
FROM base as build

# Install packages needed to build node modules [-qq makes the operation quieter; -y automatically answers "yes" to prompts]
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp openssl pkg-config python-is-python3

# Install node modules 【 --link option enables the use of file links (such as hard links or symbolic links) instead of copying files directly. This can speed up the build process and reduce the size of the build context, as it avoids duplicating file content.】【.npmrc是npm运行时配置文件，比如配置源等】【运行npm install时，如果package-lock.json package.json都存在的话，会使用package-lock.json来安装，确保deps版本号完全一致】【ci表示clean install:安装前removing the existing node_modules】【这里需要devdeps是因为vite和esbuild都是devdeps；build完成后有一个RUN npm prune --omit=dev的操作】
COPY --link .npmrc package-lock.json package.json ./
RUN npm ci --include=dev

# Generate Prisma Client
COPY --link prisma .
RUN npx prisma generate

# Copy application code
COPY --link . .

# Build application
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev


# Final stage for app image
FROM base

# Install, configure litefs
# refer: https://fly.io/docs/litefs/getting-started-docker/
# 【表示把flyio/litefs:0.4.0 image的/usr/local/bin/litefs复制到base的/usr/local/bin/litefs】
COPY --from=flyio/litefs:0.4.0 /usr/local/bin/litefs /usr/local/bin/litefs
COPY --link other/litefs.yml /etc/litefs.yml

# Install packages needed for deployment
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y ca-certificates fuse3 openssl sqlite3 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Copy built application
COPY --from=build /app /app

# Setup sqlite3 on a separate volume
RUN mkdir -p /data /litefs 
VOLUME /data

# add shortcut for connecting to database CLI
RUN echo "#!/bin/sh\nset -x\nsqlite3 \$DATABASE_URL" > /usr/local/bin/database-cli && chmod +x /usr/local/bin/database-cli

# Entrypoint prepares the database.
ENTRYPOINT [ "litefs", "mount", "--", "/app/other/docker-entrypoint.js" ]

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
ENV DATABASE_FILENAME="sqlite.db"
ENV LITEFS_DIR="/litefs"
ENV DATABASE_PATH="$LITEFS_DIR/$DATABASE_FILENAME"
ENV DATABASE_URL="file://$DATABASE_PATH"
ENV CACHE_DATABASE_FILENAME="cache.db"
ENV CACHE_DATABASE_PATH="$LITEFS_DIR/$CACHE_DATABASE_FILENAME"
ENV PORT=3001
CMD [ "npm", "run", "start" ]
