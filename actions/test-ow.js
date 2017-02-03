/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var openwhisk = require('openwhisk');

/**
 * This action is triggered by a new check image added to a CouchDB database.
 * This action is idempotent. If it fails, it can be retried.
 *
 * 1. Fetch the record from the 'audited' database and find its attachment along with
 *    deposit to and account information.
 * 2. Process the image for deposit to account, routing number and move it to
 *    another 'parsed' database with metadata and a confidence score.
 *
 * @param   params.CLOUDANT_USER              Cloudant username
 * @param   params.CLOUDANT_PASS              Cloudant password
 * @param   params.CLOUDANT_HOST              host:port of the http cloudant database
 * @param   params.CLOUDANT_LAST_SEQUENCE_DATABASE  
 * @param   params.CLOUDANT_AUDITED_DATABASE  Cloudant database to store the original copy to
 * @param   params.CLOUDANT_PARSED_DATABASE   Cloudant database to store the parsed check data to
 * @param   params.CLOUDANT_REJECTED_DATABASE Cloudant database to store the rejected check data to
 * @param   params.CURRENT_NAMESPACE          The current namespace so we can call the OCR action by name
 * @return                                    Standard OpenWhisk success/error response
 */
function main(params) {
    console.log(params);
    
    var API_KEY = process.env.OW_API_KEY || process.env.__OW_API_KEY;
    var API_URL = process.env.OW_API_URL || process.env.__OW_API_HOST;
    var NAMESPACE = process.env.OW_NAMESPACE || process.env.__OW_NAMESPACE;
    var owparams = {api: API_URL, api_key: API_KEY, namespace: NAMESPACE}
    console.log(owparams);
    var ow = openwhisk(owparams);
    ow.actions.list().then(function (actions) {
        console.log(actions);
    }).catch(function(reason) { console.log("wtf?", reason); });
    return { done: true};
}
