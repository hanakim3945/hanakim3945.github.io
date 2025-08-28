---
title: Manual device activation with activation records
published: 2025-06-18
description: Manual device activation with records
tags: [RE, Hax, Apple, iCloud]
category: Guide
draft: true
---

Read this post on your own risk! The information is based on my own research and my (not-so-good-yet) reverse engineering skills. Thus, this write-up might be incorrect, contains mistakes and turn out partially or completely wrong! Do not trust it blindly and DYOR :\)

Activating an iOS device typically requires an internet connection and Apple's activation servers—but what if you want to activate a device offline or bypass certain restrictions? In this blog post, we’ll explore how to manually activate an iOS device by placing the necessary activation files directly on the device.

It’s important to note that this method only works with a legitimate activation record, which can be obtained in a few ways:

- Generated via a custom sn method
- Dumped from device (commonly referred to as the "passcode bypass" method)
For factory activation on older devices, an additional step is required, which we’ll cover in a separate blog post dedicated to that specific method.

Let's take a look at the steps involved to activate the device!

## Required files

- `activation_record.plist`
- `IC-Info.sisv` (can be extracted from activation_record, can be done online [here](https://encf.dev/cfd31d32-ddfe-40b9-a708-8a097e247787/verifier.php))
- `com.apple.commcenter.device_specific_nobackup.plist` *(optional)*
- `com.apple.purplebuddy.plist` (optional, used to skip full setup and go to homescreen after reboto)
- `disabled.plist` *(optional, for Baseband delete)*
---


# Guide for iOS 9
### Upload Necessary Files

Upload each file to its target path:

```bash
# Upload activation record
upload activation_record.plist → /var/mobile/Library/mad/activation_records/activation_record.plist

# Optional: upload disabled.plist if removing Baseband
upload disabled.plist → /var/db/com.apple.xpc.launchd/disabled.plist

# Upload IC-Info.sisv
upload IC-Info.sisv → /var/wireless/IC-Info.sisv

# Upload commcenter plist 
upload com.apple.commcenter.device_specific_nobackup.plist → /var/wireless/com.apple.commcenter.device_specific_nobackup.plist

# Upload purplebuddy plist
upload com.apple.purplebuddy.plist → /var/wireless/com.apple.purplebuddy.plist

```

### Set Up IC-Info and CommCenter

Create and adjust FairPlay directory:

```bash
mkdir -p /var/mobile/Library/FairPlay/iTunes_Control/iTunes/
chmod -R 775 /var/mobile/Library/FairPlay/iTunes_Control/iTunes/
mv -f /var/wireless/IC-Info.sisv /var/mobile/Library/FairPlay/iTunes_Control/iTunes/
chmod 777 /var/mobile/Library/FairPlay/iTunes_Control/iTunes/IC-Info.sisv
```

If `com.apple.commcenter.device_specific_nobackup.plist` exists:

```bash
mv -f /var/wireless/com.apple.commcenter.device_specific_nobackup.plist /var/wireless/Library/Preferences/
chmod 777 /var/wireless/Library/Preferences/com.apple.commcenter.device_specific_nobackup.plist
```

### Remove Baseband or insert PIN-Locked SIM Card

In case you are activating a cellular device without a valid wildcard ticket, e.g. if the device is activation locked and you wanna bypass it, remove the baseband firmware OR insert a PIN-locked sim card.

Big advantage of the pin-locked sim card method: The device can still be updated via OTA and stays activated. This was tested on iOS 15+ devices which use a changed serial number, devices bypassed with older factoryActivation method won’t work !

Another advantage: NO battery drain

Non the less, rename the Baseband firmware folder like this if you do not have a pin locked sim card or just prefer this method. Please note that you may get battery drain using this method.

```bash
mv /usr/local/standalone/firmware/Baseband /usr/local/standalone/firmware/Baseband2
```

---
# Guide for iOS 10+


### Locate Internal System Path to place the activation record

You'll need to find the internal container path:

```bash
find /private/var/containers/Data/System -type d -name "internal"
```

This usually outputs something like:

```bash
/private/var/containers/Data/System/<SOME UUID>/internal
```

The path to place the activation records will be (if that folder doesn’t exist there, no worries, we will create it…)

```bash
/private/var/containers/Data/System/<SOME UUID>/activation_records
```


### Prepare required folders

Create directories and set permissions:

```bash
mkdir -p /var/wireless/activation_records
chmod 777 /var/wireless/activation_records

mkdir -p /var/wireless/internal
chmod 777 /var/wireless/internal

```


### Upload Necessary Files

Upload each file to its targ path:

```bash
# Upload activation record
upload activation_record.plist → /var/wireless/activation_records/activation_record.plist

# Optional: upload disabled.plist if removing Baseband
upload disabled.plist → /var/db/com.apple.xpc.launchd/disabled.plist

# Upload IC-Info.sisv
upload IC-Info.sisv → /var/wireless/IC-Info.sisv

# Upload commcenter plist 
upload com.apple.commcenter.device_specific_nobackup.plist → /var/wireless/com.apple.commcenter.device_specific_nobackup.plist

# Upload purplebuddy plist
upload com.apple.purplebuddy.plist → /var/wireless/com.apple.purplebuddy.plist

```


### Move PurpleBuddy (Skip Setup / optional)

Replace the setup wizard plist:

```bash
chflags nouchg /var/mobile/Library/Preferences/com.apple.purplebuddy.plist
rm -rf /var/mobile/Library/Preferences/com.apple.purplebuddy.plist
mv /var/wireless/com.apple.purplebuddy.plist /var/mobile/Library/Preferences/com.apple.purplebuddy.plist
chmod 600 /var/mobile/Library/Preferences/com.apple.purplebuddy.plist
chflags uchg /var/mobile/Library/Preferences/com.apple.purplebuddy.plist
```


### Move Activation Records to Final Location

```bash
mv -f /var/wireless/activation_records /private/var/containers/Data/System/<SOME UUID>/
chmod -R 777 /private/var/containers/Data/System/<SOME UUID>/activation_records
chown -R mobile:nobody /private/var/containers/Data/System/<SOME UUID>/activation_records
chmod 666 /private/var/containers/Data/System/<SOME UUID>/activation_records/activation_record.plist
```

### Set Up IC-Info and CommCenter

Create and adjust FairPlay directory:

```bash
mkdir -p /var/mobile/Library/FairPlay/iTunes_Control/iTunes/
chmod -R 775 /var/mobile/Library/FairPlay/iTunes_Control/iTunes/
mv -f /var/wireless/IC-Info.sisv /var/mobile/Library/FairPlay/iTunes_Control/iTunes/
chmod 777 /var/mobile/Library/FairPlay/iTunes_Control/iTunes/IC-Info.sisv
```

If `com.apple.commcenter.device_specific_nobackup.plist` exists:

```bash
mv -f /var/wireless/com.apple.commcenter.device_specific_nobackup.plist /var/wireless/Library/Preferences/
chmod 777 /var/wireless/Library/Preferences/com.apple.commcenter.device_specific_nobackup.plist
```

### Remove Baseband or insert PIN-Locked SIM Card

In case you are activating a cellular device without a valid wildcard ticket, e.g. if the device is activation locked and you wanna bypass it, remove the baseband firmware OR insert a PIN-locked sim card.

Big advantage of the pin-locked sim card method: The device can still be updated via OTA and stays activated. This was tested on iOS 15+ devices which use a changed serial number, devices bypassed with older factoryActivation method won’t work !

Another advantage: NO battery drain

Non the less, rename the Baseband firmware folder like this if you do not have a pin locked sim card or just prefer this method. Please note that you may get battery drain using this method.

iOS 9 - 11

```bash
mv /usr/local/standalone/firmware/Baseband /usr/local/standalone/firmware/Baseband2
```

iOS 12+

```bash
mv /private/preboot/<some_random_long_folder_name>/usr/local/standalone/firmware/Baseband /private/preboot/<some_random_long_folder_name>/usr/local/standalone/firmware/Baseband2

```

### Restart Activation Services or Reboot device

```bash
killall -9 mobileactivationd MobileGestaltHelper
# or
reboot
```

---

## Disclaimer

This writeup is for **educational purposes only**.

- Do **not** use this for illegal activities.
- Apple may patch this behavior at any time.



© 2025  ~ Hana Kim