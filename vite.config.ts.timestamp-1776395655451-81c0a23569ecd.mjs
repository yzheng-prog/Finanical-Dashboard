// vite.config.ts
import { defineConfig } from "file:///sessions/adoring-cool-heisenberg/mnt/Investment/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/adoring-cool-heisenberg/mnt/Investment/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "/sessions/adoring-cool-heisenberg/mnt/Investment";
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  // @ts-expect-error -- vitest inline config; type-checked by vitest/config, not vite
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvYWRvcmluZy1jb29sLWhlaXNlbmJlcmcvbW50L0ludmVzdG1lbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9hZG9yaW5nLWNvb2wtaGVpc2VuYmVyZy9tbnQvSW52ZXN0bWVudC92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvYWRvcmluZy1jb29sLWhlaXNlbmJlcmcvbW50L0ludmVzdG1lbnQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcblxuLy8gaHR0cHM6Ly92aXRlLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMnKSxcbiAgICB9LFxuICB9LFxuICAvLyBAdHMtZXhwZWN0LWVycm9yIC0tIHZpdGVzdCBpbmxpbmUgY29uZmlnOyB0eXBlLWNoZWNrZWQgYnkgdml0ZXN0L2NvbmZpZywgbm90IHZpdGVcbiAgdGVzdDoge1xuICAgIGdsb2JhbHM6IHRydWUsXG4gICAgZW52aXJvbm1lbnQ6ICdqc2RvbScsXG4gICAgc2V0dXBGaWxlczogWycuL3NyYy90ZXN0L3NldHVwLnRzJ10sXG4gICAgaW5jbHVkZTogWyd0ZXN0cy8qKi8qLnRlc3QudHMnLCAndGVzdHMvKiovKi50ZXN0LnRzeCcsICdzcmMvKiovKi50ZXN0LnRzJywgJ3NyYy8qKi8qLnRlc3QudHN4J10sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBa1UsU0FBUyxvQkFBb0I7QUFDL1YsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUZqQixJQUFNLG1DQUFtQztBQUt6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFFQSxNQUFNO0FBQUEsSUFDSixTQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsSUFDYixZQUFZLENBQUMscUJBQXFCO0FBQUEsSUFDbEMsU0FBUyxDQUFDLHNCQUFzQix1QkFBdUIsb0JBQW9CLG1CQUFtQjtBQUFBLEVBQ2hHO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
