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
var uuid = require('node-uuid');
var gm = require('gm').subClass({
  imageMagick: true
});
var Cloudant = require('cloudant');

/**
 * This action is invoked when new check images are found in object storage.
 * This action is idempotent. If it fails, it can be retried.
 *
 * 1. Retrieve the image from object storage
 * 2. Resize the image into two additional copies at 50% and 25%
 * 3. Store the resized images into an archive database for use by other applications
 * 4. Store the original image into an audit database to initiate the OCR scan in another action
 *
 * @param   params.CLOUDANT_USER                   Cloudant username
 * @param   params.CLOUDANT_PASS                   Cloudant password
 * @param   params.CLOUDANT_ARCHIVED_DATABASE      Cloudant database to store the resized copies to
 * @param   params.CLOUDANT_AUDITED_DATABASE       Cloudant database to store the original copy to
 * @param   params.SWIFT_USER_ID                   Object storage user id
 * @param   params.SWIFT_PASSWORD                  Object storage password
 * @param   params.SWIFT_PROJECT_ID                Object storage project id
 * @param   params.SWIFT_REGION_NAME               Object storage region
 * @param   params.SWIFT_INCOMING_CONTAINER_NAME   Object storage container where the image is
 * @return                                         Standard OpenWhisk success/error response
 */
function main(params) {
  console.log("Processing one file", params);

  var wsk = openwhisk();

  // Configure database connection
  var cloudant = new Cloudant({
    account: params.CLOUDANT_USER,
    password: params.CLOUDANT_PASS
  });
  var auditedDb = cloudant.db.use(params.CLOUDANT_AUDITED_DATABASE);
  var archivedDb = cloudant.db.use(params.CLOUDANT_ARCHIVED_DATABASE);

  // Configure object storage connection
  var os = new ObjectStorage(
    params.SWIFT_REGION_NAME,
    params.SWIFT_PROJECT_ID,
    params.SWIFT_USER_ID,
    params.SWIFT_PASSWORD
  );

  // Names to use for the 50% and 25% scaled images
  var medFileName = "300px-" + params.fileName;
  var smFileName = "150px-" + params.fileName;
  var imageRootFolder = "checks-images";
  var imageContainerFolder = imageRootFolder + "/" + params.SWIFT_INCOMING_CONTAINER_NAME;
  var imageBranchFolder = imageContainerFolder + "/" + params.branchFolder;
  if (!fs.existsSync(imageRootFolder))
    fs.mkdirSync(imageRootFolder, 600);
  if (!fs.existsSync(imageContainerFolder))
    fs.mkdirSync(imageContainerFolder, 600);
  if (!fs.existsSync(imageBranchFolder))
    fs.mkdirSync(imageBranchFolder, 600);
  var imageFolder = imageBranchFolder;

  var rootDirectory;

  // This chains together the following functions serially, so that if there's an error along the way,
  // the check isn't deleted and this can be called again idempotently.
  return new Promise(function(resolve, reject) {
    async.waterfall([
        // Authenticate to object storage
        function(callback) {
          rootDirectory = __dirname + "/" + imageFolder;
          console.log("Authenticating...");
          os.authenticate(function(err, response, body) {
            return callback(err);
          });
        },

        // Get the file on disk as a temp file
        function(callback) {
          console.log("Downloading", params.fileName);
          os.downloadFile(params.SWIFT_INCOMING_CONTAINER_NAME, params.branchFolder + ":" + params.fileName, fs.createWriteStream(rootDirectory + "/" + params.fileName), function(err) {
            return callback(err);
          });
        },

        // Copy and resize the file to two smaller versions
        function(callback) {

          // Inject this into String
          // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
          if (!String.prototype.endsWith) {
            String.prototype.endsWith = function(searchString, position) {
              var subjectString = this.toString();
              if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
                position = subjectString.length;
              }
              position -= searchString.length;
              var lastIndex = subjectString.indexOf(searchString, position);
              return lastIndex !== -1 && lastIndex === position;
            };
          }

          console.log("Creating resized images.");
          if (params.fileName.toLowerCase().endsWith(".bmp") || params.fileName.toLowerCase().endsWith(".jpg") || params.fileName.toLowerCase().endsWith(".png")) {
            console.log("Resizing image to 300px wide - storing it in " + rootDirectory);
            gm(rootDirectory + "/" + params.fileName).resize(300).write(rootDirectory + "/" + medFileName, function(err) {
              if (err) {
                console.log("[KO - RESIZE 300]", err);
                return callback(null);
              } else {
                console.log("Resizing image to 150px wide - storing it in " + rootDirectory);
                gm(rootDirectory + "/" + params.fileName).resize(150).write(rootDirectory + "/" + smFileName, function(err) {
                  if (err) {
                    console.log("[KO - RESIZE 150]", err);
                    return callback(null);
                  } else {
                    console.log("Reading folder content after resizing...");
                    fs.readdir(rootDirectory, null, function(err, files) {
                      files.forEach(function(file) {
                        console.log("File: " + file);
                      });
                    });
                    return callback(null);
                  }
                });
              }
            });
          } else {
            return callback("File is not an image.");
          }
        },

        // Open original file to memory and send it to the next function
        function(callback) {
          console.log("Opening original file");
          fs.readFile(rootDirectory + "/" + params.fileName, function(err, data) {
            if (err) {
              console.log("Error reading original file.");
              return callback(err);
            } else {
              console.log("Success reading original file.");
              return callback(null, data);
            }
          });
        },

        // Save original image data to Cloudant with an enriched name
        function(data, callback) {
          var uuid1 = uuid.v1();
          var attachmentName = "att-" + uuid1;
          console.log("Attempting insert of original image into the audited database. Id = " + uuid1);

          var values = params.fileName.split('^');
          var email = values[0];
          var toAccount = values[1];
          var amount = values[2];

          auditedDb.multipart.insert({
              fileName: params.fileName,
              attachmentName: attachmentName,
              email: email,
              toAccount: toAccount,
              amount: amount,
              timestamp: (new Date()).getTime()
            }, [{
              name: attachmentName,
              data: data,
              content_type: params.contentType
            }],
            uuid1,
            function(err, body) {
              if (err && err.statusCode != 409) {
                console.log("Error with original file insert.");
                return callback(err);
              } else {
                console.log("Success with original file insert.");
                return callback(null);
              }
            }
          );
        },

        // Open medium file to memory and send it to the next function
        function(callback) {
          console.log("Opening medium file");
          fs.readFile(rootDirectory + "/" + medFileName, function(err, data) {
            if (err) {
              console.log("Error reading medium file.");
              return callback(null);
            } else {
              console.log("Success reading medium file.");
              return callback(null, data);
            }
          });
        },

        // Save medium file to Cloudant with an enriched name
        function(data, callback) {
          if (!data) return callback(null);
          console.log("Attempting Cloudant insert of medium image into the archived database.");
          var uuid1 = uuid.v1();
          var attachmentName = uuid.v1(); //I'd rather use a simple md5 hash, but it's not available
          archivedDb.multipart.insert({
              fileName: medFileName,
              attachmentName: attachmentName
            }, [{
              name: attachmentName,
              data: data,
              content_type: params.contentType
            }],
            uuid1,
            function(err, body) {
              if (err && err.statusCode != 409) {
                console.log("Error with Cloudant medium insert.");
                return callback(err);
              } else {
                console.log("Success with Cloudant medium file insert.");
                return callback(null);
              }
            }
          );
        },

        // Open small file to memory and send it to the next function
        function(callback) {
          console.log("Opening small file");
          fs.readFile(rootDirectory + "/" + smFileName, function(err, data) {
            if (err) {
              console.log("Error reading small file.");
              return callback(null);
            } else {
              console.log("Success reading small file.");
              return callback(null, data);
            }
          });
        },

        // Save small file to Cloudant with an enriched name
        function(data, callback) {
          if (!data) return callback(null);

          console.log("Attempting Cloudant insert of small image into the archived database.");
          var uuid1 = uuid.v1();
          var attachmentName = uuid.v1(); //I'd rather use a simple md5 hash, but it's not available
          archivedDb.multipart.insert({
              fileName: smFileName,
              attachmentName: attachmentName
            }, [{
              name: attachmentName,
              data: data,
              content_type: params.contentType
            }],
            uuid1,
            function(err, body) {
              if (err && err.statusCode != 409) {
                console.log("Error with Cloudant small file insert.");
                return callback(err);
              } else {
                console.log("Success with Cloudant small file insert.");
                return callback(null);
              }
            }
          );
        },

        // When all the steps above have completed successfully, delete the file from the incoming folder
        function(callback) {
          console.log("Deleting processed file from", params.SWIFT_INCOMING_CONTAINER_NAME);
          os.deleteFile(params.SWIFT_INCOMING_CONTAINER_NAME, params.branchFolder + "/" + params.fileName, callback, function(err) {
            if (err) {
              return callback(err);
            } else {
              return callback(null);
            }
          });
        }

      ],
      function(err, result) {
        if (err) {
          console.log("Error", err);
          reject(err);
        } else {
          resolve({
            status: "Success"
          });
        }
      }
    );
  });
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
      if (callback) {
        callback(err, response, body);
      }
    });
  };

  self.downloadFile = function(container, file, outputStream, callback) {
    request({
      uri: self.baseUrl + container + "/" + file,
      method: 'GET',
      headers: {
        "X-Auth-Token": self.token,
        "Accept": "application/json"
      }
    }).pipe(outputStream).on('close', function() {
      callback(null);
    });
  };

  self.uploadFile = function(container, file, inputStream, callback) {
    inputStream.pipe(
      request({
        uri: self.baseUrl + container + "/" + file,
        method: 'PUT',
        headers: {
          "X-Auth-Token": self.token,
          "Accept": "application/json"
        }
      }, function(err, response, body) {
        callback(err);
      }));
  };

  self.deleteFile = function(container, file, callback) {
    request({
      uri: self.baseUrl + container + "/" + file,
      method: 'DELETE',
      headers: {
        "X-Auth-Token": self.token,
        "Accept": "application/json"
      }
    }, function(err, response, body) {
      callback(err);
    });
  };

}