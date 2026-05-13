import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import open from 'open';
import portfinder from 'portfinder';
import { execa } from 'execa';
import mimeTypes from 'mime-types';

export async function previewCommand(dir, options) {
  const projectDir = path.resolve(dir || process.cwd());

  // Check if it's a Node project with dev script
  const pkgPath = path.join(projectDir, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    const startScript = pkg.scripts?.dev || pkg.scripts?.start;

    if (startScript) {
      const port = options.port || 3000;
      console.log(chalk.cyan(`\n🚀 Starting: ${startScript}`));
      console.log(chalk.dim(`   Directory: ${projectDir}`));
      console.log(chalk.dim(`   Press Ctrl+C to stop\n`));

      const proc = execa('bash', ['-c', startScript], {
        cwd: projectDir,
        stdio: 'inherit',
        env: { ...process.env, PORT: String(port) },
      });

      if (options.open) {
        setTimeout(() => open(`http://localhost:${port}`), 3000);
      }

      await proc;
      return;
    }
  }

  // Static file server fallback
  const port = await portfinder.getPortPromise({ port: options.port || 3000 });
  const app = express();

  // Serve static files with proper MIME types
  app.use((req, res, next) => {
    const filePath = path.join(projectDir, req.path === '/' ? 'index.html' : req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const mime = mimeTypes.lookup(filePath) || 'text/plain';
      res.setHeader('Content-Type', mime);
      res.sendFile(filePath);
    } else {
      // SPA fallback
      const indexPath = path.join(projectDir, 'index.html');
      if (fs.existsSync(indexPath)) res.sendFile(indexPath);
      else next();
    }
  });

  app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(chalk.green(`\n✓ Preview server running`));
    console.log(chalk.cyan(`  → ${url}`));
    console.log(chalk.dim(`  Directory: ${projectDir}`));
    console.log(chalk.dim(`  Press Ctrl+C to stop\n`));
    if (options.open) open(url);
  });
}
