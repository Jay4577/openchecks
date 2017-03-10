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
var request = require('request');
var async = require('async');
var fs = require('fs');
var path = require('path');

/**
 * This action is triggered by a new check image added to object storage, or in this case a CouchDB database.
 * This action is idempotent. If it fails, it can be retried.
 *
 * 1. Fetch the record from the 'incoming' database and find its attachment.
 * 2. Process the image for account, routing number, and amount move it to another 'processed' database with metadata and a confidence score.
 *
 * @param   params.id                 The id of the record in the Cloudant 'processed' database
 * @param   params.CLOUDANT_USER      Cloudant username (set once at action update time)
 * @param   params.CLOUDANT_PASS      Cloudant password (set once at action update time)
 * @param   params.SENDGRID_API_KEY   Cloudant password (set once at action update time)
 * @return                            Standard OpenWhisk success/error response
 */
function main(params) {
  console.log("Retrieving file list");

  var wsk = openwhisk();

  // Configure object storage connection
  var os = new ObjectStorage(
    params.SWIFT_REGION_NAME,
    params.SWIFT_PROJECT_ID,
    params.SWIFT_USER_ID,
    params.SWIFT_PASSWORD
  );

  return new Promise(function(resolve, reject) {
    os.authenticate(function(err, response, body) {
      if (err) {
        console.log("Authentication failure", err);
        reject(null, err);
      } else {
        os.listFiles(params.SWIFT_INCOMING_CONTAINER_NAME, function(err, response, files) {
          console.log(files);
          console.log("Found", files.length, "files");

          var tasks = files.map(function(file) {
            return function(callback) {
              var filePathPieces = file.name.split(path.sep);
              if (filePathPieces.length !== 2) {
                return callback(null);
              } else {
                asyncCallSaveCheckImagesAction(
                  "/_/save-check-images",
                  filePathPieces[0],
                  filePathPieces[1],
                  file.content_type,
                  file.last_modified,
                  callback
                );
              }
            };
          });

          async.waterfall(tasks, function(err, result) {
            if (err) {
              console.log("Error", err);
              reject(err);
            } else {
              resolve({
                status: "Success"
              });
            }
          });

        });

      }

    });
  });

}

/**
 * This function provides a way to invoke other OpenWhisk actions directly and asynchronously
 *
 * @param   actionName    The id of the record in the Cloudant 'processed' database
 * @param   branchFolder  Cloudant path to store image of this branch (only 1 folder depth allowed)
 * @param   fileName      Cloudant username (set once at action update time)
 * @param   contentType   Cloudant password (set once at action update time)
 * @param   lastModified  Cloudant password (set once at action update time)
 * @param   callback      Cloudant password (set once at action update time)
 * @return                The reference to a configured object storage instance
 */
function asyncCallSaveCheckImagesAction(actionName, branchFolder, fileName, contentType, lastModified, callback) {
  console.log("Calling", actionName, "for", fileName);

  var wsk = openwhisk();

  wsk.actions.invoke({
      "actionName": actionName,
      "params": {
        branchFolder: branchFolder,
        fileName: fileName,
        contentType: contentType,
        lastModified: lastModified
      }
    }).then(
      function(activation) {
        console.log(actionName, "[activation]", activation);
        callback(null);
      }
    ).catch(
      function(error) {
        console.log(actionName, "[error]", error);
        callback(error);
      }
  );

}

/**
 * This is an adapter class for OpenStack Swift based object storage.
 *
 * @param   region      The id of the record in the Cloudant 'processed' database
 * @param   projectId   Cloudant username (set once at action update time)
 * @param   userId      Cloudant password (set once at action update time)
 * @param   password    Cloudant password (set once at action update time)
 * @return              The reference to a configured object storage instance
 */
function ObjectStorage(region, projectId, userId, password) {
  var self = this;

  if (region === "dallas") {
    self.baseUrl = "https://dal.objectstorage.open.softlayer.com/v1/AUTH_" + projectId + "/";
  } else if (region == "london") {
    self.baseUrl = "https://lon.objectstorage.open.softlayer.com/v1/AUTH_" + projectId + "/";
  } else {
    throw new Error("Invalid Region");
  }

  self.authenticate = function(callback) {
    request({
      uri: "https://identity.open.softlayer.com/v3/auth/tokens",
      method: 'POST',
      json: {
        "auth": {
          "identity": {
            "methods": [
              "password"
            ],
            "password": {
              "user": {
                "id": userId,
                "password": password
              }
            }
          },
          "scope": {
            "project": {
              "id": projectId
            }
          }
        }
      }
    }, function(err, response, body) {
      if (!err) {
        self.token = response.headers["x-subject-token"];
      }
      callback(err, response, body);
    });
  };

  self.listFiles = function(container, callback) {
    request({
      uri: self.baseUrl + container,
      method: 'GET',
      headers: {
        "X-Auth-Token": self.token,
        "Accept": "application/json"
      },
      json: true
    }, callback);
  };
}