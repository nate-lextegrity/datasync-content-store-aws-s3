"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const debug_1 = __importDefault(require("debug"));
const util_1 = require("./util");
const debug = debug_1.default('cs-s3-setup');
const factory = (s3, method, config) => {
    debug(`${method} config: ${JSON.stringify(config)}`);
    return s3[method](config).promise().then((result) => {
        debug(`${method} result: ${JSON.stringify(result)}`);
        return result;
    });
};
exports.init = (config) => {
    return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
        let s3;
        try {
            config = util_1.formatConfig(config);
            const awsConfig = util_1.buildAWSConfig(config);
            s3 = new aws_sdk_1.default.S3(awsConfig);
            yield s3.headBucket({ Bucket: config.bucketParams.Bucket }).promise()
                .catch((err) => {
                if (err) {
                    if (err.statusCode == 409) {
                        debug(`Bucket ${config.bucketParams.Bucket} has been created already and you don't have access`);
                        throw (err);
                    }
                    else {
                        return factory(s3, 'createBucket', config.bucketParams);
                    }
                }
            });
            yield factory(s3, 'putBucketVersioning', {
                Bucket: config.bucketName,
                VersioningConfiguration: { MFADelete: 'Disabled', Status: 'Enabled' },
            });
            if (typeof config.CORSConfiguration === 'object' && !(config.CORSConfiguration instanceof Array)) {
                yield factory(s3, 'putBucketCors', {
                    Bucket: config.bucketName,
                    CORSConfiguration: config.CORSConfiguration,
                });
            }
            if (typeof config.Policy === 'object' && !(config.Policy instanceof Array)) {
                yield factory(s3, 'putBucketPolicy', {
                    Bucket: config.bucketName,
                    Policy: JSON.stringify(config.Policy),
                });
            }
            return resolve(s3);
        }
        catch (error) {
            if (error.code) {
                if (error.code == 'OperationAborted') {
                    debug(`Init: OperationAborted; bucket being created or recently deleted`);
                    return resolve(s3);
                }
                else if (error.code == 'BucketAlreadyOwnedByYou') {
                    debug(`Init: BucketAlreadyOwnedByYou; bucket already created and you own it`);
                    return resolve(s3);
                }
            }
            return reject(error);
        }
    }));
};
