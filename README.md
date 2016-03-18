# Azure Account List
This is a simple Node.js script to generate a .csv file of all accounts in all subscriptions that an account has access to.

## Requirements
In order for this script to run you need to have Node.js installed. You can download it here:
* https://nodejs.org

You must also have an ORGANIZATIONAL ACCOUNT as a Reader (or better) in one or more Azure subscriptions. This does not work with MICROSOFT ACCOUNTS.

## Subscription Permissions
To add an account as a Reader on a subscription:
1. Login to https://portal.azure.com.
2. Click on "Browse >" in the navigation section.
3. Click on "Subscriptions".
4. Click on a subscription.
5. Click on the users icon at the upper-right of the panel.
6. Click on the "Add" button.
7. Select the "Reader" role.
8. Select the appropriate user account.
9. Click "OK" at the bottom.

## Azure Application
You must register a native Azure AD application for this script. You should follow these steps:

1. Login to https://manage.windowsazure.com.
2. Click on "Active Directory" in the left-hand navigation pane.
3. Click on the Directory that will own the application.
4. Click on the "Applications" tab at the top.
5. Click to "Add" an application at the bottom.
6. Click on "Add an application my organization is developing".
7. Provide a name for your application.
8. Choose "Native client application".
9. Provide a "Redirect URL". This could be any valid URL. For example, "http://azure-account-list".
10. Click the checkmark to create the application.
11. Click on the "Configure" tab.
12. Make note of the "Client ID", you will use that in the configuration file below.
13. Under "permissions to other applications", "Windows Azure Active Directory", "Delegated Permissions", check "Sign in and read user profile" and "Read directory data".
13. Under "permissions to other applications", click "Add application", select "Windows Azure Service Management API". Under "Delegated Permissions", check "Access Azure Service Management as organiza...".
14. Click on the "Save" button at the bottom.

## Configuration File
There is a configuration file that will need to be named default.json in the /config folder. There is a sample included with this source code. Make the following updates:

* authority - You can leave this as is.
* directory - This is the directory name for your Azure AD where your users reside.
* clientId - This should be the Client ID from step 12 above.
* username - This should be the username of the organizational account that has access as a Reader across multiple subscriptions.
* password - The password for the above account.

## Execution
You can run the command like:
* node index.js
OR
* node index.js filename.csv

If you do not specify a filename, it will be assignments.csv.
