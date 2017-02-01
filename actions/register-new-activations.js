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
var activationPendingRegistering = 0;
var stillRegisteringActivations = false;
var activationRegistryError = null;

/**
 * register-new-activations - This action is triggered by a new check image added to a CouchDB database.
 * This action is idempotent. If it fails, it can be retried.
 *
 * 1. Fetch the record from the 'audited' database and find its attachment along with
 *    deposit to and account information.
 * 2. Process the image for deposit to account, routing number and move it to
 *    another 'parsed' database with metadata and a confidence score.
 *
 * @param   params.CLOUDANT_USER              Cloudant username
 * @param   params.CLOUDANT_PASS              Cloudant password
 * @param   params.CLOUDANT_ACTIVATION_DATABASE  Cloudant database to store the original copy to
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

  var actionName, activationId;
  var timeMs;
  //var watchedActions = ["alarm", "parse-check-with-ocr", "find-new-checks", "parse-check-data", "read", "record-check-deposit", "save-check-images"];
  var watchedActions = ["parse-check-data"];
  var owApiActivationsUrl = 'https://8023f207-bcf8-433a-843d-e7eb144757b3:qbYrKqW0TxSr9n980cHi0nRT6EgcFv6nalvENWAeVYrH5cEuYV62X6KFiwaW3TWx@openwhisk.ng.bluemix.net/api/v1/namespaces/_/activations';
  
    async.waterfall([
      // Insert data into the parsed database.
      function (callback) {
        
        request({
            url: owApiActivationsUrl + "?limit=300",
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
              return callback(null,JSON.parse(body));
            }
          });
      }, function(activations, callback) {
          if (!activations) return callback(new Error("no activations object"));
          if (typeof activations.length === "undefined") return callback(new Error("weird activation object"));
          if (activations.length === 0) return callback(null);
          
          console.log("Found " + activations.length + " activations.");
          
          var queueMilliseconds = 0;
          for(var i = 0; i<activations.length; i++) {
              stillRegisteringActivations = true;
              var activation = activations[i];
              actionName = activation.name;
              activationId = activation.activationId;
              
              if (watchedActions.indexOf(actionName) >= 0) {
                //delaying the insert as cloudant lite is limited to 10 per sec.
                activationPendingRegistering++;
                setTimeout(function(activationId, actionName) { return function() {
                    console.log("Now getting detailled information for activationid " + activationId + " for action name " + actionName);
                    request({
                      url: owApiActivationsUrl + "/" + activationId,
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json'
                      }
                    }, function(err, response, body) {
                      if (err) {
                        console.log('[register-new-activations.individualget] error: ');
                        console.log(err);
                        activationRegistryError = err;
                        stillRegisteringActivations = false;
                        activationPendingRegistering = 0;
                      } else {
                        timeMs = JSON.parse(body).duration;
                        console.log("About to register action " + actionName + " that took " + timeMs + "ms to complete...");
                        registerActivation(activationsDb,activationId, actionName, timeMs, callback);
                      }
                    });
                }}(activationId, actionName), queueMilliseconds);
                queueMilliseconds = queueMilliseconds+120;
              } else {
                  console.log("Action " + actionName + " is out of scope, skipping...");
                  //console.log(activation);
              }
          }
          stillRegisteringActivations = false;
          if (activationPendingRegistering === 0 && !stillRegisteringActivations) return callback(activationRegistryError);
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

function registerActivation(db, activationId, activationName, timeMs, callback) {
    db.insert({
     _id: activationId,
     actionName: activationName,
     timeMs: timeMs,
     timestamp: (new Date()).toISOString()
   },
   function (err, body, head) {
     if (err) { 
       if (err.statusCode == 409) {
          console.log('Activation id already exists, continuing...');
          activationPendingRegistering--;
       } else {
        stillRegisteringActivations = false;
        activationPendingRegistering = 0;
        console.log('[registerActivation] error: activationDb');
        console.log(err);
        activationRegistryError = err;
       }
     } else {
        //console.log('[registerActivation] success: activationDb');
        //console.log(body);
        activationPendingRegistering--;
     }
     if (activationPendingRegistering === 0 && !stillRegisteringActivations) return callback(activationRegistryError);
   }
 );
}