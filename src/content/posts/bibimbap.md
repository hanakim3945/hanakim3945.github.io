---
title: A deepdive into T8012 mac (h)activation
published: 2025-05-07
description: Hactivation T2 Macbooks via MobileGestalt POC
tags: [RE, Hax, Apple, iCloud]
category: Hacking
draft: true
---


Read this post on your own risk! The information is based on my own research and my (not-so-good-yet) reverse engineering skills. Thus, this write-up might be incorrect, contains mistakes and turn out partially or completely wrong! Do not trust it blindly and DYOR :\)

### Background

If you didn't read the article about Hactivation via MobileGestalt POC on iOS devices, I suggest you to do so, as this writeup heavily based on it.

Intel macbooks, and probably also the newer generations have the same bug as iOS devices: Their mobilegestalt cache can be modified without any restrictions, given you have access to the Data partition of the iOS filesystem e.g. via a simple sandbox espace or jailbreak obviously.
Based on my experience, T2 macs cannot generate the Gestalt Cache themself. Funny enough, when checking the usual file paths there simply doesn't exist a folder nor the cache.

### The hax
While it can't generate the cache itself, it can still validate an existing cache and if it's recognized as valid, it reads the configuration from it.
This way we can achieve the same as with iOS. The faked demotion state with spoofed `EffectiveProductionStatusAp`, `EffectiveProductionStatusSEP`, `EffectiveSecurityModeAp` and `EffectiveSecurityModeSEP` is a possibility here too.


### How to exploit

Technically, there are not many steps required:

1. Create the required gestalt cache folder in
`/var/containers/Shared/SystemGroup/systemgroup.com.apple.mobilegestaltcache/Library/Caches`
2. Place file according to your bridgeOS version into this folder with filename
   `com.apple.MobileGestalt.plist`

3. Profit ~

### How to create the cache

To create a valid cache, the easiest strategy is to take the a cache from another iOS device on a corresponding iOS Version which match the release time of the installed bridgeOS version and then manually checking if the CacheData size is matching with the check in MobileGestalt framework. 

```jsx

// NOTE: This is mobilegestalt.frameowork of 17.7.6 iPad 7 reverse-engineered, 
// the structure looks same in any mobilegestalt framework tho, 
// no matter which version of bridgeOS or iOS, just the values are changing.

__int64 __fastcall sub_19C4B5CF0(int a1)
{
...
  v2 = sub_19C4B6B6C(
         "/private/var/containers/Shared/SystemGroup/systemgroup.com.apple.mobilegestaltcache/Library/Caches/com.apple.Mo"
         "bileGestalt.plist");
  if ( !v2 )
    goto LABEL_84;
  v3 = v2;
  v4 = sub_19C4B6448(*MEMORY[0x1E73DC370], 1LL);
  if ( v4 )
  {
    v5 = (const __CFString *)v4;
    v6 = MEMORY[0x1A1D95484](v3, CFSTR("CacheExtra"));
    if ( !v6 )
    {
      ...
      if ( v16 )
        v17 = (const char *)(v16 + 1);
      else
      ...
      _MGLog(v17, 68LL, CFSTR("cache extra is missing"));
      if ( !(unsigned int)MEMORY[0x1A1D95E14](MEMORY[0x1E75485A8], 0LL) )
        goto LABEL_23;
      LOWORD(v60) = 0;
      v12 = MEMORY[0x1E75485A8];
      v13 = "cache extra is missing";
      goto LABEL_22;
    }
    v7 = v6;
    v8 = sub_19C4B6448(CFSTR("ReleaseType"), 0LL);
    v9 = MEMORY[0x1A1D95484](v7, CFSTR("9UCjT7Qfi4xLVvPAKIzTCQ"));
    if ( v8 | v9 )
    {
      if ( !v8 && v9 )
      {
        ...
        _MGLog(v11, 113LL, CFSTR("moving from non-GM to release, invalidate cache"));
        ...
LABEL_22:
        MEMORY[0x1A1D95A60](&dword_19C4B0000, v12, 0LL, v13, &v60, 2LL);
LABEL_23:
        v8 = 0LL;
        goto LABEL_82;
      }
      if ( v8 && !v9 )
      {
        ...
        _MGLog(v19, 118LL, CFSTR("moving from release to non-GM, invalidate cache"));
        ...
LABEL_80:
          v44 = 2LL;
          goto LABEL_81;
        }
        goto LABEL_82;
      }
      if ( v8 && v9 && !(unsigned int)MEMORY[0x1A1D954B4](v9, v8) )
      {
        ...
        _MGLog(v46, 128LL, CFSTR("we're switching release types, invalidate cache"));
        ...
        goto LABEL_82;
      }
    }
    v22 = MEMORY[0x1A1D95484](v3, CFSTR("CacheVersion"));
    if ( v22 )
    {
      v23 = v22;
      if ( (unsigned int)MEMORY[0x1A1D954B4](v22, v5) )
      {
        v24 = MEMORY[0x1A1D95484](v3, CFSTR("CacheUUID"));
        if ( !v24 )
        {
          ...
          _MGLog(v39, 147LL, CFSTR("can't validate cache since uuid is missing"));
          ...
          goto LABEL_82;
        }
        v25 = v24;
        if ( (unsigned int)MEMORY[0x1A1D954B4](v24, CFSTR("598F804A-65EE-43EF-90D7-71A491AD61EA")) )
        {
          v26 = MEMORY[0x1A1D95484](v3, CFSTR("CacheData"));

          // Here are a few checks on the cachedata performed.
          // We can find the correct size of CacheData here.
          if ( v26
            && (v27 = v26, v28 = MEMORY[0x1A1D954CC](), v28 == MEMORY[0x1A1D9540C]())
            && MEMORY[0x1A1D953F4](v27) == 5895 ) // in our case it's 5895 bytes
          {
            ...
            if ( a1 )
            {
              ...
              _MGLog(v30, 205LL, CFSTR("Cache loaded with %zu pre-cached in CacheData and %ld items in CacheExtra."));
              ...
            }
          }
          else
          {
            ...
            _MGLog(v41, 158LL, CFSTR("cache data is invalid"));
            ...
          }
          goto LABEL_82;
        }
        ...
        _MGLog(v43, 152LL, CFSTR("cache UUID %@ doesn't match build UUID %@"));
        ...
        v63 = CFSTR("598F804A-65EE-43EF-90D7-71A491AD61EA");
        ...
      }
      else
      {
        ...
        _MGLog(v37, 141LL, CFSTR("cache %@ doesn't match OS %@"));
        ...
      }
      v44 = 22LL;
LABEL_81:
     ...
    _MGLog(v35, 136LL, CFSTR("can't validate cache version since cacheVers is missing"));
    ...
LABEL_82:
    MEMORY[0x1A1D95550](v3);
    MEMORY[0x1A1D95550](v5);
    v3 = v8;
    if ( !v8 )
      goto LABEL_84;
    goto LABEL_83;
  }
  ...
  _MGLog(v15, 61LL, CFSTR("can't validate cache version since _kCFSystemVersionBuildVersionKey is missing"));
  ...
LABEL_83:
  MEMORY[0x1A1D95550](v3);
LABEL_84:
  ...
  return xxx;
}
```
In case the CacheData size is mismatching, I used a dumb but effective approach by adding random zero bytes at the end or middle of the gestalt file in order to bring it to the correct size. Took a while until the issues (again mentioned below) were gone and the macOS system worked normally. 

I remark that this method may not be best, but it was the easiest without spending hours patching the mobilegestalt framework to deliver a valid cache itself and then patching demotion status in this.

**UPDATE:** Apparently it's possible to just take the correct CacheData of e.g. iOS 18.4.1 from iPhone 14, add this to the mobilegestalt plist file we create for bridgeOS, apply demotion spoof and it works like a charm on bridgeOS.

### Support

For each bridgeOS version, we need to create an individual cache, caused by the changing Cache UUID, Cache Version, changing firmware version and buildID.
Replacing the basic information and the CacheData with correct size in one of the given templates below is enough to make the exploit working. The basic version numbers can be found in the rootFS of bridgeOS in the SystemVersion.plist

Currently, following bridgeOS versions are supported:

→ bridgeOS 9.2 22P2093

→ bridgeOS 9.3 22P3051

→ bridgeOS 9.3 22P3060 

→ bridgeOS 9.4 22P4248

→ bridgeOS 9.5 22P5072

→ bridgeOS 10.0 beta 23P5342a


### Known issues
- When creating caches for new bridgeOS versions, there can be touchbar issues as we have to manually adjust the size of CacheData inside the plist. Those manually added bytes require lots of testing until we find the perfect configuration. There is probably a smarter method out there, but i didn't find it yet and didn't bother to.
- Remoted panics and mac reboots after a few minutes because of a watchdog timeout. Same reason as with the touchbar, the CacheData is mysterious...


## Disclaimer

This POC is for **educational purposes only**.

- Do **not** use this for illegal activities.
- Apple may patch this behavior at any time.

The PoC can be found on here
https://github.com/hanakim3945/bibimbap



© 2025  ~ Hana Kim