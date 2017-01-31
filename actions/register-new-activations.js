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
var Cloudant = require('cloudant');
var async = require('async');
var request = require('request');

/**
 * This action is triggered by a new check image added to a CouchDB database.
 * This action is idempotent. If it fails, it can be retried.
 *
 * 1. Fetch the record from the 'audited' database and find its attachment along with
 *    deposit to and account information.
 * 2. Process the image for deposit to account, routing number and move it to
 *    another 'parsed' database with metadata and a confidence score.
 *
 * @param   params._id                        The id of the inserted record in the Cloudant 'audit' database that triggered this action
 * @param   params.CLOUDANT_USER              Cloudant username
 * @param   params.CLOUDANT_PASS              Cloudant password
 * @param   params.CLOUDANT_ACTIVATION_DATABASE  Cloudant database to store the original copy to
 * @param   params.CURRENT_NAMESPACE          The current namespace so we can call the OCR action by name
 * @return                                    Standard OpenWhisk success/error response
 */
function main(params) {

  // Configure database connection
  console.log(params);
  var cloudant = new Cloudant({
    account: params.CLOUDANT_USER,
    password: params.CLOUDANT_PASS
  });
  var activationsDb = cloudant.db.use(params.CLOUDANT_ACTIVATION_DATABASE);

  var actionName;
  var timeMs;
  var uuid1;

    async.waterfall([
      // Insert data into the parsed database.
      function (callback) {
        
        request({
            url: 'https://8023f207-bcf8-433a-843d-e7eb144757b3:qbYrKqW0TxSr9n980cHi0nRT6EgcFv6nalvENWAeVYrH5cEuYV62X6KFiwaW3TWx@openwhisk.ng.bluemix.net/api/v1/namespaces/_/activations',
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          }, function(err, response, body) {
            if (err) {
              console.log('[register-new-activations.main] error: ');
              console.log(err);
              return callback(err);
            } else {
              console.log('[record-check-deposit.main] success: ');
              console.log(body);
              return callback(null);
            }
          });
      }, function(activations, callback) {
          if (!activations) return callback(new Error("no activations object"));
          console.log();
          if (typeof activations.length === "undefined") return callback(new Error("weird activation object"));
          
        
          uuid1 = uuid.v1();
          activationsDb.insert({
              _id: uuid1,
              actionName: actionName,
              timeMs: timeMs
            },
            function (err, body, head) {
              if (err) {
                console.log('[parse-check-data.main] error: parsedDb');
                console.log(err);
                return callback(err);
              } else {
                console.log('[parse-check-data.main] success: parsedDb');
                console.log(body);
                return callback(null);
              }
            }
          );
      }
    ],
      function (err, result) {
        if (err) {
          console.log("[KO]", err);
        } else {
          console.log("[OK]");
        }
        whisk.done(null, err);
      }
    );


  return whisk.async();
}