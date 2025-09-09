---
title: Hactivation via MobileGestalt POC
published: 2025-05-01
description: Hactivation via MobileGestalt POC
tags: [RE, Hax, Apple, iCloud]
category: Hacking
draft: true
---

# GestaltHax

Read this post on your own risk! The information is based on my own research and my (not-so-good-yet) reverse engineering skills. Thus, this write-up might be incorrect, contains mistakes and turn out partially or completely wrong! Do not trust it blindly and DYOR :\)

### The background story

The mobilegestalt framework was already abused in tools like [Nugget](https://github.com/leminlimez/Nugget) to enable Apple Intelligence on unsupported devices, allows us to enable internal settings and debug options, customize our device a little more than apple wanting it.
Especially the fact that no jailbreak was required and any device with iOS 15 ~ 18.2 was vulnerable to the SparseRestore bug made it a perfect project to deep-dive in.

Even though the sparserestore bug is an interesting topic itself, we won't analyze it here. We are more interested in what else than fun modifications we can do to iPhones with it.
So let focus on the MobileGestalt library.


---

### MobileGestalt

**MobileGestalt** is a system library stored in the `dyld_shared_cache`. When extracted, it resides at:

```
/usr/lib/libMobileGestalt.dylib
```

This library is present in the root filesystem (`/System/Library/Caches/com.apple.dyld/`) of any iPSW.

#### MobileGestaltHelper

A companion executable, **MobileGestaltHelper**, is located at:

```
/usr/libexec/MobileGestaltHelper
```

This helper is responsible for generating a cache file that MobileGestalt uses.

#### Cache File: `com.apple.MobileGestalt.plist`

The generated cache file is located at:

```
/var/containers/Shared/SystemGroup/systemgroup.com.apple.mobilegestaltcache/Library/Caches/com.apple.MobileGestalt.plist
```

Since this path resides on the **read-write data partition** of iOS, it becomes an ideal target for analysis or modification.

#### Cache Structure

The structure of the plist file is consistent across all devices and includes the following keys:

* **`CacheData` → `Data`**
  Contains configuration data organized as a matrix. This section is likely the most interesting, as it holds structured and potentially sensitive values.

* **`CacheExtra` → `Dictionary`**
  Includes basic firmware identifiers and device model names. MG (MobileGestalt) keys are mapped to values of type `String`, `Int`, or raw `Data`.

* **`CacheUUID` → `String`**
  A unique UUID assigned to the cache, differing with each firmware version.

* **`CacheVersion` → `String`**
  Corresponds to the `buildID` of the currently installed firmware version.


### MobileActivation

While reverse engineering the mobileactivation framework, I found a parameter called should_hactivate. Sounds interesting, right? So let's see how we can trigger it.
Older (tethered) bypass tools are patching the mobileactivationd to force activate this option, but there is a much cleaner way.

When loading `mobileactivationd` (found in `/usr/libexec/` path) in IDA Pro, we find the following function:

```jsx
DeviceType *__cdecl -[DeviceType init](DeviceType *self, SEL a2)
{
  DeviceType *v2; // x19
  NSString *product_type; // x8
  NSString *hardware_model; // x8
  NSString *device_class; // x8
  NSString *soc_generation; // x8
  NSFileManager *v34; // x21

  v48.super_class = (Class)&OBJC_CLASS___DeviceType;
  v2 = -[DeviceType init](&v48, "init");
  if ( v2 )
  {{

    // Internal build check 
    v2->_is_internal_build = os_variant_allows_internal_security_policies(objc_msgSend(CFSTR("com.apple.mobileactivationd"), sel_UTF8String));

    // Similar check as the build check
    v2->_has_internal_diagnostics = os_variant_has_internal_diagnostics(objc_msgSend(CFSTR("com.apple.mobileactivationd"), sel_UTF8String));
    ...

    // Dev Board 
    v2->_is_dev_board = -[NSString hasSuffix:](v2->_hardware_model, sel_hasSuffix_, CFSTR("DEV"));
    ...

    // Check if running device is development fused aka demoted
    v16 = objc_msgSend(v3, sel_copyAnswer_, CFSTR("CertificateProductionStatus"));
    
    v18 = objc_msgSend(v3, sel_copyAnswer_, CFSTR("EffectiveProductionStatusAp"));
   
    v20 = objc_msgSend(v3, sel_copyAnswer_, CFSTR("CertificateSecurityMode"));
    
    v22 = objc_msgSend(v3, sel_copyAnswer_, CFSTR("EffectiveSecurityModeSEP"));
    
    if ( v20 && v16 && v18 && v22 )
    {
      // If there is AP demotion detected, turn on hactivation
      if ( (unsigned int)objc_msgSend(v16, sel_isEqualToNumber_, &unk_1F33EFD18)
        && (unsigned int)objc_msgSend(v18, sel_isEqualToNumber_, &unk_1F33EFD30)
        && (unsigned int)objc_msgSend(v20, sel_isEqualToNumber_, &unk_1F33EFD18)
        && (unsigned int)objc_msgSend(v22, sel_isEqualToNumber_, &unk_1F33EFD18) )
      {
        v2->_should_hactivate = 1;
        v2->_is_prodfused_demoted = 1;
      }

      // If there is SEP demotion detected, turn on hactivation
      if ( (unsigned int)objc_msgSend(v16, sel_isEqualToNumber_, &unk_1F33EFD30)
        && (unsigned int)objc_msgSend(v18, sel_isEqualToNumber_, &unk_1F33EFD30)
        && (unsigned int)objc_msgSend(v20, sel_isEqualToNumber_, &unk_1F33EFD18)
        && (unsigned int)objc_msgSend(v22, sel_isEqualToNumber_, &unk_1F33EFD18) )
      {
        v2->_should_hactivate = 1;
        v2->_is_devfused_undemoted = 1;
      }
    }

    // if running internal build of iOS ~ 
    if ( v2->_is_internal_build )
    {
      // if gestalt key is set to true, turn on hactivation
      if ( !v2->_should_hactivate )
        v2->_should_hactivate = (unsigned __int8)objc_msgSend(v3, sel_getBoolAnswer_, CFSTR("ShouldHactivate"));
      ...

      // if device model name contains iFPGA, turn on hactivation
      if ( -[NSString containsString:](v2->_product_type, sel_containsString_, CFSTR("iFPGA")) )
      {
        v2->_should_hactivate = 1;
        v2->_is_fpga = 1;
      }
      
      // if development board detected, turn on hactivation
      if ( v2->_is_dev_board )
        v2->_should_hactivate = 1;
     ...
    }
    ...
  }
  return v2;
}
```


Where is the flaw, can you see it?

## Tampering with device parameters

As seen in the pseudocode, there are two target points:

1. making the device running an internal build of iOS
2. Demoting the device

We are not really demoting the device, but we may can spoof the values, right? MobileGestalt Cache is the correct address here. It stores mostly all values of a device. Model, country of origin, BuildID, iOS Version, device color and more.

## Messing around with the MobileGestalt cache

The cache is regenerated if detected as invalid, for example it checks the buildID of the currently installed iOS version with the buildID stored in the cache and if it mismatch, it regenerates.
So technically at every iOS Update, the cache is refreshed.
However, we can still modify a lot of it without triggering any mismatch, so with the demotion spoof.

My first approach was to set the keys `EffectiveProductionStatusAp`, `EffectiveProductionStatusSEP`, `EffectiveSecurityModeAp` and `EffectiveSecurityModeSEP` in the CacheExtra dictionary inside the cache plist - and failed.

But what about the `CacheData` section?

In this unimportant-looking mess of bytes, we find our demotion status.
When setting the correct values, we make mobileactivationd detect our device as prod_fused or dev_fused, so it shortcuts the activation process and takes us straight to homescreen.

And that's it. 

To find the offsets in the gestalt cache, i wrote a patcher utility which finds the correct bytes and patch them to zero for us. Our device is now spoofed-demoted, yeyy :)


### How to fix that issue?

There are several possibilities how apple can fix the issue:

1. Skipping the cache and get the values directly from the hardware, similar like the serial number or uniqueDeviceIdentifier is fetched. Those values are not cached and therefore not spoofable

2. Creating some kind of signature for the mobilegestalt, so any unauthorized modification which is not performed by the system will cause regeneration.

3. Add another check to the init function in mobileactivationd similar to the os_variant_allows_internal_security_policies check to avoid tampering.

    Something like this ...
    ```jsx
    ...
    if ( v20 && v16 && v18 && v22 && v2->_is_internal_build )
    {
      // If there is AP demotion detected, turn on hactivation
      if ( (unsigned int)objc_msgSend(v16, sel_isEqualToNumber_, &unk_1F33EFD18)
        && (unsigned int)objc_msgSend(v18, sel_isEqualToNumber_, &unk_1F33EFD30)
        && (unsigned int)objc_msgSend(v20, sel_isEqualToNumber_, &unk_1F33EFD18)
        && (unsigned int)objc_msgSend(v22, sel_isEqualToNumber_, &unk_1F33EFD18) )
      {
        v2->_should_hactivate = 1;
        v2->_is_prodfused_demoted = 1;
      }

      // If there is SEP demotion detected, turn on hactivation
      if ( (unsigned int)objc_msgSend(v16, sel_isEqualToNumber_, &unk_1F33EFD30)
        && (unsigned int)objc_msgSend(v18, sel_isEqualToNumber_, &unk_1F33EFD30)
        && (unsigned int)objc_msgSend(v20, sel_isEqualToNumber_, &unk_1F33EFD18)
        && (unsigned int)objc_msgSend(v22, sel_isEqualToNumber_, &unk_1F33EFD18) )
      {
        v2->_should_hactivate = 1;
        v2->_is_devfused_undemoted = 1;
      }
    }
    ...
    ```


## Disclaimer

This POC is for **educational purposes only**.

- Do **not** use this for illegal activities.
- Apple may patch this behavior at any time.


The PoC can be found on here
https://github.com/hanakim3945/gestalt_hax



© 2025  ~ Hana Kim