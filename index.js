
// import
var config = require("config");
var adal = require("adal-node");
var request = require("request");
var q = require("q");
var xml2js = require("xml2js");
var process = require("process");
var fs = require("fs");
var csv = require("fast-csv");

// set global variables
var authority = config.get("authority");
var directory = config.get("directory");
var clientId = config.get("clientId");
var username = config.get("username");
var password = config.get("password");

// build an object to handle querying the Azure AD graph
var azureGraph = {
    
    prefix: "https://graph.windows.net/" + directory,
    token: null,
    
    getAuthentication: function() {
        var deferred = q.defer();
        var me = this;
        if (me.token) {
            deferred.resolve({ "auth": { "bearer": me.token } });
        } else {
            var context = new adal.AuthenticationContext(authority + directory);
            context.acquireTokenWithUsernamePassword("https://graph.windows.net/", username, password, clientId, function(error, tokenResponse) {
                if (!error) {
                    me.token = tokenResponse.accessToken;
                    deferred.resolve({ "auth": { "bearer": me.token } });
                } else {
                    console.log("error(109): " + error);
                    deferred.reject();
                }
            });
        }
        return deferred.promise;
    },

    get: function(id) {
        var deferred = q.defer();
        var me = this;
        
        // accept an array or convert to one
        if (!Array.isArray(id)) id = [id];
        
        // authenticate
        me.getAuthentication().then(function(auth) {
    
            // request the items
            var options = {
                uri: me.prefix + "/getObjectsByObjectIds?api-version=1.6",
                json: true,
                headers: {
                    "Authorization": "bearer " + me.token  
                },
                body: { "objectIds": id }
            };
            request.post(options, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    deferred.resolve(body.value);
                } else {
                    if (error) { console.log("error(120): " + error) } else { console.log("error(121)"); console.log(body); };
                    deferred.reject();
                }
            });
        });
        
        return deferred.promise;
    }
    
}

var azureManager = {

    prefix: "https://management.azure.com",
    token: null,
    
    getAuthentication: function() {
        var deferred = q.defer();
        var me = this;
        if (me.token) {
            deferred.resolve({ "auth": { "bearer": me.token } });
        } else {
            var context = new adal.AuthenticationContext(authority + directory);
            context.acquireTokenWithUsernamePassword("https://management.core.windows.net/", username, password, clientId, function(error, tokenResponse) {
                if (!error) {
                    me.token = tokenResponse.accessToken;
                    deferred.resolve({ "auth": { "bearer": me.token } });
                } else {
                    console.log("error(102): " + error);
                    deferred.reject();
                }
            });
        }
        return deferred.promise;
    },
    
    getSubscriptions: function() {
        var deferred = q.defer();
        var me = this;
        me.getAuthentication().then(function(auth) {
            request.get(me.prefix + "/subscriptions?api-version=2015-01-01", auth, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    var subscriptions = JSON.parse(body);
                    deferred.resolve(subscriptions.value);
                } else {
                    if (error) { console.log("error(105): " + error) } else { console.log("error(106): " + body) };
                    deferred.reject();
                }
            });
        }, function() {
            deferred.reject();
        });
        return deferred.promise;
    },

    get: function(id) {
        var deferred = q.defer();
        var me = this;
        me.getAuthentication().then(function(auth) {
            request.get(me.prefix + id + "?api-version=2015-07-01", auth, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    var obj = JSON.parse(body);
                    deferred.resolve(obj);
                } else {
                    if (error) { console.log("error(111): " + error) } else { console.log("error(112): " + body) };
                    deferred.reject();
                }
            });
        }, function() {
            deferred.reject();
        });
        return deferred.promise;
    },

    getAssignmentsFromServiceManager: function(subscriptionId) {
        var deferred = q.defer();
        var me = this;
        var assignments = [];
        
        me.getAuthentication().then(function(auth) {
            request.get({
                "uri": "https://management.core.windows.net/" + subscriptionId + "/principals",
                "headers": {
                    "Authorization": "bearer " + me.token,
                    "x-ms-version": "2015-04-01"
                }
            }, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    xml2js.parseString(body, function(error, c) {
                        c.Principals.Principal.forEach(function(o) {
                            assignments.push({
                                "scope": "/subscriptions/" + subscriptionId,
                                "principal": o.Email[0],
                                "role": o.Role.join(";")
                            });
                        });
                    });
                    deferred.resolve(assignments);
                } else {
                    if (error) { console.log("error(122): " + error) } else { console.log("error(123)"); console.log(body); };
                    deferred.reject();
                }
            });
        }, function() {
           deferred.reject(); 
        });
        
        return deferred.promise;
    },
    
    getAssignmentsFromResourceManager: function(subscriptionId) {
        var deferred = q.defer();
        var me = this;
        var assignments = [];

        me.getAuthentication().then(function(auth) {
            request.get(me.prefix + "/subscriptions/" + subscriptionId + "/providers/Microsoft.Authorization/roleAssignments?api-version=2015-07-01", auth, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    var c = JSON.parse(body);
                    c.value.forEach(function(o) {
                        assignments.push({
                            "scope": o.properties.scope,
                            "principal": o.properties.principalId,
                            "role": o.properties.roleDefinitionId
                        });
                    });
                    deferred.resolve(assignments);
                } else {
                    if (error) { console.log("error(113): " + error) } else { console.log("error(114): " + body) };
                    deferred.reject();
                }
            });
        }, function(error) {
            deferred.reject();
        });

        return deferred.promise;
    },

    getAssignments: function(subscriptionId) {
        var deferred = q.defer();
        var me = this;
        me.getAuthentication().then(function(auth) {
            var assignments = [];
            var promises = [];
        
            // get administrators / co-administrators
            promises.push(
                me.getAssignmentsFromServiceManager(subscriptionId).then(function(partial) {
                  assignments = assignments.concat(partial);  
                })
            );
        
            // get roles-based assignments
            promises.push(
                me.getAssignmentsFromResourceManager(subscriptionId).then(function(partial) {
                    assignments = assignments.concat(partial);
                })
            );

            // wait for both to finish            
            q.all(promises).finally(function() {
                deferred.resolve(assignments);
            });
            
        }, function() {
            deferred.reject();
        });
        
        return deferred.promise;
    },

    getAllAssignments: function() {
        var deferred = q.defer();
        var me = this;
        me.getAuthentication().then(function(auth) {
            
            // get a list of subscriptions
            me.getSubscriptions().then(function(subscriptions) {

                // query each subscription
                subscriptions.forEach(function(subscription) {
                    
                    // get a list of assignments
                    me.getAssignments(subscription.subscriptionId).then(function(assignments) {
                        
                        // compile a list of principals
                        var principals = [];
                        assignments.forEach(function(assignment) {
                            if (assignment.principal.indexOf("@") > -1) {
                                // email address
                            } else {
                                // GUID
                                principals.push(assignment.principal);
                            }
                        });

                        // resolve the principals
                        var promises = [];
                        if (principals.length > 0) {
                            promises.push(
                                azureGraph.get(principals).then(function(principals) {
                                    var findByPrincipal = function(id) {
                                        var found = null;
                                        assignments.some(function (assignment) {
                                            if (assignment.principal == id) {
                                                found = assignment;
                                                return true;
                                            }
                                        });
                                        return found;
                                    };
                                    principals.forEach(function(principal) {
                                        var assignment = findByPrincipal(principal.objectId);
                                        if (assignment) {
                                            assignment.type = principal.objectType;
                                            assignment.displayName = principal.displayName;
                                            if (principal.userPrincipalName) assignment.upn = principal.userPrincipalName;
                                            if (principal.appId) assignment.appId = principal.appId;
                                        }
                                    });
                                })
                            );
                        }
                        
                        // resolve the roles
                        assignments.forEach(function(assignment) {
                            if (assignment.role.substring(0, 1) == "/") {
                                promises.push(
                                    me.get(assignment.role).then(function(role) {
                                        assignment.role = role.properties.roleName;  
                                    })
                                );
                            }
                        });
                        q.all(promises).finally(function() {
                            deferred.resolve(assignments);
                        });
                        
                    }, function() {
                        deferred.reject();
                    });
                    
                });
                
            }, function() {
                deferred.reject();
            });
            
        }, function() {
            deferred.reject();
        });
        return deferred.promise;
    }
        
};

azureManager.getAllAssignments().then(function(assignments) {
    
    // create a CSV file
    var filename = "assignments.csv";
    if (process.argv.length > 2) filename = process.argv[2];
    var file = fs.createWriteStream(filename);
    file.on("finish", function() {
        console.log(assignments.length + " assignments written to " + filename); 
    });

    // create a stream to write into the file
    var stream = csv.createWriteStream({headers: false});
    stream.pipe(file);
    stream.write({ a: "Scope", b: "Principal", c: "Role", d: "Type", e: "Display Name", f: "UPN/SPN/AppId" });

    // write out each result
    assignments.forEach(function(assignment) {
        var line = {
            a: assignment.scope,
            b: assignment.principal,
            c: assignment.role,
            d: assignment.type,
            e: assignment.displayName
        };
        if (assignment.upn) line.f = assignment.upn;
        if (assignment.spn) line.f = assignment.spn;
        if (assignment.appId) line.f = assignment.appId;
        stream.write(line);
    });
    
    // close the stream
    stream.end();
        
});
