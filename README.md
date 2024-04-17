# `@ambi-robotics/cache`

This package provides a drop-in replacement for the
[Github Actions cache toolkit functions](https://github.com/actions/toolkit/blob/main/packages/cache/README.md),
but allows for the use of S3-like storage backends via environment variable
configurations.

## Usage

### Save Cache

Saves a cache containing the files in `paths` using the `key` provided. The
files would be compressed using zstandard compression algorithm if zstd is
installed, otherwise gzip is used. Function returns the cache id if the cache
was saved succesfully and throws an error if cache upload fails.

```js
const cache = require('@ambi-robotics/cache')
const paths = ['node_modules', 'packages/*/node_modules/']
const key = 'npm-foobar-d5ea0750'
const cacheId = await cache.saveCache(paths, key, undefined, false, {
  bucket: 'actions-cache', // required
  port: 9000, // optional, default is 9000
  endPoint: 'play.min.io', // optional, default s3.amazon.aws
  accessKey: 'ASDFJKL', // required
  secretKey: 'zud+sdfjkewf', // required
  sessionToken: 'AQoDY', // optional
  region: 'us-east-1', // optional
  useSSL: true // optional, use http instead of https
})
```

### Restore Cache

Restores a cache based on `key` and `restoreKeys` to the `paths` provided.
Function returns the cache key for cache hit and returns undefined if cache not
found.

```js
const cache = require('@actions/cache')
const paths = ['node_modules', 'packages/*/node_modules/']
const key = 'npm-foobar-d5ea0750'
const restoreKeys = ['npm-foobar-', 'npm-']
const cacheKey = await cache.restoreCache(
  paths,
  key,
  restoreKeys,
  undefined,
  false,
  {
    bucket: 'actions-cache', // required
    port: 9000, // optional, default is 9000
    endPoint: 'play.min.io', // optional, default s3.amazon.aws
    accessKey: 'ASDFJKL', // required
    secretKey: 'zud+sdfjkewf', // required
    sessionToken: 'AQoDY', // optional
    region: 'us-east-1', // optional
    useSSL: true // optional, use http instead of https
  }
)
```

### Environment Variables

Rather than providing the S3 or minio configuration in each function call, you
can set environment variables for the main parameters.

- `bucket`: `ALT_GHA_CACHE_BUCKET`
- `port`: `ALT_GHA_CACHE_PORT`
- `accessKey`: `ALT_GHA_CACHE_ACCESS_KEY` or `AWS_ACCESS_KEY_ID`
- `secretKey`: `ALT_GHA_CACHE_SECRET_KEY` or `AWS_SECRET_ACCESS_KEY`
- `sessionToken`: `ALT_GHA_CACHE_SESSION_TOKEN` or `AWS_SESSION_TOKEN`
- `region`: `ALT_GHA_CACHE_REGION` or `AWS_REGION`
- `useSSL`: `ALT_GHA_CACHE_USE_SSL`
