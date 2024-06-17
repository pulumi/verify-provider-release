/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as main from '../src/main'

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Mock the GitHub Actions core library
let debugMock: jest.SpiedFunction<typeof core.debug>
let errorMock: jest.SpiedFunction<typeof core.error>
let getInputMock: jest.SpiedFunction<typeof core.getInput>
let setFailedMock: jest.SpiedFunction<typeof core.setFailed>
let setOutputMock: jest.SpiedFunction<typeof core.setOutput>

describe('action', () => {
  // Increase the Jest timeout to 30 seconds as we're download dependencies
  jest.setTimeout(120 * 1000)

  beforeEach(() => {
    jest.clearAllMocks()

    debugMock = jest.spyOn(core, 'debug').mockImplementation()
    errorMock = jest.spyOn(core, 'error').mockImplementation()
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()
  })

  it('nodejs setup', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'language':
          return 'nodejs'
        case 'directory':
          return '__tests__/programs/random-nodejs'
        case 'provider':
          return 'random'
        case 'providerVersion':
          return '4.16.2'
        case 'publisher':
          return 'pulumi'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    expect(setFailedMock).not.toHaveBeenCalled()
    expect(errorMock).not.toHaveBeenCalled()
    expect(debugMock).toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledTimes(0)
  })

  it('python setup', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'language':
          return 'python'
        case 'directory':
          return '__tests__/programs/random-python'
        case 'provider':
          return 'random'
        case 'providerVersion':
          return '4.16.2'
        case 'publisher':
          return 'pulumi'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    expect(setFailedMock).not.toHaveBeenCalled()
    expect(errorMock).not.toHaveBeenCalled()
    expect(debugMock).toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledTimes(0)
  })

  it('dotnet setup', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'language':
          return 'dotnet'
        case 'directory':
          return '__tests__/programs/random-dotnet'
        case 'provider':
          return 'random'
        case 'providerVersion':
          return '4.16.2'
        case 'publisher':
          return 'pulumi'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    expect(setFailedMock).not.toHaveBeenCalled()
    expect(errorMock).not.toHaveBeenCalled()
    expect(debugMock).toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledTimes(0)
  })

  it('go setup', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'language':
          return 'go'
        case 'directory':
          return '__tests__/programs/random-go'
        case 'provider':
          return 'random'
        case 'providerVersion':
          return '4.16.2'
        case 'packageVersion':
          return 'v4.16.2'
        case 'publisher':
          return 'pulumi'
        case 'goModuleTemplate':
          return 'github.com/{publisher}/pulumi-{provider}/sdk{moduleVersionSuffix}'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    expect(setFailedMock).not.toHaveBeenCalled()
    expect(errorMock).not.toHaveBeenCalled()
    expect(debugMock).toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledTimes(0)
  })

  it('invalid language', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'language':
          return 'this is not a language'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'Unsupported language: this is not a language'
    )
    expect(errorMock).not.toHaveBeenCalled()
  })

  it('directory does not exist', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'language':
          return 'nodejs'
        case 'directory':
          return '__tests__/programs/nonexistent'
        case 'provider':
          return 'random'
        case 'providerVersion':
          return '4.16.2'
        case 'publisher':
          return 'pulumi'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      "Can't access directory __tests__/programs/nonexistent: Error: ENOENT: no such file or directory, access '__tests__/programs/nonexistent'"
    )
    expect(errorMock).not.toHaveBeenCalled()
  })

  it('invalid provider version', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'language':
          return 'nodejs'
        case 'directory':
          return '__tests__/programs/random-nodejs'
        case 'provider':
          return 'random'
        case 'providerVersion':
          return 'not a version'
        case 'publisher':
          return 'pulumi'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'Invalid provider version: not a version'
    )
    expect(errorMock).not.toHaveBeenCalled()
  })
})
