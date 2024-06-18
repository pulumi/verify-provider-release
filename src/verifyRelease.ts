import * as core from '@actions/core'
import { LocalWorkspace } from '@pulumi/pulumi/automation'
import * as path from 'path'
import * as fs from 'fs/promises'
import shell from 'shelljs'

export interface VerifyReleaseOptions {
  language: string
  directory: string
  provider: string
  providerVersion: string
  packageVersion: string
  publisher: string
  goModuleTemplate: string
}

/**
 * Performs a preview of the application using the specific SDK and therefore provider version.
 * @param milliseconds The number of milliseconds to wait.
 * @returns {Promise<string>} Resolves with 'done!' after the wait is over.
 */
export async function verifyRelease(opts: VerifyReleaseOptions): Promise<void> {
  // Copy to temporary directory to avoid modifying the original
  core.debug(`Creating temporary directory`)
  const tempDir = await fs.mkdtemp(
    path.join(shell.tempdir(), 'pulumi-verify-release-')
  )
  core.debug(`Copying ${opts.directory} to ${tempDir}`)
  shell.cp('-r', opts.directory, tempDir)
  const wd = path.join(tempDir, path.basename(opts.directory))
  core.debug(`Temp working directory: ${wd}`)

  try {
    core.debug(`Creating stack "verify-release" in ${wd}`)
    const stack = await LocalWorkspace.createStack(
      {
        stackName: 'verify-release',
        workDir: wd
      },
      {
        workDir: opts.directory,
        // Force use of a local backend for isolation
        secretsProvider: 'passphrase',
        envVars: {
          PULUMI_CONFIG_PASSPHRASE: 'correct-horse-battery-staple',
          PULUMI_BACKEND_URL: buildBackendPath(tempDir),
          // Disable ambient plugins to ensure the correct provider version is downloaded in case there's a local build on the path
          PULUMI_IGNORE_AMBIENT_PLUGINS: 'true'
        }
      }
    )

    await installPackageVersion(wd, opts)

    core.debug(`Running pulumi preview`)
    const previewResult = await stack.preview({})
    core.debug(previewResult.stdout)
    core.debug(previewResult.stderr)
  } finally {
    core.debug(`Cleaning up temporary directory`)
    shell.rm('-rf', tempDir)
  }
}

async function installPackageVersion(
  wd: string,
  opts: VerifyReleaseOptions
): Promise<void> {
  switch (opts.language) {
    case 'nodejs':
      await installNpmPackageVersion(wd, opts)
      break
    case 'python':
      await installPipPackageVersion(wd, opts)
      break
    case 'dotnet':
      await installDotnetPackageVersion(wd, opts)
      break
    case 'go':
      await installGoPackageVersion(wd, opts)
      break
  }
}

async function installNpmPackageVersion(
  cwd: string,
  opts: VerifyReleaseOptions
): Promise<void> {
  const packageRef = `@${opts.publisher}/${opts.provider}`
  core.debug(`Removing any existing npm package: ${packageRef}`)
  shell.exec(`npm remove ${packageRef}`, { cwd })

  const packageVersionRef = `${packageRef}@${opts.packageVersion}`
  core.debug(`Installing npm package: ${packageVersionRef}`)
  shell.exec(`npm install ${packageVersionRef}`, { cwd, fatal: true })
}

async function installPipPackageVersion(
  cwd: string,
  opts: VerifyReleaseOptions
): Promise<void> {
  const packageRef = `${opts.publisher}-${opts.provider}`
  const vEnvCmd = `python3 -m venv venv`
  core.debug(`Creating virtualenv: ${vEnvCmd}`)
  if (shell.exec(vEnvCmd, { cwd, fatal: true }).code !== 0) {
    throw new Error('Failed to create virtualenv')
  }

  let pip = './venv/bin/pip'
  if (process.platform === 'win32') {
    pip = 'venv\\Scripts\\pip.exe'
  }

  const uninstallCmd = `${pip} uninstall -y ${packageRef}`
  core.debug(`Removing any existing pip package: ${uninstallCmd}`)
  if (shell.exec(uninstallCmd, { cwd }).code !== 0) {
    core.debug(`Failed to uninstall ${packageRef}`)
  }

  const packageVersionRef = `${packageRef}==${opts.packageVersion}`
  const installCmd = `${pip} install ${packageVersionRef}`
  core.debug(`Installing pip package: ${installCmd}`)
  if (shell.exec(installCmd, { cwd, fatal: true }).code !== 0) {
    throw new Error(`Failed to install ${packageVersionRef}`)
  }

  const installReqCmd = `${pip} install -r requirements.txt`
  core.debug(`Installing requirements.txt: installReqCmd`)
  if (shell.exec(installReqCmd, { cwd, fatal: true }).code !== 0) {
    throw new Error(`Failed to install requirements.txt`)
  }
}

async function installDotnetPackageVersion(
  cwd: string,
  opts: VerifyReleaseOptions
): Promise<void> {
  const packageRef = `${opts.publisher}.${opts.provider}`
  const removeCmd = `dotnet remove package ${packageRef}`
  core.debug(`Removing any existing dotnet package: ${removeCmd}`)
  const removeExec = shell.exec(removeCmd, { cwd })
  if (removeExec.code !== 0) {
    core.debug(
      `Failed to remove ${packageRef}: \n${removeExec.stderr}\n${removeExec.stdout}`
    )
  }

  const packageVersionRef = `${packageRef} --version ${opts.packageVersion}`
  const addCmd = `dotnet add package ${packageVersionRef}`
  core.debug(`Installing dotnet package: ${addCmd}`)
  const addExec = shell.exec(addCmd, { cwd, fatal: true })
  if (addExec.code !== 0) {
    throw new Error(
      `Failed to install ${packageVersionRef}: \n${addExec.stderr}\n${addExec.stdout}`
    )
  }
}

async function installGoPackageVersion(
  cwd: string,
  opts: VerifyReleaseOptions
): Promise<void> {
  const majorVersion = parseInt(opts.providerVersion.split('.')[0], 10)
  const moduleVersionSuffix = majorVersion >= 2 ? `/v${majorVersion}` : ''
  const packageRef = opts.goModuleTemplate
    .replace('{publisher}', opts.publisher)
    .replace('{provider}', opts.provider)
    .replace('{moduleVersionSuffix}', moduleVersionSuffix)
  const packageVersionRef = `${packageRef}@${opts.packageVersion}`
  const addCmd = `go get ${packageVersionRef}`
  core.debug(`Installing go package: ${addCmd}`)
  const addExec = shell.exec(addCmd, { cwd, fatal: true })
  if (addExec.code !== 0) {
    throw new Error(
      `Failed to install ${packageVersionRef}: \n${addExec.stderr}\n${addExec.stdout}`
    )
  }

  const modCmd = `go mod tidy`
  core.debug(`Tidying go modules: ${modCmd}`)
  const modExec = shell.exec(modCmd, { cwd, fatal: true })
  if (modExec.code !== 0) {
    throw new Error(
      `Failed to tidy go modules: \n${modExec.stderr}\n${modExec.stdout}`
    )
  }
}

function buildBackendPath(tempDir: string): string {
  // Check if we're running on windows
  if (process.platform === 'win32') {
    return `file://${tempDir.replace(/\\/g, '//')}`
  }
  return `file://${tempDir}`
}
