import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

const targets = [
  'node_modules/.vite',
  'node_modules/.cache',
  'docs/.vitepress/cache',
  'docs/.vitepress/dist',
  'markdown/.vitepress/cache',
  'markdown/.vitepress/dist',
  '.vite',
  '.cache'
]

async function removeTarget(relativePath) {
  const fullPath = path.join(root, relativePath)
  try {
    await fs.rm(fullPath, { recursive: true, force: true })
    console.log(`[clean] removed: ${relativePath}`)
  } catch (error) {
    console.warn(`[clean] skipped: ${relativePath} (${error.message})`)
  }
}

async function main() {
  console.log('[clean] start cache cleanup')
  for (const target of targets) {
    await removeTarget(target)
  }
  console.log('[clean] cache cleanup complete')
}

main().catch((error) => {
  console.error('[clean] failed:', error)
  process.exitCode = 1
})
