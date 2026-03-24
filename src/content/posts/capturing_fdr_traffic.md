---
title: Intercept iOS firmware restore traffic / FDR / TSS / ...
published: 2026-03-24
description: Intercept iOS firmware restore traffic / FDR / TSS / ...
tags: [RE, Hax, Apple, iCloud]
category: Hacking
draft: false
---


Read this post on your own risk! The information is based on my own research and my (not-so-good-yet) reverse engineering skills. Thus, this write-up might be incorrect, contains mistakes and turn out partially or completely wrong! Do not trust it blindly and DYOR :\)

### Background

For debugging reasons, it's usually helpful to be able to intercept SSL traffic even if it's usually protected by apple's internal cert pinning mechanisms.

As many people were asking me about how i run an idevice restore session completely with verbose output and all traffic logged via a proxy server, I wanted to share this method here.


### Library Patches

First of all, we need to patch the library `libamsupport.dylib`, which is responsible for everything going on between the host mac and our device to restore.

Load it into IDA Pro and search for `Root cert not signed by any trusted roots.` 

![Screenshot 2026-03-24 at 13.26.03.png](../../assets/images/Capture%20FDR%20traffic%20by%20bypassing%20SSL%20pinning%20durin/Screenshot_2026-03-24_at_13.26.03.png)

The `MOV` instruction below it will set the validation return code into the pointer which was given to our function `__int64 __fastcall AMSupportX509ChainEvaluateTrust(__SecTrust *a1, CFArrayRef theArray, _DWORD *a3)`

![Screenshot 2026-03-24 at 13.26.49.png](../../assets/images/Capture%20FDR%20traffic%20by%20bypassing%20SSL%20pinning%20durin/Screenshot_2026-03-24_at_13.26.49.png)

By patching `MOV W21, #3` to `MOV W21, #1` (HEX `75 00 80 52` to `35 00 80 52`), 
we can turn off the SSL pinning for most of our target domains such as `gg.apple.com` and `skl.apple.com` .

Modify the library either in IDA directly or via a hex editor.

Resign the binary with ad-hoc signature via 

```jsx
codesign -f -s - libamsupport.dylib
```

Place back into the ramdisk.

### Kernel patches

Since we modified a binary in our ramdisk, we now also need to patch out AMFI signature checks in our kernelcache.

Based on your target device, choose the correct kernelcache, decompress it with `img4`

```jsx
img4 -i kernel.* -o kcache.raw
```

Then load it into IDA Pro and search for the pattern

`e0 03 00 91 e1 03 13 aa`

Select the match in `com.apple.driver.AppleMobileFileIntegrity`

![Screenshot 2026-03-24 at 13.39.36.png](../../assets/images/Capture%20FDR%20traffic%20by%20bypassing%20SSL%20pinning%20durin/Screenshot_2026-03-24_at_13.39.36.png)

Scroll to the top of the function

![Screenshot 2026-03-24 at 13.42.34.png](../../assets/images/Capture%20FDR%20traffic%20by%20bypassing%20SSL%20pinning%20durin/Screenshot_2026-03-24_at_13.42.34.png)

and make it return 1.

```jsx
MOV             X0, #1
RET
```

HEX `20 00 80 d2 c0 03 5f d6`

Do not patch the kernelcache in IDA Pro directly, use a hex editor instead.

IDA Pro somehow messes up the result file. 

Then just put the `kcache.raw` back into `im4p` format and replace it in the iPSW.

### Bootchain patches

To load the patched `kernelcache`, we also need to patch img4 signchecks in our `iBSS`.

The `iBEC` we do not need to patch, as we will exclude it from the restore boot chain by applying a patch to our `idevicerestore`.

To do this, decompress the iBSS via img4.

```jsx
img4 -i iBSS.* -o ibss.raw
```

Then load it into IDA Pro and search for `Unknown ASN1 type`

![Screenshot 2026-03-24 at 13.55.23.png](../../assets/images/Capture%20FDR%20traffic%20by%20bypassing%20SSL%20pinning%20durin/Screenshot_2026-03-24_at_13.55.23.png)

Scroll up until you see a `RET` at the end of an assembly section.

![Screenshot 2026-03-24 at 13.56.12.png](../../assets/images/Capture%20FDR%20traffic%20by%20bypassing%20SSL%20pinning%20durin/Screenshot_2026-03-24_at_13.56.12.png)

And replace it with 

```jsx
MOV             X0, #0
RET
```

HEX `00 00 80 d2 c0 03 5f d6`

Patch it, put back into `im4p` format and place back into the iPSW.
In the iBSS, you can also set `-v` to enable verbose mode.

### Patching idevicerestore

Download the idevicerestore source code and open the file `src/dfu.c`

Then patch out this section in the function `dfu_enter_recovery`

![Screenshot 2026-03-24 at 13.57.58.png](../../assets/images/Capture%20FDR%20traffic%20by%20bypassing%20SSL%20pinning%20durin/Screenshot_2026-03-24_at_13.57.58.png)

Then compile it.

### Booting the device

I use proxyman in my case, so my proxy port is 9090.

First, run the gaster exploit to make the device accept unsigned bootchain (like our patched iBSS).

Then start the restore.

```jsx
HTTPS_PROXY=http://127.0.0.1:9090 ./idevicerestore -e patched.ipsw
```

After the iBSS is sent, you may need to reconnect your device as idevicerestore wait's for the device to disconnect and reconnect in recovery mode.

*Please note, that based on this setup, the device will always restore a fake-signed kernelcache and therefore not be bootable after the restore.*

### Intercepting network requests in proxy

Now, the traffic should be visible in proxyman, fiddler, …

![Screenshot 2026-03-24 at 14.01.42.png](../../assets/images/Capture%20FDR%20traffic%20by%20bypassing%20SSL%20pinning%20durin/Screenshot_2026-03-24_at_14.01.42.png)


## Disclaimer

This POC is for **educational purposes only**.

- Do **not** use this for illegal activities.
- Apple may patch this behavior at any time.

The PoC can be found on here
https://github.com/hanakim3945/bibimbap



© 2025  ~ Hana Kim