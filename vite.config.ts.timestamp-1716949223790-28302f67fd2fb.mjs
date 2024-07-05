// vite.config.ts
import mdx from "file:///Users/hf/Projects/highflyblog.tech/node_modules/@mdx-js/rollup/index.js";
import { vitePlugin as remix } from "file:///Users/hf/Projects/highflyblog.tech/node_modules/@remix-run/dev/dist/index.js";
import { sentryVitePlugin } from "file:///Users/hf/Projects/highflyblog.tech/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
import { glob } from "file:///Users/hf/Projects/highflyblog.tech/node_modules/glob/dist/esm/index.js";
import rehypePrettyCode from "file:///Users/hf/Projects/highflyblog.tech/node_modules/rehype-pretty-code/dist/index.js";
import remarkFrontmatter from "file:///Users/hf/Projects/highflyblog.tech/node_modules/remark-frontmatter/index.js";
import remarkMdxFrontmatter from "file:///Users/hf/Projects/highflyblog.tech/node_modules/remark-mdx-frontmatter/index.js";
import { flatRoutes } from "file:///Users/hf/Projects/highflyblog.tech/node_modules/remix-flat-routes/dist/index.js";
import { defineConfig } from "file:///Users/hf/Projects/highflyblog.tech/node_modules/vite/dist/node/index.js";
import tsconfigPaths from "file:///Users/hf/Projects/highflyblog.tech/node_modules/vite-tsconfig-paths/dist/index.mjs";
var MODE = process.env.NODE_ENV;
var vite_config_default = defineConfig({
  build: {
    cssMinify: MODE === "production",
    rollupOptions: {
      external: [/node:.*/, "stream", "crypto", "fsevents"]
    },
    sourcemap: true
  },
  plugins: [
    tsconfigPaths(),
    mdx({
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
      rehypePlugins: [rehypePrettyCode]
    }),
    remix({
      ignoredRouteFiles: ["**/*"],
      serverModuleFormat: "esm",
      routes: async (defineRoutes) => {
        return flatRoutes("routes", defineRoutes, {
          ignoredRouteFiles: [
            ".*",
            "**/*.css",
            "**/*.test.{js,jsx,ts,tsx}",
            "**/__*.*",
            // This is for server-side utilities you want to colocate
            // next to your routes without making an additional
            // directory. If you need a route that includes "server" or
            // "client" in the filename, use the escape brackets like:
            // my-route.[server].tsx
            "**/*.server.*",
            "**/*.client.*"
          ]
        });
      }
    }),
    process.env.SENTRY_AUTH_TOKEN ? sentryVitePlugin({
      disable: MODE !== "production",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      release: {
        name: process.env.COMMIT_SHA,
        setCommits: {
          auto: true
        }
      },
      sourcemaps: {
        filesToDeleteAfterUpload: await glob([
          "./build/**/*.map",
          ".server-build/**/*.map"
        ])
      }
    }) : null
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvaGYvUHJvamVjdHMvaGlnaGZseWJsb2cudGVjaFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2hmL1Byb2plY3RzL2hpZ2hmbHlibG9nLnRlY2gvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2hmL1Byb2plY3RzL2hpZ2hmbHlibG9nLnRlY2gvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgbWR4IGZyb20gJ0BtZHgtanMvcm9sbHVwJ1xuaW1wb3J0IHsgdml0ZVBsdWdpbiBhcyByZW1peCB9IGZyb20gJ0ByZW1peC1ydW4vZGV2J1xuaW1wb3J0IHsgc2VudHJ5Vml0ZVBsdWdpbiB9IGZyb20gJ0BzZW50cnkvdml0ZS1wbHVnaW4nXG5pbXBvcnQgeyBnbG9iIH0gZnJvbSAnZ2xvYidcbmltcG9ydCByZWh5cGVQcmV0dHlDb2RlIGZyb20gJ3JlaHlwZS1wcmV0dHktY29kZSdcbmltcG9ydCByZW1hcmtGcm9udG1hdHRlciBmcm9tICdyZW1hcmstZnJvbnRtYXR0ZXInXG5pbXBvcnQgcmVtYXJrTWR4RnJvbnRtYXR0ZXIgZnJvbSAncmVtYXJrLW1keC1mcm9udG1hdHRlcidcbmltcG9ydCB7IGZsYXRSb3V0ZXMgfSBmcm9tICdyZW1peC1mbGF0LXJvdXRlcydcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tICd2aXRlLXRzY29uZmlnLXBhdGhzJ1xuXG5jb25zdCBNT0RFID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlZcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcblx0YnVpbGQ6IHtcblx0XHRjc3NNaW5pZnk6IE1PREUgPT09ICdwcm9kdWN0aW9uJyxcblxuXHRcdHJvbGx1cE9wdGlvbnM6IHtcblx0XHRcdGV4dGVybmFsOiBbL25vZGU6LiovLCAnc3RyZWFtJywgJ2NyeXB0bycsICdmc2V2ZW50cyddLFxuXHRcdH0sXG5cblx0XHRzb3VyY2VtYXA6IHRydWUsXG5cdH0sXG5cdHBsdWdpbnM6IFtcblx0XHR0c2NvbmZpZ1BhdGhzKCksXG5cdFx0bWR4KHtcblx0XHRcdHJlbWFya1BsdWdpbnM6IFtyZW1hcmtGcm9udG1hdHRlciwgcmVtYXJrTWR4RnJvbnRtYXR0ZXJdLFxuXHRcdFx0cmVoeXBlUGx1Z2luczogW3JlaHlwZVByZXR0eUNvZGVdLFxuXHRcdH0pLFxuXHRcdHJlbWl4KHtcblx0XHRcdGlnbm9yZWRSb3V0ZUZpbGVzOiBbJyoqLyonXSxcblx0XHRcdHNlcnZlck1vZHVsZUZvcm1hdDogJ2VzbScsXG5cdFx0XHRyb3V0ZXM6IGFzeW5jIGRlZmluZVJvdXRlcyA9PiB7XG5cdFx0XHRcdHJldHVybiBmbGF0Um91dGVzKCdyb3V0ZXMnLCBkZWZpbmVSb3V0ZXMsIHtcblx0XHRcdFx0XHRpZ25vcmVkUm91dGVGaWxlczogW1xuXHRcdFx0XHRcdFx0Jy4qJyxcblx0XHRcdFx0XHRcdCcqKi8qLmNzcycsXG5cdFx0XHRcdFx0XHQnKiovKi50ZXN0Lntqcyxqc3gsdHMsdHN4fScsXG5cdFx0XHRcdFx0XHQnKiovX18qLionLFxuXHRcdFx0XHRcdFx0Ly8gVGhpcyBpcyBmb3Igc2VydmVyLXNpZGUgdXRpbGl0aWVzIHlvdSB3YW50IHRvIGNvbG9jYXRlXG5cdFx0XHRcdFx0XHQvLyBuZXh0IHRvIHlvdXIgcm91dGVzIHdpdGhvdXQgbWFraW5nIGFuIGFkZGl0aW9uYWxcblx0XHRcdFx0XHRcdC8vIGRpcmVjdG9yeS4gSWYgeW91IG5lZWQgYSByb3V0ZSB0aGF0IGluY2x1ZGVzIFwic2VydmVyXCIgb3Jcblx0XHRcdFx0XHRcdC8vIFwiY2xpZW50XCIgaW4gdGhlIGZpbGVuYW1lLCB1c2UgdGhlIGVzY2FwZSBicmFja2V0cyBsaWtlOlxuXHRcdFx0XHRcdFx0Ly8gbXktcm91dGUuW3NlcnZlcl0udHN4XG5cdFx0XHRcdFx0XHQnKiovKi5zZXJ2ZXIuKicsXG5cdFx0XHRcdFx0XHQnKiovKi5jbGllbnQuKicsXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0fSlcblx0XHRcdH0sXG5cdFx0fSksXG5cblx0XHRwcm9jZXNzLmVudi5TRU5UUllfQVVUSF9UT0tFTlxuXHRcdFx0PyBzZW50cnlWaXRlUGx1Z2luKHtcblx0XHRcdFx0XHRkaXNhYmxlOiBNT0RFICE9PSAncHJvZHVjdGlvbicsXG5cdFx0XHRcdFx0YXV0aFRva2VuOiBwcm9jZXNzLmVudi5TRU5UUllfQVVUSF9UT0tFTixcblx0XHRcdFx0XHRvcmc6IHByb2Nlc3MuZW52LlNFTlRSWV9PUkcsXG5cdFx0XHRcdFx0cHJvamVjdDogcHJvY2Vzcy5lbnYuU0VOVFJZX1BST0pFQ1QsXG5cdFx0XHRcdFx0cmVsZWFzZToge1xuXHRcdFx0XHRcdFx0bmFtZTogcHJvY2Vzcy5lbnYuQ09NTUlUX1NIQSxcblx0XHRcdFx0XHRcdHNldENvbW1pdHM6IHtcblx0XHRcdFx0XHRcdFx0YXV0bzogdHJ1ZSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRzb3VyY2VtYXBzOiB7XG5cdFx0XHRcdFx0XHRmaWxlc1RvRGVsZXRlQWZ0ZXJVcGxvYWQ6IGF3YWl0IGdsb2IoW1xuXHRcdFx0XHRcdFx0XHQnLi9idWlsZC8qKi8qLm1hcCcsXG5cdFx0XHRcdFx0XHRcdCcuc2VydmVyLWJ1aWxkLyoqLyoubWFwJyxcblx0XHRcdFx0XHRcdF0pLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pXG5cdFx0XHQ6IG51bGwsXG5cdF0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEyUixPQUFPLFNBQVM7QUFDM1MsU0FBUyxjQUFjLGFBQWE7QUFDcEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxZQUFZO0FBQ3JCLE9BQU8sc0JBQXNCO0FBQzdCLE9BQU8sdUJBQXVCO0FBQzlCLE9BQU8sMEJBQTBCO0FBQ2pDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sbUJBQW1CO0FBRTFCLElBQU0sT0FBTyxRQUFRLElBQUk7QUFFekIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDM0IsT0FBTztBQUFBLElBQ04sV0FBVyxTQUFTO0FBQUEsSUFFcEIsZUFBZTtBQUFBLE1BQ2QsVUFBVSxDQUFDLFdBQVcsVUFBVSxVQUFVLFVBQVU7QUFBQSxJQUNyRDtBQUFBLElBRUEsV0FBVztBQUFBLEVBQ1o7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNSLGNBQWM7QUFBQSxJQUNkLElBQUk7QUFBQSxNQUNILGVBQWUsQ0FBQyxtQkFBbUIsb0JBQW9CO0FBQUEsTUFDdkQsZUFBZSxDQUFDLGdCQUFnQjtBQUFBLElBQ2pDLENBQUM7QUFBQSxJQUNELE1BQU07QUFBQSxNQUNMLG1CQUFtQixDQUFDLE1BQU07QUFBQSxNQUMxQixvQkFBb0I7QUFBQSxNQUNwQixRQUFRLE9BQU0saUJBQWdCO0FBQzdCLGVBQU8sV0FBVyxVQUFVLGNBQWM7QUFBQSxVQUN6QyxtQkFBbUI7QUFBQSxZQUNsQjtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxZQU1BO0FBQUEsWUFDQTtBQUFBLFVBQ0Q7QUFBQSxRQUNELENBQUM7QUFBQSxNQUNGO0FBQUEsSUFDRCxDQUFDO0FBQUEsSUFFRCxRQUFRLElBQUksb0JBQ1QsaUJBQWlCO0FBQUEsTUFDakIsU0FBUyxTQUFTO0FBQUEsTUFDbEIsV0FBVyxRQUFRLElBQUk7QUFBQSxNQUN2QixLQUFLLFFBQVEsSUFBSTtBQUFBLE1BQ2pCLFNBQVMsUUFBUSxJQUFJO0FBQUEsTUFDckIsU0FBUztBQUFBLFFBQ1IsTUFBTSxRQUFRLElBQUk7QUFBQSxRQUNsQixZQUFZO0FBQUEsVUFDWCxNQUFNO0FBQUEsUUFDUDtBQUFBLE1BQ0Q7QUFBQSxNQUNBLFlBQVk7QUFBQSxRQUNYLDBCQUEwQixNQUFNLEtBQUs7QUFBQSxVQUNwQztBQUFBLFVBQ0E7QUFBQSxRQUNELENBQUM7QUFBQSxNQUNGO0FBQUEsSUFDRCxDQUFDLElBQ0E7QUFBQSxFQUNKO0FBQ0QsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
