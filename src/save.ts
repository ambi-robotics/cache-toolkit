import * as core from '@actions/core'
import * as utils from '@actions/cache/lib/internal/cacheUtils'
import * as path from 'path'
import { createTar, listTar } from '@actions/cache/lib/internal/tar'
import { UploadOptions } from '@actions/cache/lib/options'

import {
  ObjectStoreOptions,
  ValidationError,
  checkKey,
  checkPaths,
  getBucket,
  getClient,
} from './utils'

/**
 * Saves a list of files with the specified key
 *
 * @param paths a list of file paths to be cached
 * @param key an explicit key for restoring the cache
 * @param enableCrossOsArchive an optional boolean enabled to save cache on windows which could be restored on any platform (ignored)
 * @param options cache upload options (ignored)
 * @param objectStoreOptions object store access options
 * @returns number returns cacheId if the cache was saved successfully and throws an error if save fails
 */
export async function saveCache(
  paths: string[],
  key: string,
  options?: UploadOptions,
  enableCrossOsArchive = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  objectStoreOptions?: ObjectStoreOptions
): Promise<number> {
  objectStoreOptions ??= {}
  checkPaths(paths)
  checkKey(key)

  const compressionMethod = await utils.getCompressionMethod()

  const cachePaths = await utils.resolvePaths(paths)
  core.debug('Cache Paths:')
  core.debug(`${JSON.stringify(cachePaths)}`)

  if (cachePaths.length === 0) {
    throw new Error(
      `Path Validation Error: Path(s) specified in the action for caching do(es) not exist, hence no cache is being saved.`
    )
  }

  const archiveFolder = await utils.createTempDirectory()
  const cacheFileName = utils.getCacheFileName(compressionMethod)
  const archivePath = path.join(archiveFolder, cacheFileName)

  core.debug(`Archive Path: ${archivePath}`)

  try {
    await createTar(archiveFolder, cachePaths, compressionMethod)
    if (core.isDebug()) {
      await listTar(archivePath, compressionMethod)
    }
    const archiveFileSize = utils.getArchiveFileSizeInBytes(archivePath)
    core.debug(`File Size: ${archiveFileSize}`)

    const object = path.join(key, cacheFileName)
    const bucket = getBucket(objectStoreOptions)
    core.debug(`Uploading object ${object} to bucket ${bucket}`)

    const mc = getClient(objectStoreOptions)
    await mc.fPutObject(bucket, object, archivePath, {})
    core.debug(`Uploaded object ${object} to bucket ${bucket} successfully`)
  } catch (error) {
    const typedError = error as Error
    if (typedError.name === ValidationError.name) {
      throw error
    } else {
      core.warning(`Failed to save: ${typedError.message}`)
    }
  } finally {
    // Try to delete the archive to save space
    try {
      await utils.unlinkFile(archivePath)
    } catch (error) {
      core.debug(`Failed to delete archive: ${error}`)
    }
  }
  return 1
}
