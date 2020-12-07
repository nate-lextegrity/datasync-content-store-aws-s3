import AWS from 'aws-sdk'
import Debug from 'debug'

import { buildAWSConfig, formatConfig } from './util'
// import { validateConfig } from './util/validations'

const debug = Debug('cs-s3-setup')

const factory = (s3: AWS.S3, method: string, config: any) => {
  debug(`${method} config: ${JSON.stringify(config)}`)

  return s3[method](config).promise().then((result) => {
    debug(`${method} result: ${JSON.stringify(result)}`)

    return result
  })
}

export const init = (config) => {
  return new Promise(async (resolve, reject) => {
    let s3: AWS.S3
    try {
      // validateConfig(config)
      config = formatConfig(config)
      const awsConfig = buildAWSConfig(config)
      s3 = new AWS.S3(awsConfig)

      // Step 1: Create bucket if it does not exist
      await s3.headBucket({ Bucket: config.bucketParams.Bucket }).promise()
        .catch((err) => {
          if (err) {
            if (err.statusCode == 409) {
              debug(`Bucket ${config.bucketParams.Bucket} has been created already and you don't have access`);
              throw (err)
            } else {
              return factory(s3, 'createBucket', config.bucketParams)
            }
          }
        })

      // Step 2: Set up bucket-versioning
      await factory(s3, 'putBucketVersioning', {
        Bucket: config.bucketName,
        VersioningConfiguration: { MFADelete: 'Disabled', Status: 'Enabled' },
      })

      // Step 3 (Optional): Setup bucket's CORS policy
      if (typeof config.CORSConfiguration === 'object' && !(config.CORSConfiguration instanceof Array)) {
        await factory(s3, 'putBucketCors', {
          Bucket: config.bucketName,
          CORSConfiguration: config.CORSConfiguration,
        })
      }

      // Step 4 (Optional): Setup bucket's access policy
      if (typeof config.Policy === 'object' && !(config.Policy instanceof Array)) {
        await factory(s3, 'putBucketPolicy', {
          Bucket: config.bucketName,
          Policy: JSON.stringify(config.Policy),
        })
      }

      return resolve(s3)
    } catch (error) {
      if (error.code) {
        if (error.code == 'OperationAborted') {
          debug(`Init: OperationAborted; bucket being created or recently deleted`)
          return resolve(s3)
        }
        else if (error.code == 'BucketAlreadyOwnedByYou') {
          debug(`Init: BucketAlreadyOwnedByYou; bucket already created and you own it`)
          return resolve(s3)
        }
      }
      return reject(error)
    }
  })
}
