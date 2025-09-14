import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Plugin to copy sound assets and locale files
function copyAssetsPlugin() {
  return {
    name: 'copy-assets',
    writeBundle() {
      // Copy sound files
      const soundSourceDir = path.resolve(__dirname, 'webview-assets/sounds')
      const soundTargetDir = path.resolve(__dirname, 'webview-dist/sounds')
      
      // Create target directory if it doesn't exist
      if (!fs.existsSync(soundTargetDir)) {
        fs.mkdirSync(soundTargetDir, { recursive: true })
      }
      
      // Copy sound files
      if (fs.existsSync(soundSourceDir)) {
        const files = fs.readdirSync(soundSourceDir)
        files.forEach(file => {
          const sourcePath = path.join(soundSourceDir, file)
          const targetPath = path.join(soundTargetDir, file)
          fs.copyFileSync(sourcePath, targetPath)
          console.log(`Copied sound asset: ${file}`)
        })
      }

      // Copy locale files
      const localesSourceDir = path.resolve(__dirname, 'src/webview/locales')
      const localesTargetDir = path.resolve(__dirname, 'webview-dist/locales')
      
      // Create target directory if it doesn't exist
      if (!fs.existsSync(localesTargetDir)) {
        fs.mkdirSync(localesTargetDir, { recursive: true })
      }
      
      // Copy locale files
      if (fs.existsSync(localesSourceDir)) {
        const files = fs.readdirSync(localesSourceDir)
        files.forEach(file => {
          if (file.endsWith('.json')) {
            const sourcePath = path.join(localesSourceDir, file)
            const targetPath = path.join(localesTargetDir, file)
            fs.copyFileSync(sourcePath, targetPath)
            console.log(`Copied locale file: ${file}`)
          }
        })
      }
    }
  }
}

// Dynamically import Tailwind CSS v4 plugin
async function createConfig() {
  const { default: tailwindcss } = await import('@tailwindcss/vite')
  
  return {
    plugins: [
      react(),
      tailwindcss(),
      copyAssetsPlugin(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src/webview"),
      },
    },
    build: {
      outDir: path.resolve(__dirname, 'webview-dist'),
      rollupOptions: {
        input: {
          main: 'src/webview/index.html',
          'comment-modal': 'src/webview/comment-modal.html'
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: (assetInfo: any) => {
            // Force CSS files to be named globals.css
            if (assetInfo.name?.endsWith('.css')) {
              return 'globals.css';
            }
            return '[name].[ext]';
          }
        }
      },
      minify: 'esbuild' as const,
      target: 'es2020'
    },
    server: {
      port: 5173,
      strictPort: true
    },
    root: 'src/webview'
  }
}

// https://vite.dev/config/
export default defineConfig(createConfig())